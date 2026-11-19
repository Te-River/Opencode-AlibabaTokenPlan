// buildStatus —— 纯函数（03-D1：`buildStatus(catalog, now)`），输出即 status.json payload。
// 0.1.4：移除 Qoder 快照，优惠数据仅来自阿里云百炼 Token Plan。

import type { CatalogSource, DiscountEntry, ModelEntry, OfferOrigin, OfferRule, OfferUnit, StatusFile, WindowView } from "./types";
import { CREDITS_PER_YUAN, TOKEN_PLAN_TEXT_MODELS } from "./bailian-snapshot";
import { catalogToOffers, mergeOffers } from "./merge";
import { chineseDiscount } from "./discount-doc";
import { windowState, fmtCountdown } from "./rules";

export const STALE_AFTER_SEC = 600;

export interface CatalogInput {
  source: CatalogSource; // live | cli | snapshot
  models: ModelEntry[];
  fetchedAt?: string;
  error?: string;
}

export interface QuotaInput {
  available: boolean;
  checkedAt?: string;
  data?: unknown;
  hint?: string;
}

const CATALOG_ORIGIN: Record<CatalogSource, OfferOrigin> = {
  live: "bailian-live",
  cli: "bailian-cli",
  snapshot: "bailian-snapshot",
};

/** m5：id 保留 HHMM（去冒号），同小时不同分钟不再碰撞；offpeak 主窗沿用契约 §2 命名。 */
export function windowId(start: string, end: string): string {
  if (start === "22:00" && end === "08:00") return "offpeak-22-08"; // 契约 §2 示例命名
  return `win-${start.replace(":", "")}-${end.replace(":", "")}`;
}

/** 实时官方文档时窗 ∪ 目录普通降价（合并去重+排序）；无文档时不生成任何时窗。 */
export function buildOffers(catalog: CatalogInput, documentRules: OfferRule[] = []): OfferRule[] {
  const origin = CATALOG_ORIGIN[catalog.source] ?? "bailian-snapshot";
  return mergeOffers([
    ...documentRules,
    ...catalogToOffers(catalog.models, origin, catalog.fetchedAt?.slice(0, 10), documentRules),
  ]);
}

/** factor → 折数（10×factor，定点两位吸收 0.4×10 之类的浮点尾数）。 */
function zheOf(factor: number): number {
  return Math.round(factor * 1000) / 100;
}

/** 时窗标题：同档 → `夜间四折`；跨档 → `夜间折扣 0.8–5 折`（含预览系数时区间会下探到 0.8）。 */
function windowLabel(rules: OfferRule[]): string {
  const zhe = [...new Set(rules.flatMap((rule) => (rule.factor === undefined ? [] : [zheOf(rule.factor)])))];
  if (!zhe.length) return rules[0]?.label ?? "Token Plan 夜间折扣";
  const lo = Math.min(...zhe);
  const hi = Math.max(...zhe);
  return lo === hi ? `Token Plan 夜间${chineseDiscount(lo)}折` : `Token Plan 夜间折扣 ${lo}–${hi} 折`;
}

