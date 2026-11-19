// Token Plan 个人版公开文档 → 夜间优惠规则。只取公开 HTML，不接触凭证。

import type { OfferRule } from "./types";

export const PERSONAL_PLAN_OFFERS_URL = "https://help.aliyun.com/zh/model-studio/token-plan-personal-overview#tppo-h-models";
const DOCUMENT_NAME = "官方文档 · Token Plan（个人版）概述";
const TIME_ZONE = "Asia/Shanghai";

export interface PersonalPlanOffers {
  offers: OfferRule[];
  fetchedAt: string;
  sourceUrl: string;
}

interface FetchPersonalPlanOffersOptions {
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  now?: Date;
}

function htmlText(html: string): string {
  const entities: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#x[\da-f]+|#\d+|amp|apos|gt|lt|nbsp|quot);/gi, (entity, key: string) => {
      if (key[0] !== "#") return entities[key.toLowerCase()] ?? entity;
      const hex = key[1]?.toLowerCase() === "x";
      const value = Number.parseInt(key.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isSafeInteger(value) && value >= 0 && value <= 0x10ffff ? String.fromCodePoint(value) : entity;
    })
    .replace(/[\u200b\u200c\u200d\ufeff]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function discountValue(raw: string): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0 || value > 10) throw new Error(`文档折数无效：${raw}`);
  return value;
}

export function chineseDiscount(value: number): string {
  if (value === 10) return "十";
  const digits: Record<string, string> = { "0": "零", "1": "一", "2": "二", "3": "三", "4": "四", "5": "五", "6": "六", "7": "七", "8": "八", "9": "九", ".": "点" };
  return String(value).split("").map((char) => digits[char] ?? char).join("");
}

function timePart(hour: string, minute: string): string {
  const h = Number(hour);
  const m = Number(minute);
  if (!Number.isInteger(h) || h < 0 || h > 23 || !Number.isInteger(m) || m < 0 || m > 59) {
    throw new Error(`文档时间无效：${hour}:${minute}`);
  }
  return `${String(h).padStart(2, "0")}:${minute}`;
}

function readWindow(text: string): NonNullable<OfferRule["window"]> {
  const match = text.match(/每晚\s*(\d{1,2})\s*:\s*(\d{2})\s*(?:-|–|—|~|～|至)\s*(?:次日\s*)?(\d{1,2})\s*:\s*(\d{2})/i);
  if (!match) throw new Error("文档夜间活动缺少 HH:MM 时间窗口");
  return { start: timePart(match[1], match[2]), end: timePart(match[3], match[4]), tz: TIME_ZONE };
}

function readModels(raw: string): string[] {
  const models = [...new Set(raw.split(/\s*(?:、|，|,|和|及)\s*/).map((model) => model.trim().toLowerCase()).filter(Boolean))];
  if (!models.length || models.some((model) => !/^[a-z0-9][a-z0-9._-]*$/i.test(model))) {
    throw new Error(`文档模型列表无法识别：${raw}`);
  }
  return models;
}

function parseOffers(section: string, fetchedAt: string): OfferRule[] {
  const freeModels = new Set(
    [...section.matchAll(/([a-z0-9][a-z0-9._-]*)\s+限时免费\s*[：:]\s*调用不消耗\s*Credits/gi)].map((match) => match[1].toLowerCase()),
  );
  const offers: OfferRule[] = [];
  const date = fetchedAt.slice(0, 10);
  const addRule = (id: string, label: string, models: string[], factor: number, window: NonNullable<OfferRule["window"]>, baseFactor?: number) => {
    const applicable = models.filter((model) => !freeModels.has(model));
    if (!applicable.length) return;
    offers.push({
      id,
      kind: "time-window",
      label,
      models: applicable,
      unit: "cny-price",
      factor,
      ...(baseFactor !== undefined ? { baseFactor } : {}),
      window,
      note: baseFactor === undefined ? DOCUMENT_NAME : `${DOCUMENT_NAME} · 预览活动与夜间折扣叠加`,
      links: [PERSONAL_PLAN_OFFERS_URL],
      origins: ["bailian-live"],
      snapshotDate: date,
    });
  };

  // 预览活动是基础折扣，夜间“再享”必须相乘，不能当成普通夜间折扣覆盖基础价。
  const previewPattern = /([a-z0-9][a-z0-9._-]*)\s+预览权益\s*[：:]([^。]*)/gi;
  for (const match of section.matchAll(previewPattern)) {
    const model = match[1].toLowerCase();
    const text = match[2];
    if (!/再享|每晚/.test(text)) continue;
    const base = text.match(/低至\s*(\d+(?:\.\d+)?)\s*折/);
    const night = text.match(/再享\s*(\d+(?:\.\d+)?)\s*折/);
    if (!base || !night) throw new Error(`文档预览活动字段不完整：${model}`);
    const baseDiscount = discountValue(base[1]);
    const nightDiscount = discountValue(night[1]);
    const window = readWindow(text);
    // 组合系数做定点舍入：0.2 × 0.4 的浮点结果是 0.08000000000000002。
    const factor = Math.round((baseDiscount / 10) * (nightDiscount / 10) * 1000) / 1000;
    addRule(
      `doc-preview-night-${model}`,
      `Token Plan 预览${chineseDiscount(baseDiscount)}折 · 夜间再${chineseDiscount(nightDiscount)}折`,
      [model],
      factor,
      window,
      baseDiscount / 10,
    );
  }

  const nightIndex = section.search(/限时夜间折扣/);
  if (nightIndex >= 0) {
    const tail = section.slice(nightIndex);
    const stop = tail.search(/。|限时免费|阿里云百炼有权/);
    const nightText = stop >= 0 ? tail.slice(0, stop) : tail;
    const window = readWindow(nightText);
    const callCount = nightText.match(/调用/g)?.length ?? 0;
    const groups = [...nightText.matchAll(/调用\s+(.+?)\s*享\s*(\d+(?:\.\d+)?)\s*折/g)];
    if (!callCount || groups.length !== callCount) throw new Error("文档夜间折扣缺少可识别的模型组或折数");
    for (const group of groups) {
      const models = readModels(group[1]);
      const discount = discountValue(group[2]);
      const timeKey = `${window.start.replace(":", "")}-${window.end.replace(":", "")}`;
      addRule(
        `doc-night-${timeKey}-${models[0]}`,
        `Token Plan 夜间${chineseDiscount(discount)}折`,
        models,
        discount / 10,
        window,
      );
    }
  }

  if (!offers.length) throw new Error("文档不含任何可识别的夜间模型优惠");
  return offers;
}

export async function fetchPersonalPlanOffers(opts: FetchPersonalPlanOffersOptions = {}): Promise<PersonalPlanOffers> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const response = await fetchImpl(PERSONAL_PLAN_OFFERS_URL, {
    signal: opts.signal,
    headers: { accept: "text/html" },
  });
  if (!response.ok) throw new Error(`Token Plan 文档请求失败：HTTP ${response.status}`);
  const text = htmlText(await response.text());
  const sectionStart = text.indexOf("支持的模型");
  if (sectionStart < 0) throw new Error("Token Plan 文档缺少“支持的模型”区域");
  const rest = text.slice(sectionStart);
  const sectionEnd = rest.slice("支持的模型".length).search(/支持的模型内置工具|订阅管理/);
  const section = sectionEnd >= 0 ? rest.slice(0, sectionEnd + "支持的模型".length) : rest;
  const fetchedAt = (opts.now ?? new Date()).toISOString();
  return { offers: parseOffers(section, fetchedAt), fetchedAt, sourceUrl: PERSONAL_PLAN_OFFERS_URL };
}
