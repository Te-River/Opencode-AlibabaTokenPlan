// 视图状态：缓存首帧 → 立即刷新 → 60s 定时刷新（in-flight 合并 + 版本号丢弃过期结果）。
// 只有这里碰 core 的数据入口；凭证由 core 内部持有，本模块看不到任何秘密。

import { onCleanup, createSignal, type Accessor } from "solid-js";
import type { QuotaSnapshot } from "../core/quota/types";
import type { TokenPlanStatus } from "../core/status-model";
import { buildMergedStatus } from "../core/status-model";
import { fetchQuota } from "../core/quota/fetch";
import { fetchPersonalPlanOffers, type PersonalPlanOffers } from "../core/discount-doc";
import { readQuotaCache, writeQuotaCache } from "../core/quota-cache";
import { fetchUsageSeries } from "../core/usage-series";
import type { UsageSeries } from "../core/usage-series";
import { periodUsage, readUsageHistory, recordUsageSample } from "../core/usage-history";

export const REFRESH_INTERVAL_MS = 60_000;

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const FIVE_HOUR_MS = 5 * 60 * 60 * 1000;

export interface TokenPlanView {
  /** 合并后的额度 + 优惠快照；null = 首帧尚未拿到任何数据（渲染骨架）。 */
  readonly status: Accessor<TokenPlanStatus | null>;
  readonly refreshing: Accessor<boolean>;
  /** 最近一次刷新失败的原因（core 已脱敏）；成功后清空。有数据时视图保留上次结果并单独显示它。 */
  readonly lastError: Accessor<string | null>;
  refresh(): Promise<void>;
  dispose(): void;
}

/** 取数链路自己炸了（理论上不会发生）时的兜底快照，保证渲染永远有东西可画。 */
function fallbackSnapshot(): QuotaSnapshot {
  return {
    ok: false,
    source: null,
    fetchedAt: new Date().toISOString(),
    plan: null,
    window: null,
    addon: null,
    qwenwork: null,
    error: { kind: "unknown", message: "额度请求失败 · 60 秒后自动重试" },
  };
}

/** 月度窗口存在时才有周期行：读本地历史并差分出近 7 天 / 近 5h 用量（额度条用）。 */
function usagePeriods(quota: QuotaSnapshot, nowMs: number): TokenPlanStatus["usagePeriods"] {
  if (!quota.ok || !quota.window) return undefined;
  const history = readUsageHistory();
  return {
    week: periodUsage(history, nowMs, WEEK_MS),
    fiveHour: periodUsage(history, nowMs, FIVE_HOUR_MS),
  };
}

export function createTokenPlanView(): TokenPlanView {
  const [status, setStatus] = createSignal<TokenPlanStatus | null>(null);
  const [refreshing, setRefreshing] = createSignal(false);
  const [lastError, setLastError] = createSignal<string | null>(null);
  let version = 0;
  let inFlight: Promise<void> | null = null;
  let controller: AbortController | null = null;
  let disposed = false;
  let lastDocument: PersonalPlanOffers | null = null;

  /**
   * 一帧落地：额度与用量序列各有独立失败边界。
   * series === undefined 表示本轮没有新结果（缓存回放）→ 沿用上一帧；null 表示本轮服务端序列不可用 → 清掉数据行。
   */
  const apply = (
    snapshot: QuotaSnapshot,
    opts: { discountChanged?: boolean; series?: UsageSeries | null } = {},
  ) => {
    if (disposed) return;
    try {
      const previous = status();
      if (snapshot.ok) {
        setLastError(null);
      } else {
        // 额度失败保留旧额度；文档/序列本轮若有新结果仍可独立更新优惠。
        setLastError(snapshot.error?.message ?? "额度请求失败 · 60 秒后自动重试");
        if (previous && !opts.discountChanged && opts.series === undefined) return;
      }
      const effectiveQuota = snapshot.ok || !previous ? snapshot : previous.quota;
      const now = new Date();
      // 缓存回放不是新采样：只有本轮真实取到的月度数值才落历史。
      if (snapshot.ok && snapshot.source !== "cache" && snapshot.window && Number.isFinite(snapshot.window.usedPercent)) {
        recordUsageSample({
          at: now.getTime(),
          usedPercent: snapshot.window.usedPercent,
          remainingPercent: snapshot.window.remainingPercent,
        });
      }
      const series = opts.series !== undefined ? opts.series : previous?.usageSeries;
      setStatus(buildMergedStatus(
        effectiveQuota,
        now,
        lastDocument ?? undefined,
        usagePeriods(effectiveQuota, now.getTime()),
        series,
      ));
    } catch {
      // 优惠侧构造失败不能打断额度展示：保留上一帧。
    }
  };

  const refresh = (): Promise<void> => {
    if (inFlight) return inFlight;
    const mine = ++version;
    controller = new AbortController();
    const signal = controller.signal;
    setRefreshing(true);
    const run = (async () => {
      const [quotaResult, documentResult] = await Promise.allSettled([
        fetchQuota({ signal }),
        fetchPersonalPlanOffers({ signal }),
      ]);
      const snapshot = quotaResult.status === "fulfilled" ? quotaResult.value : fallbackSnapshot();
      // token 合计的查询起点是套餐订阅开始时间，必须等额度结果；失败边界与额度完全独立。
      const series = await fetchUsageSeries({ signal, resetAtMs: snapshot.window?.resetAtMs ?? null });
      if (disposed || mine !== version) return; // 过期结果丢弃
      const discountChanged = documentResult.status === "fulfilled";
      if (discountChanged) lastDocument = documentResult.value;
      apply(snapshot, { discountChanged, series });
      if (snapshot.ok) void writeQuotaCache(snapshot).catch(() => {});
    })();
    inFlight = run.finally(() => {
      if (mine !== version) return;
      setRefreshing(false);
      inFlight = null;
    });
    return inFlight;
  };

  void readQuotaCache()
    .then((cached) => {
      if (cached && !status()) apply(cached);
    })
    .catch(() => {
      // 缓存不可读不是错误：首帧显示骨架，随后的网络刷新会补上。
    });

  void refresh();
  const timer = setInterval(() => void refresh(), REFRESH_INTERVAL_MS);

  return {
    status,
    refreshing,
    lastError,
    refresh,
    dispose() {
      disposed = true;
      version += 1;
      clearInterval(timer);
      controller?.abort();
      controller = null;
    },
  };
}

/** 秒级本地时钟（倒计时用），随组件卸载自动停。 */
export function createClock(intervalMs = 1000): Accessor<number> {
  const [now, setNow] = createSignal(Date.now());
  const timer = setInterval(() => setNow(Date.now()), intervalMs);
  onCleanup(() => clearInterval(timer));
  return now;
}
