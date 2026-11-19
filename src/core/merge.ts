// 统一优惠模型合并（03-D2）：目录→Offer 转换 → 去重合并 → 优先级排序。
// 0.1.4：移除 Qoder 快照，优惠数据仅来自阿里云百炼 Token Plan。
// 合并前多 model 规则拆 per-model（m1），仅当 (kind, model, 窗口, factor, unit)
// 全等才合并（origins 并集=多源印证）。

import type { ModelEntry, OfferOrigin, OfferRule } from "./types";

/** 小写归一。 */
export function canonicalize(model: string): string {
  return String(model || "").toLowerCase();
}

/** 展示优先级：bailian-live > bailian-cli > bailian-snapshot */
export function originRank(origin: OfferOrigin): number {
  return { "bailian-live": 0, "bailian-cli": 1, "bailian-snapshot": 2 }[origin];
}

/**
 * 目录仅补充普通限时/Batch 降价；时窗唯一来自实时官方文档，避免静态价格目录再造夜间优惠。
 * 已有文档时窗的模型不再派生 flat-cut，保持窗口/限时互斥。
 */
export function catalogToOffers(models: ModelEntry[], origin: OfferOrigin, snapshotDate?: string, documentRules: OfferRule[] = []): OfferRule[] {
  const out: OfferRule[] = [];
  const windowedModels = new Set<string>(
    documentRules.filter((rule) => rule.kind === "time-window").flatMap((rule) => rule.models.map((model) => model.toLowerCase())),
  );
  for (const m of models) {
    const model = m.model.toLowerCase();
    if (windowedModels.has(model)) continue; // 已有 time-window offer → 不再出限时型
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

/** m1：多 model 规则拆成 per-model 行再合并（id 加 `#model` 后缀）；≤1 model（含 notices 空集）原样。 */
function explodePerModel(rules: OfferRule[]): OfferRule[] {
  const out: OfferRule[] = [];
  for (const r of rules) {
    if (r.models.length <= 1) { out.push(r); continue; }
    for (const m of new Set(r.models)) out.push({ ...r, id: `${r.id}#${m}`, models: [m] });
  }
  return out;
}

/** 去重合并 + 优先级排序。同 key（per-model 全等）→ origins/links 并集。 */
export function mergeOffers(all: OfferRule[]): OfferRule[] {
  const byKey = new Map<string, OfferRule>();
  for (const r of explodePerModel(all)) {
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
