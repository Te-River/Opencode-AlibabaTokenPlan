// 统一优惠模型合并（03-D2）：别名归一 → 目录→Offer 转换 → 去重合并 → 优先级排序。
// 两套单位永不互算：credits-factor(Qoder Credits 倍率) 与 cny-price(百炼分时单价/discount)
// 各居其 facet；仅当 (kind, models, 窗口, factor, unit) 全等才合并（origins 并集=双源印证）。

import type { ModelEntry, OfferOrigin, OfferRule } from "./types";

/** 契约 §1 别名表：Qoder 生态内 alias → canonical（仅同生态精确字符串匹配）。 */
export const MODEL_ALIASES: Record<string, string> = {
  qmodel_38max: "qwen3.8-max",
  qmodel_latest: "qwen3.7-max",
  qmodel: "qwen3.7-plus",
  qfmodel: "qwen3.8-flash",
  q37fmodel: "qwen3.7-flash",
  dmodel: "deepseek-v4-pro",
  gmodel: "glm-5.3",
  gfmodel: "glm-5.3-flash",
  gm51model: "glm-5.2",
  kmodel: "kimi-k2.7-code",
  mmodel: "minimax-m2.7",
};

/** 小写 + 别名归一。禁止与百炼目录行强行 join，除非小写全等。 */
export function canonicalize(model: string): string {
  const k = String(model || "").toLowerCase();
  return MODEL_ALIASES[k] ?? k;
}

/** 展示优先级：bailian-live > bailian-cli > qoder-snapshot > bailian-snapshot（03-D2c） */
export function originRank(origin: OfferOrigin): number {
  return { "bailian-live": 0, "bailian-cli": 1, "qoder-snapshot": 2, "bailian-snapshot": 3 }[origin];
}

const OFFPEAK_WINDOW = { start: "22:00", end: "08:00", tz: "Asia/Shanghai" };

/**
 * 百炼目录（live/cli/snapshot 任一源）→ OfferRule[]：
 * (a) offpeak 档模型 → time-window(cny-price, ×0.5)；
 * (b) 普通 input 带 discount<1 → flat-cut(cny-price, 限时系数)；
 * (c) batch 维度 discount<1 → 叠加系数 batchCombined=模型×Batch（03/D2c），记在 note+batchStack。
 */
export function catalogToOffers(models: ModelEntry[], origin: OfferOrigin, snapshotDate?: string): OfferRule[] {
  const out: OfferRule[] = [];
  const offpeakModels = models.filter((m) => m.prices.some((p) => p.band === "offpeak")).map((m) => m.model.toLowerCase());
  if (offpeakModels.length) {
    out.push({
      id: "catalog-offpeak",
      kind: "time-window",
      label: "目录夜间优惠（错峰 5 折）",
      models: offpeakModels,
      unit: "cny-price",
      factor: 0.5,
      window: { ...OFFPEAK_WINDOW },
      note: "目录含 offpeak 档的模型，谷时价=峰时 5 折",
      links: [],
      origins: [origin],
      ...(snapshotDate ? { snapshotDate } : {}),
    });
  }
  for (const m of models) {
    const model = m.model.toLowerCase();
    if (offpeakModels.includes(model)) continue; // 窗口型与限时型互斥（沿用旧 buildStatus 语义）
    const std = m.prices.find((p) => p.type === "input_token" && p.discount !== undefined && p.discount < 1);
    const modelFactor = std?.discount;
    const batchEntry = m.prices.find((p) => /batch/i.test(p.type) && p.discount !== undefined && p.discount < 1);
    // 叠加规则：Batch 维度系数 = 模型限时系数 × Batch 维度系数（如 0.8 × 0.5 = 0.4）
    const batchCombined = batchEntry ? Math.round((batchEntry.discount ?? 1) * (modelFactor ?? 1) * 1000) / 1000 : undefined;
    if (modelFactor === undefined && batchCombined === undefined) continue;
    const factors: number[] = [];
    if (modelFactor !== undefined) factors.push(modelFactor);
    else if (batchCombined !== undefined) factors.push(batchCombined);
    out.push({
      id: "limited-" + model,
      kind: "flat-cut",
      label: "限时优惠",
      models: [model],
      unit: "cny-price",
      factor: factors[0],
      ...(batchCombined !== undefined ? { batchStack: batchCombined } : {}),
      note:
        modelFactor !== undefined ? `模型限时 ×${modelFactor}` + (batchCombined !== undefined ? `；Batch 叠加 ×${batchCombined}` : "") :
        `仅 Batch 维度 ×${batchCombined}`,
      links: [],
      origins: [origin],
      ...(snapshotDate ? { snapshotDate } : {}),
    });
  }
  return out;
}

function mergeKey(r: OfferRule): string {
  return [r.kind, r.unit, (r.window ? `${r.window.start}-${r.window.end}@${r.window.tz}` : "-"), r.factor ?? "-", r.baseFactor ?? "-", [...r.models].sort().join(",")].join("|");
}

/** 去重合并 + 优先级排序。同 key → origins/links 并集（双源印证行）。 */
export function mergeOffers(all: OfferRule[]): OfferRule[] {
  const byKey = new Map<string, OfferRule>();
  for (const r of all) {
    const k = mergeKey(r);
    const prev = byKey.get(k);
    if (!prev) {
      byKey.set(k, { ...r, models: [...r.models], origins: [...r.origins], links: [...r.links] });
      continue;
    }
    for (const m of r.models) if (!prev.models.includes(m)) prev.models.push(m);
    for (const o of r.origins) if (!prev.origins.includes(o)) prev.origins.push(o);
    for (const l of r.links) if (l && !prev.links.includes(l)) prev.links.push(l);
    // 快照新者胜（各携 snapshotDate，03-D2c）
    if (r.snapshotDate && (!prev.snapshotDate || r.snapshotDate > prev.snapshotDate)) prev.snapshotDate = r.snapshotDate;
  }
  const list = [...byKey.values()];
  const rank = (r: OfferRule) => Math.min(...r.origins.map(originRank));
  const kindOrder: Record<string, number> = { "time-window": 0, "flat-cut": 1, "free-calls": 2, policy: 3 };
  list.sort((a, b) => {
    const rd = rank(a) - rank(b);
    if (rd) return rd;
    const kd = kindOrder[a.kind] - kindOrder[b.kind];
    if (kd) return kd;
    const fa = a.factor ?? 1, fb = b.factor ?? 1; // 价低先
    if (fa !== fb) return fa - fb;
    return a.id.localeCompare(b.id);
  });
  return list;
}

/** origins 同时含 Qoder 与百炼系 → 「双源印证」徽标（展示层判定）。 */
export function isCrossVerified(r: { origins: OfferOrigin[] }): boolean {
  const hasQ = r.origins.includes("qoder-snapshot");
  const hasB = r.origins.some((o) => o.startsWith("bailian-"));
  return hasQ && hasB;
}
