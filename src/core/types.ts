// 核心类型 —— 优惠数据模型。core 层不 import opencode，可 node 直测。
// 0.1.4：移除 Qoder 快照，优惠数据仅来自阿里云百炼 Token Plan（live/cli/snapshot 三级回退）。

export type OfferOrigin = "bailian-live" | "bailian-cli" | "bailian-snapshot";
export type OfferKind = "time-window" | "flat-cut" | "free-calls" | "policy";
export type OfferUnit = "cny-price"; // 百炼 ¥ 价格倍率

export interface OfferRule {
  id: string;
  kind: OfferKind;
  label: string; // label 如 "错峰 5 折"
  models: string[]; // canonical id, 小写
  unit: OfferUnit;
  factor?: number;
  baseFactor?: number; // baseFactor=划线原价倍率
  window?: { start: string; end: string; tz: string }; // "HH:MM", 跨午夜=start>end
  batchStack?: number; // Batch 叠加系数(03/D2c)
  note?: string;
  expiry?: string; // free-calls/policy 文案与截止
  links: string[];
  origins: OfferOrigin[];
  snapshotDate?: string;
}

export interface DiscountEntry {
  model: string;
  applies: OfferRule[];
  /** 按 unit 分桶各取数值最小 */
  bestFactors?: Partial<Record<OfferUnit, number>>;
}

export interface WindowView {
  id: string;
  label: string;
  start: string;
  end: string;
  tz: string;
  activeNow: boolean;
  boundaryKind: "start" | "end";
  nextBoundaryAt: string; // ISO 绝对时刻, TUI 每秒本地 tick
  models: {
    model: string;
    regular?: string;
    effective?: string;
    badge?: string;
    origins: OfferOrigin[];
    links: string[];
  }[];
}

export interface StatusFile {
  schemaVersion: 1;
  writtenBy: string;
  updatedAt: string;
  staleAfterSec: number;
  timezone: "Asia/Shanghai";
  creditsPerYuan: 250;
  creditsRateNote: "据百炼计费示例换算，非官方汇率";
  sources: { catalog: OfferOrigin; error?: string };
  windows: WindowView[];
  offers: OfferRule[];
  discounts: DiscountEntry[];
  textModels: {
    model: string;
    input: string;
    cache: string;
    output: string;
    bands?: "峰/谷";
    badge?: { label: string; countdown: string };
  }[];
  quota: { available: boolean; checkedAt?: string; data?: unknown; hint?: string };
  notices: { kind: "free-calls" | "policy"; text: string; source: string; expired?: boolean }[];
}

// ── 数据层辅助类型（移植自 bailian-discount-panel.ts） ──

export interface PriceEntry {
  name: string;
  type: string;
  price: number;
  unit: string;
  band?: string;
  discount?: number;
  range?: string;
}

export interface ModelEntry {
  family: string;
  model: string;
  provider: string;
  context?: number;
  prices: PriceEntry[];
}

export type CatalogSource = "live" | "cli" | "snapshot";

export interface CatalogModel {
  source: CatalogSource;
  fetchedAt: string;
  models: ModelEntry[];
  error?: string;
}
