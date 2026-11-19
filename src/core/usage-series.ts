// 服务端 token 合计（只贡献文字，不参与额度条）—— 月合计 / 近 7 天 / 近 5h。
// 唯一数据源：遥测序列 getModelMonitorDataWithOss（productMode=TokenPlanPersonal, metricName=model_usage）。
// 实测约束（本机真实凭证）：
//   · 支持 step=86400（日粒度）与 step=3600（小时粒度），服务端只保留约 30 天；
//   · 用订阅 startTime（8 月）查整月返回 0 条 series —— 月起点必须取「月额度重置时间往前一个自然月」；
//   · 直接查 5h 区间会因窗口内无数据返回 0 series —— 5h 一律取 7 天小时序列的尾部 5 点。
// 失败只让对应的 token 文字不显示（可回部分数据），绝不影响本地 credit 条。

import { consoleRequest } from "./quota/credentials";
import { unwrap } from "./quota/decode";
import { API } from "./quota/request";

export interface UsageSeriesPoint {
  at: number; // 点时间（epoch ms）
  value: number; // 该日/该小时 token 数
}

export interface UsageSeries {
  fetchedAt: number; // 本次取数时刻（epoch ms）
  tokensMonth?: number; // Σ 月窗口全部日点；月起点查询不可用/点数不足时省略
  tokens7d?: number; // Σ 尾部 7 个日点
  tokens5h?: number; // Σ 尾部 5 个小时点
  source: "server";
}

export interface UsageSeriesOpts {
  signal?: AbortSignal;
  now?: number;
  /** 月额度重置时刻（epoch ms）；月起点 = 它往前一个自然月。 */
  resetAtMs?: number | null;
  /** 单测注入（生产不传）：与 consoleRequest 同签名，零网络。 */
  requestImpl?: (api: string, data: Record<string, unknown>, signal: AbortSignal) => Promise<unknown>;
}

type RequestImpl = NonNullable<UsageSeriesOpts["requestImpl"]>;

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_SECONDS = 86400;
const HOUR_SECONDS = 3600;
const WEEK_DAYS = 7;
const FIVE_HOUR_POINTS = 5;
const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000; // 控制台的「自然月」按 Asia/Shanghai 计

/** 上海墙钟分量（用 UTC 取值器读偏移后的时刻，避免依赖宿主时区）。 */
function shanghaiParts(ms: number): { y: number; m: number; d: number; h: number; mi: number; s: number } {
  const shifted = new Date(ms + SHANGHAI_OFFSET_MS);
  return {
    y: shifted.getUTCFullYear(),
    m: shifted.getUTCMonth(),
    d: shifted.getUTCDate(),
    h: shifted.getUTCHours(),
    mi: shifted.getUTCMinutes(),
    s: shifted.getUTCSeconds(),
  };
}

/** 同一墙钟时刻往前 delta 个自然月；目标月没有该日时夹到月末（3/31 − 1 月 = 2/28）。 */
function shiftMonth(ms: number, delta: number): number {
  const p = shanghaiParts(ms);
  const firstOfTarget = new Date(Date.UTC(p.y, p.m + delta, 1, p.h, p.mi, p.s));
  const year = firstOfTarget.getUTCFullYear();
  const month = firstOfTarget.getUTCMonth();
  const daysInTarget = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return Date.UTC(year, month, Math.min(p.d, daysInTarget), p.h, p.mi, p.s) - SHANGHAI_OFFSET_MS;
}

/** 月起点 = 月额度重置时刻往前一个自然月（Asia/Shanghai 日历月）；非法值 → null。 */
export function monthStartOf(resetAtMs: number | null | undefined): number | null {
  if (typeof resetAtMs !== "number" || !Number.isFinite(resetAtMs)) return null;
  return shiftMonth(resetAtMs, -1);
}

/** 网关解包后仍可能包一层 data（resp.data.DataV2.data.data.originData）；只下钻三层。 */
function originSeries(raw: unknown): unknown[] | null {
  let node: unknown = raw;
  for (let depth = 0; depth < 3 && node && typeof node === "object"; depth += 1) {
    const current = node as { originData?: unknown; data?: unknown };
    if (Array.isArray(current.originData)) return current.originData;
    node = current.data;
  }
  return null;
}