function buildWindows(offers: OfferRule[], now: Date): WindowView[] {
  const byWindow = new Map<string, { start: string; end: string; tz: string; rules: OfferRule[] }>();
  for (const r of offers) {
    if (r.kind !== "time-window" || !r.window) continue;
    const key = `${r.window.start}-${r.window.end}@${r.window.tz}`;
    let g = byWindow.get(key);
    if (!g) { g = { ...r.window, rules: [] }; byWindow.set(key, g); }
    g.rules.push(r);
  }
  const out: WindowView[] = [];
  for (const g of byWindow.values()) {
    const w = windowState(g, now);
    const models: WindowView["models"] = [];
    for (const r of g.rules) {
      for (const m of r.models) {
        models.push({
          model: m,
          regular: fmtFactor(r.baseFactor),
          effective: fmtFactor(r.factor),
          badge: r.label,
          origins: r.origins,
          links: r.links,
        });
      }
    }
    models.sort((a, b) => {
      const fa = parseFloat(a.effective ?? "1"), fb = parseFloat(b.effective ?? "1");
      if (fa !== fb) return fa - fb; // 价低先（D2c）
      return a.model.localeCompare(b.model);
    });
    // 标题按整窗档位概括：跨档位（如 qwen 4 折 + DeepSeek 5 折）不能冒充最低档。
    const sourceDate = g.rules.reduce<string | undefined>((latest, rule) => (rule.snapshotDate && (!latest || rule.snapshotDate > latest) ? rule.snapshotDate : latest), undefined);
    const label = windowLabel(g.rules) + (sourceDate ? ` · 文源 ${sourceDate}` : "");
    out.push({
      id: windowId(g.start, g.end),
      label,
      start: g.start,
      end: g.end,
      tz: g.tz,
      activeNow: w.active,
      boundaryKind: w.boundaryKind,
      nextBoundaryAt: w.nextBoundaryAt,
      models,
    });
  }
  // offpeak 主窗排前
  out.sort((a, b) => Number(b.id.startsWith("offpeak")) - Number(a.id.startsWith("offpeak")) || a.start.localeCompare(b.start));
  return out;
}

function fmtFactor(f?: number): string | undefined {
  if (f === undefined || !Number.isFinite(f)) return undefined;
  let s = f.toFixed(2);
  s = s.replace(/0+$/, "").replace(/\.$/, ".0");
  return s + "x";
}

function buildDiscounts(offers: OfferRule[]): DiscountEntry[] {
  const byModel = new Map<string, OfferRule[]>();
  for (const r of offers) {
    if (r.kind === "free-calls" || r.kind === "policy") continue;
    for (const m of r.models) {
      const arr = byModel.get(m) ?? [];
      arr.push(r);
      byModel.set(m, arr);
    }
  }
  const out: DiscountEntry[] = [];
  for (const [model, applies] of byModel) {
    // m3：按 unit 分桶各取数值最小
    const bestFactors: Partial<Record<OfferUnit, number>> = {};
    for (const r of applies) {
      if (r.factor === undefined) continue;
      const cur = bestFactors[r.unit];
      if (cur === undefined || r.factor < cur) bestFactors[r.unit] = r.factor;
    }
    out.push({
      model,
      applies,
      ...(Object.keys(bestFactors).length ? { bestFactors } : {}),
    });
  }
  // 与 offers 合并序一致：价低先、系列序（qwen→deepseek/glm→其他）
  const lowest = (d: DiscountEntry) => {
    const vs = Object.values(d.bestFactors ?? {});
    return vs.length ? Math.min(...vs) : 1;
  };
  const seriesOrder = (n: string) => (/^qwen/.test(n) ? 0 : /^(deepseek|glm|kimi|minimax)/.test(n) ? 1 : 2);
  out.sort((a, b) => {
    const fa = lowest(a), fb = lowest(b);
    if (fa !== fb) return fa - fb;
    const sd = seriesOrder(a.model) - seriesOrder(b.model);
    if (sd) return sd;
    return a.model.localeCompare(b.model);
  });
  return out;
}

function pickPrice(prices: ModelEntry["prices"], type: string, band?: string) {
  return prices.find((p) => p.type === type && (band ? p.band === band : !p.band || p.band === "standard"));
}

function creditsPerM(price: number): string {
  const v = price * CREDITS_PER_YUAN;
  return Number.isInteger(v) ? v.toLocaleString("en-US") : String(Number(v.toFixed(1)));
}

