// Qoder 优惠快照 —— 04 号契约 §3 数据表全量转录（快照日 2026-08-31）。
//
// 隐私红线（03-D8④）：本模块与包内任何代码 **绝不** fetch / 调用
// Qoder 的任何私有端点（其网关/openapi 子域一律不出现、不请求）。
// 这里只是静态快照数据 + 对外文档链接（links 仅作展示字符串）。
// 更新方式：手工修订本文件并重发版（见 README「快照更新流程」）。

import type { OfferRule } from "./types";

export const QODER_SNAPSHOT_DATE = "2026-08-31";
export const QODER_ORIGIN_LABEL = "Qoder 快照 2026-08-31";

const W_OFFPEAK = { start: "22:00", end: "08:00", tz: "Asia/Shanghai" } as const;

const L_QWENMAX = "https://docs.qoder.cn/events/qwen-max";
const L_QWEN37 = "https://docs.qoder.cn/product-overview/qwen-3-7-series-model-staggering-discount";
const L_OFFPEAK_RULES = "https://help.aliyun.com/document_detail/3042139.html";
const L_ULTIMATE = "https://docs.qoder.com/zh/events/ultimatediscount";
const L_CANTUS = "https://docs.qoder.com/zh/events/cantuslaunch";
const L_FREECALLS = "https://docs.qoder.com/zh/events/ultimatefreecalls";
const L_REFERRAL = "https://qoder.cn/referral";

/** §3 表逐条 → OfferRule。来源串固定「Qoder 快照 2026-08-31」。 */
export function qoderSnapshotOffers(): OfferRule[] {
  const S = QODER_SNAPSHOT_DATE;
  const o = (r: Omit<OfferRule, "origins" | "snapshotDate">): OfferRule => ({
    ...r,
    origins: ["qoder-snapshot"],
    snapshotDate: S,
  });
  return [
    o({
      id: "atp-offpeak-qwen38",
      kind: "time-window",
      label: "错峰 5 折（Off-Peak 50% off）",
      models: ["qwen3.8-max"],
      unit: "credits-factor",
      factor: 0.25,
      baseFactor: 0.5,
      window: { ...W_OFFPEAK },
      note: "常规 0.5x → 错峰时段 0.25x（5 折）",
      links: [L_QWENMAX],
    }),
    o({
      id: "atp-offpeak-qwen37max",
      kind: "time-window",
      label: "错峰 2 折（Off-Peak 80% off）",
      models: ["qwen3.7-max"],
      unit: "credits-factor",
      factor: 0.1,
      baseFactor: 0.5,
      window: { ...W_OFFPEAK },
      note: "常规 0.5x → 错峰时段 0.1x（2 折）",
      links: [L_QWEN37],
    }),
    o({
      id: "atp-offpeak-qwen37plus",
      kind: "time-window",
      label: "错峰 4 折（Off-Peak 60% off）",
      models: ["qwen3.7-plus"],
      unit: "credits-factor",
      factor: 0.04,
      baseFactor: 0.1,
      window: { ...W_OFFPEAK },
      note: "常规 0.1x → 错峰时段 0.04x（4 折）",
      links: [L_QWEN37],
    }),
    o({
      id: "atp-flat-preview",
      kind: "flat-cut",
      label: "限时 1 折",
      models: ["qwen3.8-max-preview"],
      unit: "credits-factor",
      factor: 0.1,
      note: "模型描述原文：常规时段 1 折",
      links: [L_OFFPEAK_RULES],
    }),
    o({
      id: "atp-flat-glm53f",
      kind: "flat-cut",
      label: "划线半价（0.1 → 0.05）",
      models: ["glm-5.3-flash"],
      unit: "credits-factor",
      factor: 0.05,
      baseFactor: 0.1,
      note: "originalPriceFactor 结构，无 promotion 标记（快照）",
      links: [L_OFFPEAK_RULES],
    }),
    o({
      id: "atp-flat-ultimate",
      kind: "flat-cut",
      label: "限时折扣进行中",
      models: ["ultimate", "cantus"],
      unit: "credits-factor",
      note: "数值未公开，仅活动文案（快照）",
      links: [L_ULTIMATE, L_CANTUS],
    }),
    o({
      id: "atp-free-200",
      kind: "free-calls",
      label: "极致模型 200 次免费",
      models: [],
      unit: "credits-factor",
      note: "免费额度活动；已过期（expired:true）",
      expiry: "2026-07-30T23:59:59+08:00",
      links: [L_FREECALLS],
    }),
    o({
      id: "atp-free-800-2000",
      kind: "free-calls",
      label: "qwen3.8-max 800/2000 次免费（claim）",
      models: ["qwen3.8-max"],
      unit: "credits-factor",
      note: "activityId: qwen38_800_invoke / qwen38_2000_invoke（快照）",
      links: [],
    }),
    o({
      id: "atp-referral",
      kind: "policy",
      label: "推荐返积分 ≤40000+",
      models: [],
      unit: "credits-factor",
      note: "推荐活动至 2026-09-03",
      expiry: "2026-09-03T23:59:59+08:00",
      links: [L_REFERRAL],
    }),
    o({
      id: "atp-lite",
      kind: "policy",
      label: "lite 基础模型降级政策",
      models: ["lite"],
      unit: "credits-factor",
      note: "Credits 耗尽后降级为 lite 基础模型（免费/每日限额/高峰时段变慢）；余额 <200 低额提示；首月 prorated（快照）",
      links: [],
    }),
  ];
}

/**
 * §3 表 E 行「在卖常规倍率表」——非优惠，供「当前会话模型倍率行」展示基线。
 * 来源：Qoder 快照 2026-08-31（state.vscdb 转录）。kimi-k2.7-code highspeed=0.6。
 */
export const QODER_INSALE_FACTORS: Record<string, { factor: number; note?: string }> = {
  auto: { factor: 0.5 },
  "qwen3.8-flash": { factor: 0.1 },
  "qwen3.7-flash": { factor: 0.1 },
  "deepseek-v4-pro": { factor: 0.8 },
  "deepseek-v4-flash": { factor: 0.3 },
  "glm-5.3": { factor: 0.6 },
  "glm-5.2": { factor: 0.6 },
  "kimi-k2.7-code": { factor: 0.3, note: "highspeed 0.6" },
  "minimax-m2.7": { factor: 0.2 },
};
