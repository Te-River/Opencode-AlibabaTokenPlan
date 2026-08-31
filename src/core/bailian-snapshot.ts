// 百炼内置快照（源3）+ 目录解析 —— 1:1 移植自 bailian-discount-panel.ts。
// live/cli 抓取函数在 server 内（03 包结构），本文件只放纯数据与纯函数。

import type { ModelEntry, PriceEntry } from "./types";

// 1 元 = 250 Credits（经官方计费示例逐分验证：qwen3.6-plus 输入 8349tok→1.67Cr 等）
// —— 仅作展示换算注记，来源标注「百炼计费示例验证，非官方汇率」(03-D2d)。
export const CREDITS_PER_YUAN = 250;

export const BAILIAN_SNAPSHOT_AT = "2026-08-30";

// Token Plan 个人版支持的文本模型（主表筛选）
export const TOKEN_PLAN_TEXT_MODELS = [
  "qwen3.8-max",
  "qwen3.8-flash",
  "qwen3.7-max",
  "qwen3.7-plus",
  "qwen3.6-plus",
  "qwen3.6-flash",
  "glm-5.2",
  "deepseek-v4-pro-0813",
];

// 官方文档确认的窗口型优惠（时间均为北京时间）。数据源=bailian-snapshot。
export const BAILIAN_WINDOW_RULES: {
  id: string;
  label: string;
  models: string[];
  factor: number;
  start: string;
  end: string;
  source: string;
}[] = [
  {
    id: "night-qwen38-max",
    label: "Token Plan 夜间五折",
    models: ["qwen3.8-max"],
    factor: 0.5,
    start: "22:00",
    end: "08:00",
    source: "官方文档 · Token Plan（个人版）概述",
  },
  {
    id: "night-deepseek-v4-pro",
    label: "Token Plan 夜间五折",
    models: ["deepseek-v4-pro-0813"],
    factor: 0.5,
    start: "22:00",
    end: "08:00",
    source: "官方文档 · Token Plan（个人版）概述",
  },
];

export function bailianSnapshotModels(): ModelEntry[] {
  const P = (name: string, type: string, price: number, unit = "每百万tokens", band?: string, discount?: number): PriceEntry =>
    ({ name, type, price, unit, ...(band ? { band } : {}), ...(discount !== undefined ? { discount } : {}) });
  return [
    {
      family: "qwen3.8-max", model: "qwen3.8-max", provider: "qwen", context: 1_000_000,
      prices: [P("输入", "input_token", 12), P("输出", "output_token", 36), P("输入（缓存命中）", "input_token_cache", 1.5), P("输入（Batch Chat）", "input_token_batch_chat", 12, "每百万tokens", undefined, 0.5), P("输出（Batch Chat）", "output_token_batch_chat", 36, "每百万tokens", undefined, 0.5)],
    },
    {
      family: "qwen3.8-flash", model: "qwen3.8-flash", provider: "qwen", context: 1_000_000,
      prices: [P("输入", "input_token", 0.8), P("输出", "output_token", 2.7), P("输入（缓存命中）", "input_token_cache", 0.1)],
    },
    {
      family: "qwen3.7-max", model: "qwen3.7-max", provider: "qwen", context: 1_000_000,
      prices: [P("输入", "input_token", 12), P("输出", "output_token", 36), P("输入（缓存命中）", "input_token_cache", 2.4), P("输入", "input_token", 12, "每百万tokens", "standard", 0.5)],
    },
    {
      family: "qwen3.6-plus", model: "qwen3.6-plus", provider: "qwen", context: 1_000_000,
      prices: [P("输入", "input_token", 0.8), P("输出", "output_token", 4.8), P("输入（缓存命中）", "input_token_cache", 0.08)],
    },
    {
      family: "deepseek", model: "deepseek-v4-pro-0813", provider: "deepseek", context: 1_000_000,
      prices: [P("输入", "input_token", 9, "每百万tokens", "peak"), P("输入", "input_token", 4.5, "每百万tokens", "offpeak"), P("输出", "output_token", 27, "每百万tokens", "peak"), P("输出", "output_token", 13.5, "每百万tokens", "offpeak"), P("输入（缓存命中）", "input_token_cache", 0.9, "每百万tokens", "peak"), P("输入（缓存命中）", "input_token_cache", 0.45, "每百万tokens", "offpeak")],
    },
    {
      family: "deepseek", model: "deepseek-v4-pro", provider: "deepseek", context: 1_000_000,
      prices: [P("输入", "input_token", 12), P("输出", "output_token", 24), P("输入（缓存命中）", "input_token_cache", 1)],
    },
    {
      family: "glm-5.2", model: "glm-5.2", provider: "zhipu", context: 200_000,
      prices: [P("输入", "input_token", 8), P("输出", "output_token", 28), P("输入（缓存命中）", "input_token_cache", 2)],
    },
    {
      family: "wan-video", model: "wan-video", provider: "wan",
      prices: [P("视频生成（480P）", "video_ratio_480p", 0.45, "每秒"), P("视频生成（720P）", "video_ratio_720p", 0.9, "每秒"), P("视频生成（1080P）", "video_ratio_1080p", 1.8, "每秒"), P("视频生成（720P·限时）", "video_ratio_720p", 0.6, "每秒", undefined, 0.7)],
    },
    {
      family: "qwen-image", model: "qwen-image", provider: "qwen",
      prices: [P("图片生成", "image_number", 0.25, "每张")],
    },
    {
      family: "qwen-image-plus", model: "qwen-image-plus", provider: "qwen",
      prices: [P("图片生成", "image_number", 0.2, "每张")],
    },
  ];
}

/** 解析 listFoundationModels 平铺条目 → ModelEntry[]（旧文件 1:1 移植，去 any 噪音）。 */
export function parseGroups(list: any[]): ModelEntry[] {
  const out: ModelEntry[] = [];
  const byName = new Set<string>();
  for (const g of list || []) {
    // group:false 平铺模式：每个条目即一个模型，multiPrices 含完整阶梯价与限时折扣
    const items = Array.isArray(g.items) && g.items.length ? g.items : [g];
    for (const it of items) {
      const model = String(it.model || "");
      if (!model) continue;
      const m = model.match(/^(.*)-\d{4}-\d{2}-\d{2}$/);
      if (m && byName.has(m[1])) continue; // 快照版本与正式版并存时只保留正式版
      const prices: PriceEntry[] = [];
      const mp = Array.isArray(it.multiPrices) ? it.multiPrices : [];
      if (mp.length) {
        for (const range of mp) {
          for (const p of range.prices || []) {
            prices.push({
              name: p.priceName ?? p.type ?? "",
              type: p.type ?? "",
              price: Number(p.price),
              unit: p.priceUnit ?? "",
              ...(p.timeBand ? { band: p.timeBand } : {}),
              ...(p.discount !== undefined && p.discount !== null ? { discount: Number(p.discount) } : {}),
              ...(range.rangeName ? { range: range.rangeName } : {}),
            });
          }
        }
      } else if (Array.isArray(it.prices)) {
        for (const p of it.prices) {
          prices.push({
            name: p.priceName ?? p.type ?? "",
            type: p.type ?? "",
            price: Number(p.price),
            unit: p.priceUnit ?? "",
            ...(p.timeBand ? { band: p.timeBand } : {}),
            ...(p.discount !== undefined && p.discount !== null ? { discount: Number(p.discount) } : {}),
          });
        }
      }
      byName.add(model);
      out.push({ family: model, model, provider: it.provider ?? g.provider ?? "", context: it.contextWindow, prices });
    }
  }
  return out;
}