/** total_tokens 一条 series 的点：按时间重排、丢弃非法点；找不到该 series → null。 */
function totalTokenPoints(series: unknown[]): UsageSeriesPoint[] | null {
  for (const entry of series) {
    const item = entry as { labels?: { usage_type?: unknown }; points?: unknown } | null;
    if (item?.labels?.usage_type !== "total_tokens" || !Array.isArray(item.points)) continue;
    return item.points
      .filter((point): point is { value: number; timestamp: number } => {
        const p = point as { value?: unknown; timestamp?: unknown } | null;
        return (
          typeof p?.value === "number" && Number.isFinite(p.value) &&
          typeof p?.timestamp === "number" && Number.isFinite(p.timestamp)
        );
      })
      .map((point) => ({ at: point.timestamp, value: point.value }))
      .sort((a, b) => a.at - b.at);
  }
  return null;
}

const sum = (points: UsageSeriesPoint[]): number => points.reduce((total, point) => total + point.value, 0);

/** 一次遥测请求 → total_tokens 点；请求或结构异常 → null（由调用方决定是否降级）。 */
async function fetchPoints(
  request: RequestImpl,
  dto: Record<string, unknown>,
  signal: AbortSignal,
): Promise<UsageSeriesPoint[] | null> {
  try {
    const payload = await request(API.modelMonitor, { reqDTO: dto }, signal);
    const series = originSeries(unwrap(payload));
    return series ? totalTokenPoints(series) : null;
  } catch {
    return null;
  }
}

const monitorDto = (startTime: number, endTime: number, step: number): Record<string, unknown> => ({
  productMode: "TokenPlanPersonal",
  startTime,
  endTime,
  step,
  metricFilters: [{ aggMethod: "sum", metricName: "model_usage" }],
});

/**
 * 拉一次 token 合计：月/7 天走日粒度（合并成一次查询），5h 走 7 天小时粒度（另一次查询，二者并行）。
 * 月起点查询无数据时单独补一次 7 天日粒度；任何一项失败只丢该项，三项全无 → null。
 */
export async function fetchUsageSeries(opts: UsageSeriesOpts = {}): Promise<UsageSeries | null> {
  const now = opts.now ?? Date.now();
  const signal = opts.signal ?? new AbortController().signal;
  const request = opts.requestImpl ?? consoleRequest;
  const monthStart = monthStartOf(opts.resetAtMs);
  const hasMonth = monthStart !== null && monthStart < now;

  const [dailyRes, hourlyRes] = await Promise.allSettled([
    fetchPoints(request, monitorDto(hasMonth ? monthStart : now - WEEK_DAYS * DAY_MS, now, DAY_SECONDS), signal),
    fetchPoints(request, monitorDto(now - WEEK_DAYS * DAY_MS, now, HOUR_SECONDS), signal),
  ]);
  const daily = dailyRes.status === "fulfilled" ? dailyRes.value : null;

  let tokens7d: number | undefined;
  let tokensMonth: number | undefined;
  if (daily && daily.length > 0) {
    tokens7d = sum(daily.slice(-WEEK_DAYS));
    // 点数不足两个月点说明月窗口没真正覆盖到：不给月合计，不拿 30 天数据冒充
    if (hasMonth && daily.length >= 2) tokensMonth = sum(daily);
  } else if (hasMonth) {
    // 月起点超出保留期（实测会返回 0 条 series）：单独补 7 天日粒度
    const fallback = await fetchPoints(request, monitorDto(now - WEEK_DAYS * DAY_MS, now, DAY_SECONDS), signal);
    if (fallback && fallback.length > 0) tokens7d = sum(fallback.slice(-WEEK_DAYS));
  }

  const hourly = hourlyRes.status === "fulfilled" ? hourlyRes.value : null;
  const tokens5h = hourly && hourly.length > 0 ? sum(hourly.slice(-FIVE_HOUR_POINTS)) : undefined;

  if (tokensMonth === undefined && tokens7d === undefined && tokens5h === undefined) return null;
  const result: UsageSeries = { fetchedAt: now, source: "server" };
  if (tokensMonth !== undefined) result.tokensMonth = tokensMonth;
  if (tokens7d !== undefined) result.tokens7d = tokens7d;
  if (tokens5h !== undefined) result.tokens5h = tokens5h;
  return result;
}