function buildTextModels(models: ModelEntry[], windows: WindowView[], now: Date): StatusFile["textModels"] {
  return TOKEN_PLAN_TEXT_MODELS.map((name) => {
    const m = models.find((x) => x.model === name) || models.find((x) => x.family === name);
    let badge: StatusFile["textModels"][number]["badge"];
    for (const w of windows) {
      if (w.models.some((x) => x.model === name)) {
        const ws = windowState(w, now);
        badge = {
          label: w.label,
          countdown: ws.active
            ? `${fmtCountdown(ws.minutesToNextBoundary)}后结束（${w.end}）`
            : `${fmtCountdown(ws.minutesToNextBoundary)}后开始（${w.start}）`,
        };
        break;
      }
    }
    if (!m) {
      return { model: name, input: "—", cache: "—", output: "—", ...(badge ? { badge } : {}) };
    }
    const peakIn = pickPrice(m.prices, "input_token", "peak");
    const offIn = pickPrice(m.prices, "input_token", "offpeak");
    const stdIn = pickPrice(m.prices, "input_token");
    const stdOut = pickPrice(m.prices, "output_token", "peak") || pickPrice(m.prices, "output_token");
    const offOut = pickPrice(m.prices, "output_token", "offpeak");
    const stdCache = pickPrice(m.prices, "input_token_cache", "peak") || pickPrice(m.prices, "input_token_cache") || pickPrice(m.prices, "input_token_cache_read");
    const offCache = pickPrice(m.prices, "input_token_cache", "offpeak") || pickPrice(m.prices, "input_token_cache_read", "offpeak");
    const dual = !!(peakIn && offIn);
    const pair = (a?: { price: number }, b?: { price: number }) => a ? (b ? `${creditsPerM(a.price)} / ${creditsPerM(b.price)}` : creditsPerM(a.price)) : "—";
    return {
      model: name,
      input: dual ? pair(peakIn, offIn) : pair(stdIn),
      cache: dual ? pair(stdCache, offCache) : pair(stdCache),
      output: dual ? pair(stdOut, offOut) : pair(stdOut),
      ...(dual ? { bands: "峰/谷" as const } : {}),
      ...(badge ? { badge } : {}),
    };
  });
}

function buildNotices(offers: OfferRule[], now: Date): StatusFile["notices"] {
  return offers
    .filter((r) => r.kind === "free-calls" || r.kind === "policy")
    .map((r) => ({
      kind: r.kind as "free-calls" | "policy",
      text: `${r.label}${r.note ? " — " + r.note : ""}`,
      source: r.origins[0] ?? "unknown",
      expired: r.expiry ? new Date(r.expiry).getTime() < now.getTime() : undefined,
    }));
}

/** 纯函数：目录 + 实时文档规则 + now → status.json payload。 */
export function buildStatus(catalog: CatalogInput, now: Date = new Date(), quota?: QuotaInput, documentRules: OfferRule[] = []): StatusFile {
  const offers = buildOffers(catalog, documentRules);
  const windows = buildWindows(offers, now);
  return {
    schemaVersion: 1,
    writtenBy: "@te-river/opencode-alibabatokenplan@0.2.0", // 0.2.0 无 server 进程：这只是 payload 身份标记
    updatedAt: now.toISOString(),
    staleAfterSec: STALE_AFTER_SEC,
    timezone: "Asia/Shanghai",
    creditsPerYuan: CREDITS_PER_YUAN,
    creditsRateNote: "据百炼计费示例换算，非官方汇率",
    sources: {
      catalog: CATALOG_ORIGIN[catalog.source] ?? "bailian-snapshot",
      ...(catalog.error ? { error: catalog.error } : {}),
    },
    windows,
    offers,
    discounts: buildDiscounts(offers),
    textModels: buildTextModels(catalog.models, windows, now),
    quota: quota ?? { available: false, hint: "未授权 · 打开 /tokenplan 授权" },
    notices: buildNotices(offers, now),
  };
}

// ───────────────────────── 共享状态目录（03-D3） ─────────────────────────
// v1 的 status.json / 端口 / 配置读写层已删除（README「status.json 落盘已移除」）；
// 这里只留 stateDir()：quota-cache.json 仍落在同一目录。

import * as path from "node:path";
import * as os from "node:os";

export function stateDir(): string {
  return process.env.ATP_STATE_DIR || path.join(os.homedir(), ".cache", "opencode", "alibabatokenplan");
}
