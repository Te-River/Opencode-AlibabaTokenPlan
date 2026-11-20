// src/tui/index.tsx
import { createComponent as _$createComponent4 } from "@opentui/solid";
import { Plugin } from "@opencode/plugin/tui";

// src/tui/state.ts
import { onCleanup, createSignal } from "solid-js";

// src/core/bailian-snapshot.ts
var CREDITS_PER_YUAN = 250;
var BAILIAN_SNAPSHOT_AT = "2026-08-30";
var TOKEN_PLAN_TEXT_MODELS = [
  "qwen3.8-max",
  "qwen3.8-flash",
  "qwen3.7-max",
  "qwen3.7-plus",
  "qwen3.6-plus",
  "qwen3.6-flash",
  "glm-5.2",
  "deepseek-v4-pro-0813"
];
function bailianSnapshotModels() {
  const P = (name, type, price, unit = "\u6BCF\u767E\u4E07tokens", band, discount) => ({ name, type, price, unit, ...band ? { band } : {}, ...discount !== void 0 ? { discount } : {} });
  return [
    {
      family: "qwen3.8-max",
      model: "qwen3.8-max",
      provider: "qwen",
      context: 1e6,
      prices: [P("\u8F93\u5165", "input_token", 12), P("\u8F93\u51FA", "output_token", 36), P("\u8F93\u5165\uFF08\u7F13\u5B58\u547D\u4E2D\uFF09", "input_token_cache", 1.5), P("\u8F93\u5165\uFF08Batch Chat\uFF09", "input_token_batch_chat", 12, "\u6BCF\u767E\u4E07tokens", void 0, 0.5), P("\u8F93\u51FA\uFF08Batch Chat\uFF09", "output_token_batch_chat", 36, "\u6BCF\u767E\u4E07tokens", void 0, 0.5)]
    },
    {
      family: "qwen3.8-flash",
      model: "qwen3.8-flash",
      provider: "qwen",
      context: 1e6,
      prices: [P("\u8F93\u5165", "input_token", 0.8), P("\u8F93\u51FA", "output_token", 2.7), P("\u8F93\u5165\uFF08\u7F13\u5B58\u547D\u4E2D\uFF09", "input_token_cache", 0.1)]
    },
    {
      family: "qwen3.7-max",
      model: "qwen3.7-max",
      provider: "qwen",
      context: 1e6,
      prices: [P("\u8F93\u5165", "input_token", 12), P("\u8F93\u51FA", "output_token", 36), P("\u8F93\u5165\uFF08\u7F13\u5B58\u547D\u4E2D\uFF09", "input_token_cache", 2.4), P("\u8F93\u5165", "input_token", 12, "\u6BCF\u767E\u4E07tokens", "standard", 0.5)]
    },
    {
      family: "qwen3.6-plus",
      model: "qwen3.6-plus",
      provider: "qwen",
      context: 1e6,
      prices: [P("\u8F93\u5165", "input_token", 0.8), P("\u8F93\u51FA", "output_token", 4.8), P("\u8F93\u5165\uFF08\u7F13\u5B58\u547D\u4E2D\uFF09", "input_token_cache", 0.08)]
    },
    {
      family: "deepseek",
      model: "deepseek-v4-pro-0813",
      provider: "deepseek",
      context: 1e6,
      prices: [P("\u8F93\u5165", "input_token", 9, "\u6BCF\u767E\u4E07tokens", "peak"), P("\u8F93\u5165", "input_token", 4.5, "\u6BCF\u767E\u4E07tokens", "offpeak"), P("\u8F93\u51FA", "output_token", 27, "\u6BCF\u767E\u4E07tokens", "peak"), P("\u8F93\u51FA", "output_token", 13.5, "\u6BCF\u767E\u4E07tokens", "offpeak"), P("\u8F93\u5165\uFF08\u7F13\u5B58\u547D\u4E2D\uFF09", "input_token_cache", 0.9, "\u6BCF\u767E\u4E07tokens", "peak"), P("\u8F93\u5165\uFF08\u7F13\u5B58\u547D\u4E2D\uFF09", "input_token_cache", 0.45, "\u6BCF\u767E\u4E07tokens", "offpeak")]
    },
    {
      family: "deepseek",
      model: "deepseek-v4-pro",
      provider: "deepseek",
      context: 1e6,
      prices: [P("\u8F93\u5165", "input_token", 12), P("\u8F93\u51FA", "output_token", 24), P("\u8F93\u5165\uFF08\u7F13\u5B58\u547D\u4E2D\uFF09", "input_token_cache", 1)]
    },
    {
      family: "glm-5.2",
      model: "glm-5.2",
      provider: "zhipu",
      context: 2e5,
      prices: [P("\u8F93\u5165", "input_token", 8), P("\u8F93\u51FA", "output_token", 28), P("\u8F93\u5165\uFF08\u7F13\u5B58\u547D\u4E2D\uFF09", "input_token_cache", 2)]
    },
    {
      family: "wan-video",
      model: "wan-video",
      provider: "wan",
      prices: [P("\u89C6\u9891\u751F\u6210\uFF08480P\uFF09", "video_ratio_480p", 0.45, "\u6BCF\u79D2"), P("\u89C6\u9891\u751F\u6210\uFF08720P\uFF09", "video_ratio_720p", 0.9, "\u6BCF\u79D2"), P("\u89C6\u9891\u751F\u6210\uFF081080P\uFF09", "video_ratio_1080p", 1.8, "\u6BCF\u79D2"), P("\u89C6\u9891\u751F\u6210\uFF08720P\xB7\u9650\u65F6\uFF09", "video_ratio_720p", 0.6, "\u6BCF\u79D2", void 0, 0.7)]
    },
    {
      family: "qwen-image",
      model: "qwen-image",
      provider: "qwen",
      prices: [P("\u56FE\u7247\u751F\u6210", "image_number", 0.25, "\u6BCF\u5F20")]
    },
    {
      family: "qwen-image-plus",
      model: "qwen-image-plus",
      provider: "qwen",
      prices: [P("\u56FE\u7247\u751F\u6210", "image_number", 0.2, "\u6BCF\u5F20")]
    }
  ];
}

// src/core/merge.ts
function originRank(origin) {
  return { "bailian-live": 0, "bailian-cli": 1, "bailian-snapshot": 2 }[origin];
}
function catalogToOffers(models, origin, snapshotDate, documentRules = []) {
  const out = [];
  const windowedModels = new Set(
    documentRules.filter((rule) => rule.kind === "time-window").flatMap((rule) => rule.models.map((model) => model.toLowerCase()))
  );
  for (const m of models) {
    const model = m.model.toLowerCase();
    if (windowedModels.has(model)) continue;
    const std = m.prices.find((p) => p.type === "input_token" && p.discount !== void 0 && p.discount < 1);
    const modelFactor = std?.discount;
    const batchEntry = m.prices.find((p) => /batch/i.test(p.type) && p.discount !== void 0 && p.discount < 1);
    const batchCombined = batchEntry ? Math.round((batchEntry.discount ?? 1) * (modelFactor ?? 1) * 1e3) / 1e3 : void 0;
    if (modelFactor === void 0 && batchCombined === void 0) continue;
    const factors = [];
    if (modelFactor !== void 0) factors.push(modelFactor);
    else if (batchCombined !== void 0) factors.push(batchCombined);
    out.push({
      id: "limited-" + model,
      kind: "flat-cut",
      label: "\u9650\u65F6\u4F18\u60E0",
      models: [model],
      unit: "cny-price",
      factor: factors[0],
      ...batchCombined !== void 0 ? { batchStack: batchCombined } : {},
      note: modelFactor !== void 0 ? `\u6A21\u578B\u9650\u65F6 \xD7${modelFactor}` + (batchCombined !== void 0 ? `\uFF1BBatch \u53E0\u52A0 \xD7${batchCombined}` : "") : `\u4EC5 Batch \u7EF4\u5EA6 \xD7${batchCombined}`,
      links: [],
      origins: [origin],
      ...snapshotDate ? { snapshotDate } : {}
    });
  }
  return out;
}
function mergeKey(r) {
  return [r.kind, r.unit, r.window ? `${r.window.start}-${r.window.end}@${r.window.tz}` : "-", r.factor ?? "-", r.baseFactor ?? "-", [...r.models].sort().join(",")].join("|");
}
function explodePerModel(rules) {
  const out = [];
  for (const r of rules) {
    if (r.models.length <= 1) {
      out.push(r);
      continue;
    }
    for (const m of new Set(r.models)) out.push({ ...r, id: `${r.id}#${m}`, models: [m] });
  }
  return out;
}
function mergeOffers(all) {
  const byKey = /* @__PURE__ */ new Map();
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
    if (r.snapshotDate && (!prev.snapshotDate || r.snapshotDate > prev.snapshotDate)) prev.snapshotDate = r.snapshotDate;
  }
  const list = [...byKey.values()];
  const rank = (r) => Math.min(...r.origins.map(originRank));
  const kindOrder = { "time-window": 0, "flat-cut": 1, "free-calls": 2, policy: 3 };
  list.sort((a, b) => {
    const rd = rank(a) - rank(b);
    if (rd) return rd;
    const kd = kindOrder[a.kind] - kindOrder[b.kind];
    if (kd) return kd;
    const fa = a.factor ?? 1, fb = b.factor ?? 1;
    if (fa !== fb) return fa - fb;
    return a.id.localeCompare(b.id);
  });
  return list;
}

// src/core/discount-doc.ts
var PERSONAL_PLAN_OFFERS_URL = "https://help.aliyun.com/zh/model-studio/token-plan-personal-overview#tppo-h-models";
var DOCUMENT_NAME = "\u5B98\u65B9\u6587\u6863 \xB7 Token Plan\uFF08\u4E2A\u4EBA\u7248\uFF09\u6982\u8FF0";
var TIME_ZONE = "Asia/Shanghai";
function htmlText(html) {
  const entities = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"'
  };
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ").replace(/<!--[\s\S]*?-->/g, " ").replace(/<[^>]+>/g, " ").replace(/&(#x[\da-f]+|#\d+|amp|apos|gt|lt|nbsp|quot);/gi, (entity, key) => {
    if (key[0] !== "#") return entities[key.toLowerCase()] ?? entity;
    const hex = key[1]?.toLowerCase() === "x";
    const value = Number.parseInt(key.slice(hex ? 2 : 1), hex ? 16 : 10);
    return Number.isSafeInteger(value) && value >= 0 && value <= 1114111 ? String.fromCodePoint(value) : entity;
  }).replace(/[\u200b\u200c\u200d\ufeff]/g, "").replace(/\s+/g, " ").trim();
}
function discountValue(raw) {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0 || value > 10) throw new Error(`\u6587\u6863\u6298\u6570\u65E0\u6548\uFF1A${raw}`);
  return value;
}
function chineseDiscount(value) {
  if (value === 10) return "\u5341";
  const digits = { "0": "\u96F6", "1": "\u4E00", "2": "\u4E8C", "3": "\u4E09", "4": "\u56DB", "5": "\u4E94", "6": "\u516D", "7": "\u4E03", "8": "\u516B", "9": "\u4E5D", ".": "\u70B9" };
  return String(value).split("").map((char) => digits[char] ?? char).join("");
}
function timePart(hour, minute) {
  const h = Number(hour);
  const m = Number(minute);
  if (!Number.isInteger(h) || h < 0 || h > 23 || !Number.isInteger(m) || m < 0 || m > 59) {
    throw new Error(`\u6587\u6863\u65F6\u95F4\u65E0\u6548\uFF1A${hour}:${minute}`);
  }
  return `${String(h).padStart(2, "0")}:${minute}`;
}
function readWindow(text) {
  const match = text.match(/每晚\s*(\d{1,2})\s*:\s*(\d{2})\s*(?:-|–|—|~|～|至)\s*(?:次日\s*)?(\d{1,2})\s*:\s*(\d{2})/i);
  if (!match) throw new Error("\u6587\u6863\u591C\u95F4\u6D3B\u52A8\u7F3A\u5C11 HH:MM \u65F6\u95F4\u7A97\u53E3");
  return { start: timePart(match[1], match[2]), end: timePart(match[3], match[4]), tz: TIME_ZONE };
}
function readModels(raw) {
  const models = [...new Set(raw.split(/\s*(?:、|，|,|和|及)\s*/).map((model) => model.trim().toLowerCase()).filter(Boolean))];
  if (!models.length || models.some((model) => !/^[a-z0-9][a-z0-9._-]*$/i.test(model))) {
    throw new Error(`\u6587\u6863\u6A21\u578B\u5217\u8868\u65E0\u6CD5\u8BC6\u522B\uFF1A${raw}`);
  }
  return models;
}
function parseOffers(section, fetchedAt) {
  const freeModels = new Set(
    [...section.matchAll(/([a-z0-9][a-z0-9._-]*)\s+限时免费\s*[：:]\s*调用不消耗\s*Credits/gi)].map((match) => match[1].toLowerCase())
  );
  const offers = [];
  const date = fetchedAt.slice(0, 10);
  const addRule = (id, label, models, factor, window, baseFactor) => {
    const applicable = models.filter((model) => !freeModels.has(model));
    if (!applicable.length) return;
    offers.push({
      id,
      kind: "time-window",
      label,
      models: applicable,
      unit: "cny-price",
      factor,
      ...baseFactor !== void 0 ? { baseFactor } : {},
      window,
      note: baseFactor === void 0 ? DOCUMENT_NAME : `${DOCUMENT_NAME} \xB7 \u9884\u89C8\u6D3B\u52A8\u4E0E\u591C\u95F4\u6298\u6263\u53E0\u52A0`,
      links: [PERSONAL_PLAN_OFFERS_URL],
      origins: ["bailian-live"],
      snapshotDate: date
    });
  };
  const previewPattern = /([a-z0-9][a-z0-9._-]*)\s+预览权益\s*[：:]([^。]*)/gi;
  for (const match of section.matchAll(previewPattern)) {
    const model = match[1].toLowerCase();
    const text = match[2];
    if (!/再享|每晚/.test(text)) continue;
    const base = text.match(/低至\s*(\d+(?:\.\d+)?)\s*折/);
    const night = text.match(/再享\s*(\d+(?:\.\d+)?)\s*折/);
    if (!base || !night) throw new Error(`\u6587\u6863\u9884\u89C8\u6D3B\u52A8\u5B57\u6BB5\u4E0D\u5B8C\u6574\uFF1A${model}`);
    const baseDiscount = discountValue(base[1]);
    const nightDiscount = discountValue(night[1]);
    const window = readWindow(text);
    const factor = Math.round(baseDiscount / 10 * (nightDiscount / 10) * 1e3) / 1e3;
    addRule(
      `doc-preview-night-${model}`,
      `Token Plan \u9884\u89C8${chineseDiscount(baseDiscount)}\u6298 \xB7 \u591C\u95F4\u518D${chineseDiscount(nightDiscount)}\u6298`,
      [model],
      factor,
      window,
      baseDiscount / 10
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
    if (!callCount || groups.length !== callCount) throw new Error("\u6587\u6863\u591C\u95F4\u6298\u6263\u7F3A\u5C11\u53EF\u8BC6\u522B\u7684\u6A21\u578B\u7EC4\u6216\u6298\u6570");
    for (const group of groups) {
      const models = readModels(group[1]);
      const discount = discountValue(group[2]);
      const timeKey = `${window.start.replace(":", "")}-${window.end.replace(":", "")}`;
      addRule(
        `doc-night-${timeKey}-${models[0]}`,
        `Token Plan \u591C\u95F4${chineseDiscount(discount)}\u6298`,
        models,
        discount / 10,
        window
      );
    }
  }
  if (!offers.length) throw new Error("\u6587\u6863\u4E0D\u542B\u4EFB\u4F55\u53EF\u8BC6\u522B\u7684\u591C\u95F4\u6A21\u578B\u4F18\u60E0");
  return offers;
}
async function fetchPersonalPlanOffers(opts = {}) {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const response = await fetchImpl(PERSONAL_PLAN_OFFERS_URL, {
    signal: opts.signal,
    headers: { accept: "text/html" }
  });
  if (!response.ok) throw new Error(`Token Plan \u6587\u6863\u8BF7\u6C42\u5931\u8D25\uFF1AHTTP ${response.status}`);
  const text = htmlText(await response.text());
  const sectionStart = text.indexOf("\u652F\u6301\u7684\u6A21\u578B");
  if (sectionStart < 0) throw new Error("Token Plan \u6587\u6863\u7F3A\u5C11\u201C\u652F\u6301\u7684\u6A21\u578B\u201D\u533A\u57DF");
  const rest = text.slice(sectionStart);
  const sectionEnd = rest.slice("\u652F\u6301\u7684\u6A21\u578B".length).search(/支持的模型内置工具|订阅管理/);
  const section = sectionEnd >= 0 ? rest.slice(0, sectionEnd + "\u652F\u6301\u7684\u6A21\u578B".length) : rest;
  const fetchedAt = (opts.now ?? /* @__PURE__ */ new Date()).toISOString();
  return { offers: parseOffers(section, fetchedAt), fetchedAt, sourceUrl: PERSONAL_PLAN_OFFERS_URL };
}

// src/core/rules.ts
var SH_OFFSET_MIN = 8 * 60;
var DAY_MIN = 1440;
function shanghaiMinutes(now = /* @__PURE__ */ new Date()) {
  const shifted = new Date(now.getTime() + (now.getTimezoneOffset() + SH_OFFSET_MIN) * 6e4);
  return shifted.getHours() * 60 + shifted.getMinutes() + shifted.getSeconds() / 60;
}
function parseHm(s) {
  const [h, min] = s.split(":").map(Number);
  return h * 60 + (min || 0);
}
function windowState(rule, now = /* @__PURE__ */ new Date()) {
  const start = parseHm(rule.start);
  const end = parseHm(rule.end);
  const m = shanghaiMinutes(now);
  const wraps = start > end;
  const active = wraps ? m >= start || m < end : m >= start && m < end;
  let toNext;
  let kind;
  if (active) {
    toNext = wraps ? m >= start ? end + DAY_MIN - m : end - m : end - m;
    kind = "end";
  } else {
    toNext = m < start ? start - m : start + DAY_MIN - m;
    kind = "start";
  }
  return {
    active,
    minutesToNextBoundary: Math.max(0, Math.round(toNext)),
    boundaryKind: kind,
    nextBoundaryAtMs: now.getTime() + toNext * 6e4,
    nextBoundaryAt: shanghaiISO(now.getTime() + toNext * 6e4)
  };
}
function shanghaiISO(ms) {
  const d = new Date(ms + SH_OFFSET_MIN * 6e4);
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return d.getUTCFullYear() + "-" + p(d.getUTCMonth() + 1) + "-" + p(d.getUTCDate()) + "T" + p(d.getUTCHours()) + ":" + p(d.getUTCMinutes()) + ":" + p(d.getUTCSeconds()) + "." + p(d.getUTCMilliseconds(), 3) + "+08:00";
}
function fmtCountdown(mins) {
  if (mins <= 0) return "\u4E0D\u8DB3 1 \u5206\u949F";
  const d = Math.floor(mins / DAY_MIN);
  const h = Math.floor(mins % DAY_MIN / 60);
  const m = mins % 60;
  const parts = [];
  if (d) parts.push(d + " \u5929");
  if (h) parts.push(h + " \u5C0F\u65F6");
  parts.push(m + " \u5206\u949F");
  return parts.join(" ");
}
function fmtHMS(msRemaining) {
  const total = Math.max(0, Math.floor(msRemaining / 1e3));
  const h = Math.floor(total / 3600);
  const m = Math.floor(total % 3600 / 60);
  const s = total % 60;
  const p = (n) => String(n).padStart(2, "0");
  return `${p(h)}:${p(m)}:${p(s)}`;
}
function fmtShortDur(msRemaining) {
  if (msRemaining <= 0) return "0s";
  if (msRemaining < 6e4) return `${Math.ceil(msRemaining / 1e3)}s`;
  const total = Math.floor(msRemaining / 6e4);
  const d = Math.floor(total / DAY_MIN);
  const h = Math.floor(total % DAY_MIN / 60);
  const m = total % 60;
  if (d) return `${d}d${h}h`;
  if (h) return `${h}h${m}m`;
  return `${m}m`;
}

// src/core/status.ts
import * as path from "node:path";
import * as os from "node:os";
var STALE_AFTER_SEC = 600;
var CATALOG_ORIGIN = {
  live: "bailian-live",
  cli: "bailian-cli",
  snapshot: "bailian-snapshot"
};
function windowId(start, end) {
  if (start === "22:00" && end === "08:00") return "offpeak-22-08";
  return `win-${start.replace(":", "")}-${end.replace(":", "")}`;
}
function buildOffers(catalog, documentRules = []) {
  const origin = CATALOG_ORIGIN[catalog.source] ?? "bailian-snapshot";
  return mergeOffers([
    ...documentRules,
    ...catalogToOffers(catalog.models, origin, catalog.fetchedAt?.slice(0, 10), documentRules)
  ]);
}
function zheOf(factor) {
  return Math.round(factor * 1e3) / 100;
}
function windowLabel(rules) {
  const zhe = [...new Set(rules.flatMap((rule) => rule.factor === void 0 ? [] : [zheOf(rule.factor)]))];
  if (!zhe.length) return rules[0]?.label ?? "Token Plan \u591C\u95F4\u6298\u6263";
  const lo = Math.min(...zhe);
  const hi = Math.max(...zhe);
  return lo === hi ? `Token Plan \u591C\u95F4${chineseDiscount(lo)}\u6298` : `Token Plan \u591C\u95F4\u6298\u6263 ${lo}\u2013${hi} \u6298`;
}
function buildWindows(offers, now) {
  const byWindow = /* @__PURE__ */ new Map();
  for (const r of offers) {
    if (r.kind !== "time-window" || !r.window) continue;
    const key = `${r.window.start}-${r.window.end}@${r.window.tz}`;
    let g = byWindow.get(key);
    if (!g) {
      g = { ...r.window, rules: [] };
      byWindow.set(key, g);
    }
    g.rules.push(r);
  }
  const out = [];
  for (const g of byWindow.values()) {
    const w = windowState(g, now);
    const models = [];
    for (const r of g.rules) {
      for (const m of r.models) {
        models.push({
          model: m,
          regular: fmtFactor(r.baseFactor),
          effective: fmtFactor(r.factor),
          badge: r.label,
          origins: r.origins,
          links: r.links
        });
      }
    }
    models.sort((a, b) => {
      const fa = parseFloat(a.effective ?? "1"), fb = parseFloat(b.effective ?? "1");
      if (fa !== fb) return fa - fb;
      return a.model.localeCompare(b.model);
    });
    const sourceDate = g.rules.reduce((latest, rule) => rule.snapshotDate && (!latest || rule.snapshotDate > latest) ? rule.snapshotDate : latest, void 0);
    const label = windowLabel(g.rules) + (sourceDate ? ` \xB7 \u6587\u6E90 ${sourceDate}` : "");
    out.push({
      id: windowId(g.start, g.end),
      label,
      start: g.start,
      end: g.end,
      tz: g.tz,
      activeNow: w.active,
      boundaryKind: w.boundaryKind,
      nextBoundaryAt: w.nextBoundaryAt,
      models
    });
  }
  out.sort((a, b) => Number(b.id.startsWith("offpeak")) - Number(a.id.startsWith("offpeak")) || a.start.localeCompare(b.start));
  return out;
}
function fmtFactor(f) {
  if (f === void 0 || !Number.isFinite(f)) return void 0;
  let s = f.toFixed(2);
  s = s.replace(/0+$/, "").replace(/\.$/, ".0");
  return s + "x";
}
function buildDiscounts(offers) {
  const byModel = /* @__PURE__ */ new Map();
  for (const r of offers) {
    if (r.kind === "free-calls" || r.kind === "policy") continue;
    for (const m of r.models) {
      const arr = byModel.get(m) ?? [];
      arr.push(r);
      byModel.set(m, arr);
    }
  }
  const out = [];
  for (const [model, applies] of byModel) {
    const bestFactors = {};
    for (const r of applies) {
      if (r.factor === void 0) continue;
      const cur = bestFactors[r.unit];
      if (cur === void 0 || r.factor < cur) bestFactors[r.unit] = r.factor;
    }
    out.push({
      model,
      applies,
      ...Object.keys(bestFactors).length ? { bestFactors } : {}
    });
  }
  const lowest = (d) => {
    const vs = Object.values(d.bestFactors ?? {});
    return vs.length ? Math.min(...vs) : 1;
  };
  const seriesOrder = (n) => /^qwen/.test(n) ? 0 : /^(deepseek|glm|kimi|minimax)/.test(n) ? 1 : 2;
  out.sort((a, b) => {
    const fa = lowest(a), fb = lowest(b);
    if (fa !== fb) return fa - fb;
    const sd = seriesOrder(a.model) - seriesOrder(b.model);
    if (sd) return sd;
    return a.model.localeCompare(b.model);
  });
  return out;
}
function pickPrice(prices, type, band) {
  return prices.find((p) => p.type === type && (band ? p.band === band : !p.band || p.band === "standard"));
}
function creditsPerM(price) {
  const v = price * CREDITS_PER_YUAN;
  return Number.isInteger(v) ? v.toLocaleString("en-US") : String(Number(v.toFixed(1)));
}
function buildTextModels(models, windows, now) {
  return TOKEN_PLAN_TEXT_MODELS.map((name) => {
    const m = models.find((x) => x.model === name) || models.find((x) => x.family === name);
    let badge;
    for (const w of windows) {
      if (w.models.some((x) => x.model === name)) {
        const ws = windowState(w, now);
        badge = {
          label: w.label,
          countdown: ws.active ? `${fmtCountdown(ws.minutesToNextBoundary)}\u540E\u7ED3\u675F\uFF08${w.end}\uFF09` : `${fmtCountdown(ws.minutesToNextBoundary)}\u540E\u5F00\u59CB\uFF08${w.start}\uFF09`
        };
        break;
      }
    }
    if (!m) {
      return { model: name, input: "\u2014", cache: "\u2014", output: "\u2014", ...badge ? { badge } : {} };
    }
    const peakIn = pickPrice(m.prices, "input_token", "peak");
    const offIn = pickPrice(m.prices, "input_token", "offpeak");
    const stdIn = pickPrice(m.prices, "input_token");
    const stdOut = pickPrice(m.prices, "output_token", "peak") || pickPrice(m.prices, "output_token");
    const offOut = pickPrice(m.prices, "output_token", "offpeak");
    const stdCache = pickPrice(m.prices, "input_token_cache", "peak") || pickPrice(m.prices, "input_token_cache") || pickPrice(m.prices, "input_token_cache_read");
    const offCache = pickPrice(m.prices, "input_token_cache", "offpeak") || pickPrice(m.prices, "input_token_cache_read", "offpeak");
    const dual = !!(peakIn && offIn);
    const pair = (a, b) => a ? b ? `${creditsPerM(a.price)} / ${creditsPerM(b.price)}` : creditsPerM(a.price) : "\u2014";
    return {
      model: name,
      input: dual ? pair(peakIn, offIn) : pair(stdIn),
      cache: dual ? pair(stdCache, offCache) : pair(stdCache),
      output: dual ? pair(stdOut, offOut) : pair(stdOut),
      ...dual ? { bands: "\u5CF0/\u8C37" } : {},
      ...badge ? { badge } : {}
    };
  });
}
function buildNotices(offers, now) {
  return offers.filter((r) => r.kind === "free-calls" || r.kind === "policy").map((r) => ({
    kind: r.kind,
    text: `${r.label}${r.note ? " \u2014 " + r.note : ""}`,
    source: r.origins[0] ?? "unknown",
    expired: r.expiry ? new Date(r.expiry).getTime() < now.getTime() : void 0
  }));
}
function buildStatus(catalog, now = /* @__PURE__ */ new Date(), quota, documentRules = []) {
  const offers = buildOffers(catalog, documentRules);
  const windows = buildWindows(offers, now);
  return {
    schemaVersion: 1,
    writtenBy: "@te-river/opencode-alibabatokenplan@0.2.0",
    // 0.2.0 无 server 进程：这只是 payload 身份标记
    updatedAt: now.toISOString(),
    staleAfterSec: STALE_AFTER_SEC,
    timezone: "Asia/Shanghai",
    creditsPerYuan: CREDITS_PER_YUAN,
    creditsRateNote: "\u636E\u767E\u70BC\u8BA1\u8D39\u793A\u4F8B\u6362\u7B97\uFF0C\u975E\u5B98\u65B9\u6C47\u7387",
    sources: {
      catalog: CATALOG_ORIGIN[catalog.source] ?? "bailian-snapshot",
      ...catalog.error ? { error: catalog.error } : {}
    },
    windows,
    offers,
    discounts: buildDiscounts(offers),
    textModels: buildTextModels(catalog.models, windows, now),
    quota: quota ?? { available: false, hint: "\u672A\u6388\u6743 \xB7 \u6253\u5F00 /tokenplan \u6388\u6743" },
    notices: buildNotices(offers, now)
  };
}
function stateDir() {
  return process.env.ATP_STATE_DIR || path.join(os.homedir(), ".cache", "opencode", "alibabatokenplan");
}

// src/core/status-model.ts
function buildDiscountSnapshot(now = /* @__PURE__ */ new Date(), document) {
  const st = buildStatus(
    { source: "snapshot", models: bailianSnapshotModels(), fetchedAt: BAILIAN_SNAPSHOT_AT },
    now,
    void 0,
    document?.offers ?? []
  );
  return {
    catalog: "bailian-snapshot",
    snapshotDate: document?.fetchedAt.slice(0, 10) ?? BAILIAN_SNAPSHOT_AT,
    windows: st.windows,
    offers: st.offers,
    discounts: st.discounts,
    textModels: st.textModels,
    notices: st.notices
  };
}
function buildMergedStatus(quota, now = /* @__PURE__ */ new Date(), document, periods, series) {
  const status = {
    schemaVersion: 2,
    updatedAt: now.toISOString(),
    quota,
    discount: buildDiscountSnapshot(now, document)
  };
  if (periods) status.usagePeriods = periods;
  if (series) status.usageSeries = series;
  return status;
}

// src/core/quota/redact.ts
var PATTERNS = [
  [/Bearer\s+[A-Za-z0-9._~+/=-]{6,}/gi, "Bearer ***"],
  // JWT（access_token 常见形态）
  [/eyJ[A-Za-z0-9_-]{7,}\.[A-Za-z0-9_-]{7,}\.[A-Za-z0-9_-]{4,}/g, "***"],
  // key=value / key: value 形式的 token 类键
  [/(("|')?(?:access_token|accessToken|innertoken|innerToken|sessionid|sessionId|ticket|cookie|Cookie|authorization)(?:"|')?\s*[:=]\s*("|')?)([^"'\s,;&}]{6,})/g, "$1***"],
  // Cookie 整串：name=<长值>
  [/([A-Za-z0-9_][A-Za-z0-9_.-]{1,}=)([^;\s"']{12,})/g, "$1***"]
];
function redact(value) {
  let s;
  if (typeof value === "string") s = value;
  else if (value instanceof Error) s = value.message;
  else {
    try {
      s = typeof value === "object" ? JSON.stringify(value) : String(value);
    } catch {
      s = "unserializable error";
    }
  }
  for (const [re, rep] of PATTERNS) s = s.replace(re, rep);
  return s;
}

// src/core/quota/decode.ts
var GatewayError = class extends Error {
  code;
  constructor(message, code = "") {
    super(redact(message).slice(0, 120));
    this.name = "GatewayError";
    this.code = code;
  }
};
var round2 = (n) => Math.round(n * 100) / 100;
function isLoginInvalid(text) {
  return /NotLogged|NeedLogin|NotLogin|ConsoleNeedLogin/i.test(String(text ?? ""));
}
function unwrap(payload) {
  const p = payload;
  const rawCode = p?.code;
  const code = rawCode == null ? "" : String(rawCode);
  if (code !== "" && code !== "200" && !p?.successResponse) {
    throw new GatewayError(p?.message ?? p?.errorMsg ?? code, code);
  }
  const data = p?.data;
  if (data && typeof data === "object" && data.success === false) {
    throw new GatewayError(data.errorCode ?? data.errorMsg ?? data.message ?? "request failed", String(data.errorCode ?? code));
  }
  if (data && typeof data === "object" && data.DataV2 && typeof data.DataV2 === "object" && "data" in data.DataV2) {
    return data.DataV2.data;
  }
  return data ?? p;
}
function pickNested(src, keys, fields) {
  if (!src || typeof src !== "object" || Array.isArray(src)) return src;
  for (const k of keys) {
    const v = src[k];
    if (v && typeof v === "object" && !Array.isArray(v)) return v;
  }
  const d = src.data;
  if (d && typeof d === "object" && !Array.isArray(d) && fields.some((f) => d[f] != null)) return d;
  return src;
}
var normalizeInstance = (raw) => pickNested(raw, ["instanceInfo", "instance", "subscription"], ["status", "subStatus", "specCode", "remainingDays", "endTime"]);
var normalizeUsage = (raw) => pickNested(raw, ["usage", "usageInfo"], ["per1WeekPercentage", "per1MonthPercentage", "per5HourPercentage"]);
var normalizeAddonSummary = (raw) => pickNested(raw, ["summary", "addonSummary"], ["totalCredits", "remainingCredits", "activeCount"]);
function ratioToPercent(v) {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return round2(Math.min(100, Math.max(0, v * 100)));
}
function formatTs(v) {
  if (v == null || v === "") return "-";
  if (typeof v !== "number" || !Number.isFinite(v)) return String(v);
  const ms = v > 1e12 ? v : v * 1e3;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return String(v);
  const p2 = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
}
function toEpochMs(v) {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  const ms = v > 1e12 ? v : v * 1e3;
  return Number.isNaN(new Date(ms).getTime()) ? null : ms;
}
var USAGE_KEYS = [
  { key: "per1WeekPercentage", window: "week" },
  { key: "per1MonthPercentage", window: "month" },
  { key: "per5HourPercentage", window: "5h" }
];
function pickUsageWindow(usageRaw) {
  const u = normalizeUsage(usageRaw);
  if (!u || typeof u !== "object") return null;
  for (const { key, window } of USAGE_KEYS) {
    const used = ratioToPercent(u[key]);
    if (used == null) continue;
    const resetRaw = u[key.replace("Percentage", "ResetTime")];
    return {
      window,
      usedPercent: used,
      remainingPercent: round2(Math.max(0, 100 - used)),
      resetTime: resetRaw == null || resetRaw === "" ? null : formatTs(resetRaw),
      resetAtMs: toEpochMs(resetRaw)
    };
  }
  return null;
}
function normalizePlan(raw) {
  const i = normalizeInstance(raw);
  const status = typeof i?.status === "string" ? i.status : typeof i?.subStatus === "string" ? i.subStatus : null;
  const endRaw = i?.endTime;
  return {
    status,
    specCode: typeof i?.specCode === "string" ? i.specCode : null,
    remainingDays: typeof i?.remainingDays === "number" && Number.isFinite(i.remainingDays) ? i.remainingDays : null,
    endTime: endRaw == null || endRaw === "" ? null : formatTs(endRaw),
    endAtMs: toEpochMs(endRaw)
  };
}
function normalizeAddon(raw) {
  const a = normalizeAddonSummary(raw);
  const total = typeof a?.totalCredits === "number" && Number.isFinite(a.totalCredits) ? a.totalCredits : null;
  const remaining = typeof a?.remainingCredits === "number" && Number.isFinite(a.remainingCredits) ? a.remainingCredits : null;
  let usedPercent = null;
  if (total != null && total > 0 && remaining != null) {
    const used = Math.min(total, Math.max(0, total - remaining));
    usedPercent = round2(used / total * 100);
  }
  return {
    totalCredits: total,
    remainingCredits: remaining,
    activeCount: typeof a?.activeCount === "number" && Number.isFinite(a.activeCount) ? a.activeCount : null,
    usedPercent
  };
}
function normalizeQwenwork(raw) {
  const num = (v) => typeof v === "number" && Number.isFinite(v) ? v : null;
  const q = raw;
  return { credits: num(q?.credits) ?? num(q?.data?.credits) ?? num(q?.data?.data?.credits) };
}
function classifyError(e) {
  const message = redact(e).slice(0, 120);
  if (e instanceof GatewayError || e?.name === "GatewayError") {
    const code = String(e.code ?? "");
    if (code === "401" || code === "403") return { kind: "unauthorized", message };
    if (isLoginInvalid(code) || isLoginInvalid(message)) return { kind: "unauthorized", message };
    if (code === "not-json") return { kind: "parse", message };
    if (/NoPermission/i.test(code + " " + message)) return { kind: "parse", message };
    if (/^\d{3}$/.test(code)) return { kind: "network", message };
    return { kind: "unknown", message };
  }
  const name = String(e?.name ?? "");
  if (name === "AbortError" || name === "TimeoutError" || e instanceof TypeError) return { kind: "network", message };
  return { kind: "unknown", message };
}

// src/core/quota/credentials.ts
import { spawn as spawn2 } from "node:child_process";
import * as fs2 from "node:fs";
import * as path3 from "node:path";

// src/core/quota/request.ts
import { randomBytes, randomUUID } from "node:crypto";
var PAGE_URL = "https://bailian.console.aliyun.com/cn-beijing/subscription/token-plan/personal";
var GATEWAY_ORIGIN = "https://bailian.console.aliyun.com";
var REGION = "cn-beijing";
var DATA_URL = "https://bailian-cs.console.aliyun.com/data/api.json";
var CLI_URL = "https://bailian-cs.console.aliyun.com/cli/api.json";
var API = {
  subscription: "zeldaHttp.apikeyMgr./tokenplan/personal/api/v2/subscription",
  usage: "zeldaHttp.apikeyMgr./tokenplan/personal/api/v2/usage",
  addon: "zeldaHttp.apikeyMgr./tokenplan/personal/api/v2/addon/summary",
  qwenwork: "zeldaHttp.apikeyMgr./qwenwork/tokenplan/personal/api/v1/qwenwork_details",
  /** 服务端遥测小时序列（近 7 天 / 近 5h token 用量的唯一来源）。 */
  modelMonitor: "zeldaEasy.bailian-telemetry.platform-model.getModelMonitorDataWithOss"
};
var COMMODITY = {
  solo: "sfm_tokenplansolo_public_cn",
  addon: "sfm_tokenplansoloaddon_public_cn"
};
function buildCornerstone() {
  return {
    feTraceId: randomUUID(),
    feURL: PAGE_URL,
    protocol: "V2",
    console: "ONE_CONSOLE",
    productCode: "p_efm",
    switchUserType: 3,
    // 数字，不是字符串
    domain: "bailian.console.aliyun.com",
    consoleSite: "BAILIAN_ALIYUN",
    xsp_lang: "zh-CN",
    "X-Anonymous-Id": randomBytes(18).toString("base64").replace(/[^A-Za-z0-9]/g, "").slice(0, 24).padEnd(24, "0")
  };
}
function buildGatewayUrl(api, channel = "data") {
  const q = new URLSearchParams({ action: "BroadScopeAspnGateway", product: "sfm_bailian", api, _v: "" });
  return `${channel === "cli" ? CLI_URL : DATA_URL}?${q.toString()}`;
}
function buildRequestBody(api, data, secToken2) {
  const params = { Api: api, V: "1.0", Data: { ...data, cornerstoneParam: buildCornerstone() } };
  const form = { params: JSON.stringify(params), region: REGION };
  if (secToken2) form.sec_token = secToken2;
  return new URLSearchParams(form).toString();
}
function baseHeaders() {
  return {
    Origin: GATEWAY_ORIGIN,
    Referer: PAGE_URL,
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "application/json",
    "User-Agent": "token-plan-quota/1.0"
  };
}

// src/core/quota/browsers.ts
import { spawn, spawnSync as spawnSync2 } from "node:child_process";
import * as fs from "node:fs";
import * as net from "node:net";
import * as os2 from "node:os";
import * as path2 from "node:path";

// src/core/quota/default-browser.ts
import { spawnSync } from "node:child_process";
var IDENT_RULES = [
  { test: /operagx/i, id: "opera-gx" },
  { test: /opera/i, id: "opera" },
  { test: /microsoft-?edge|edgemac|msedge/i, id: "edge" },
  { test: /chromium/i, id: "chromium" },
  { test: /chrome/i, id: "chrome" },
  { test: /brave/i, id: "brave" },
  { test: /vivaldi/i, id: "vivaldi" },
  { test: /firefox/i, id: "firefox" }
];
function identToBrowser(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  for (const r of IDENT_RULES) if (r.test.test(s)) return r.id;
  return null;
}
function parseRegProgId(text) {
  const m = /^\s*ProgId\s+REG_SZ\s+(\S+)\s*$/im.exec(String(text ?? ""));
  return m ? m[1] : null;
}
function run(cmd, args) {
  try {
    const r = spawnSync(cmd, args, { encoding: "utf8", timeout: 2e3, windowsHide: true });
    return r.status === 0 && typeof r.stdout === "string" ? r.stdout : null;
  } catch {
    return null;
  }
}
var WIN_USER_CHOICE = "HKCU\\SOFTWARE\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\https\\UserChoice";
function resolveDefaultBrowser() {
  try {
    if (process.platform === "win32") {
      const out2 = run("reg", ["query", WIN_USER_CHOICE, "/v", "ProgId"]);
      const progId = out2 ? parseRegProgId(out2) : null;
      return progId ? identToBrowser(progId) : null;
    }
    if (process.platform === "darwin") {
      const out2 = run("defaults", ["read", "com.apple.LaunchServices/com.apple.launchservices.secure", "LSHandlers"]);
      if (!out2) return null;
      for (const block of out2.split("}")) {
        if (!/LSHandlerURLScheme\s*=\s*"?https"?\s*;/i.test(block)) continue;
        const m = /LSHandlerRoleAll\s*=\s*"?([\w.\-]+)"?/i.exec(block);
        if (m) return identToBrowser(m[1]);
      }
      return null;
    }
    const out = run("xdg-settings", ["get", "default-web-browser"]);
    return out && out.trim() ? identToBrowser(out.trim()) : null;
  } catch {
    return null;
  }
}

// src/core/quota/browsers.ts
var CDP_READY_MS = 6e3;
var POLL_MS = 300;
function firstExisting(paths) {
  for (const p of paths) {
    try {
      if (p && fs.existsSync(p)) return p;
    } catch {
    }
  }
  return null;
}
function localAppData() {
  return process.env.LOCALAPPDATA ?? path2.join(os2.homedir(), "AppData", "Local");
}
function roamingAppData() {
  return process.env.APPDATA ?? path2.join(os2.homedir(), "AppData", "Roaming");
}
function computeStateRoot() {
  const override = process.env.ATP_STATE_ROOT?.trim();
  if (override) return path2.resolve(override);
  return process.env.LOCALAPPDATA ? path2.join(process.env.LOCALAPPDATA, "alibabatokenplan") : path2.join(os2.homedir(), ".config", "alibabatokenplan");
}
function legacyStateRoot() {
  return process.env.LOCALAPPDATA ? path2.join(process.env.LOCALAPPDATA, "opencode", "alibabatokenplan") : path2.join(os2.homedir(), ".config", "opencode", "alibabatokenplan");
}
var migrated = false;
function moveEntry(src, dst, recursive) {
  if (!fs.existsSync(src) || fs.existsSync(dst)) return;
  try {
    fs.mkdirSync(path2.dirname(dst), { recursive: true });
    fs.renameSync(src, dst);
  } catch {
    try {
      fs.cpSync(src, dst, { recursive });
      fs.rmSync(src, { recursive, force: true });
    } catch {
    }
  }
}
function ensureMigrated() {
  if (migrated) return;
  migrated = true;
  const next = computeStateRoot();
  const prev = legacyStateRoot();
  if (path2.resolve(next) === path2.resolve(prev)) return;
  moveEntry(path2.join(prev, "credential.json"), path2.join(next, "credential.json"), false);
  moveEntry(path2.join(prev, "settings.json"), path2.join(next, "settings.json"), false);
  moveEntry(path2.join(prev, "browsers"), path2.join(next, "browsers"), true);
}
function stateRoot() {
  ensureMigrated();
  return computeStateRoot();
}
function winDefs() {
  const pf = process.env.ProgramFiles ?? "C:\\Program Files";
  const pf86 = process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)";
  const la = localAppData();
  const ra = roamingAppData();
  return [
    {
      id: "edge",
      label: "Microsoft Edge",
      family: "chromium",
      exe: [
        path2.join(pf86, "Microsoft", "Edge", "Application", "msedge.exe"),
        path2.join(pf, "Microsoft", "Edge", "Application", "msedge.exe"),
        path2.join(la, "Microsoft", "Edge", "Application", "msedge.exe")
      ]
    },
    {
      id: "chrome",
      label: "Google Chrome",
      family: "chromium",
      exe: [
        path2.join(pf, "Google", "Chrome", "Application", "chrome.exe"),
        path2.join(pf86, "Google", "Chrome", "Application", "chrome.exe"),
        path2.join(la, "Google", "Chrome", "Application", "chrome.exe")
      ]
    },
    {
      id: "brave",
      label: "Brave",
      family: "chromium",
      exe: [
        path2.join(pf, "BraveSoftware", "Brave-Browser", "Application", "brave.exe"),
        path2.join(la, "BraveSoftware", "Brave-Browser", "Application", "brave.exe")
      ]
    },
    {
      id: "chromium",
      label: "Chromium",
      family: "chromium",
      exe: [path2.join(la, "Chromium", "Application", "chrome.exe"), path2.join(pf, "Chromium", "Application", "chrome.exe")]
    },
    {
      id: "vivaldi",
      label: "Vivaldi",
      family: "chromium",
      exe: [path2.join(la, "Vivaldi", "Application", "vivaldi.exe"), path2.join(pf, "Vivaldi", "Application", "vivaldi.exe")]
    },
    {
      id: "opera-gx",
      label: "Opera GX",
      family: "chromium",
      exe: [path2.join(la, "Programs", "Opera GX", "opera.exe")]
    },
    {
      id: "opera",
      label: "Opera",
      family: "chromium",
      exe: [path2.join(la, "Programs", "Opera", "opera.exe")]
    },
    {
      id: "firefox",
      label: "Firefox",
      family: "firefox",
      exe: [path2.join(pf, "Mozilla Firefox", "firefox.exe"), path2.join(pf86, "Mozilla Firefox", "firefox.exe")],
      firefoxProfiles: [path2.join(ra, "Mozilla", "Firefox", "Profiles")]
    }
  ];
}
function nixDefs(platform) {
  const home = os2.homedir();
  if (platform === "darwin") {
    const app = (name) => `/Applications/${name}.app/Contents/MacOS/${name}`;
    return [
      { id: "chrome", label: "Google Chrome", family: "chromium", exe: [app("Google Chrome")] },
      { id: "edge", label: "Microsoft Edge", family: "chromium", exe: [app("Microsoft Edge")] },
      { id: "brave", label: "Brave", family: "chromium", exe: [app("Brave Browser")] },
      { id: "chromium", label: "Chromium", family: "chromium", exe: [app("Chromium")] },
      { id: "vivaldi", label: "Vivaldi", family: "chromium", exe: [app("Vivaldi")] },
      { id: "opera", label: "Opera", family: "chromium", exe: [app("Opera")] },
      { id: "firefox", label: "Firefox", family: "firefox", exe: [app("Firefox")], firefoxProfiles: [path2.join(home, "Library/Application Support/Firefox/Profiles")] }
    ];
  }
  const bin = (cmd) => [`/usr/bin/${cmd}`, `/usr/local/bin/${cmd}`, `/snap/bin/${cmd}`];
  return [
    { id: "chromium", label: "Chromium", family: "chromium", exe: [...bin("chromium"), ...bin("chromium-browser")] },
    { id: "chrome", label: "Google Chrome", family: "chromium", exe: [...bin("google-chrome"), ...bin("google-chrome-stable")] },
    { id: "brave", label: "Brave", family: "chromium", exe: [...bin("brave-browser")] },
    { id: "edge", label: "Microsoft Edge", family: "chromium", exe: [...bin("microsoft-edge"), ...bin("microsoft-edge-stable")] },
    { id: "vivaldi", label: "Vivaldi", family: "chromium", exe: [...bin("vivaldi")] },
    { id: "opera", label: "Opera", family: "chromium", exe: [...bin("opera")] },
    { id: "firefox", label: "Firefox", family: "firefox", exe: [...bin("firefox")], firefoxProfiles: [path2.join(home, ".mozilla/firefox")] }
  ];
}
function browserDefs() {
  if (process.platform === "win32") return winDefs();
  const table = process.platform === "darwin" ? nixDefs("darwin") : nixDefs("linux");
  const order = ["chromium", "chrome", "brave", "edge", "vivaldi", "opera", "firefox"];
  const byId = new Map(table.map((d) => [d.id, d]));
  return order.map((id) => byId.get(id)).filter((d) => !!d);
}
function firstFirefoxProfile(dirs) {
  for (const root of dirs) {
    let entries;
    try {
      entries = fs.readdirSync(root);
    } catch {
      continue;
    }
    const withCookies = entries.map((e) => path2.join(root, e)).find((p) => {
      try {
        return fs.statSync(p).isDirectory() && fs.existsSync(path2.join(p, "cookies.sqlite"));
      } catch {
        return false;
      }
    });
    if (withCookies) return withCookies;
    const anyDir = entries.map((e) => path2.join(root, e)).find((p) => {
      try {
        return fs.statSync(p).isDirectory();
      } catch {
        return false;
      }
    });
    if (anyDir) return anyDir;
  }
  return null;
}
var sqliteCapability = null;
function sqliteSpecifier(host) {
  return [host, "sqlite"].join(":");
}
async function openSqlite(file) {
  try {
    const bun = await import(sqliteSpecifier("bun"));
    if (bun?.Database) return new bun.Database(file, { readonly: true });
  } catch {
  }
  try {
    const node = await import(sqliteSpecifier("node"));
    if (node?.DatabaseSync) return new node.DatabaseSync(file, { readOnly: true });
  } catch {
  }
  return null;
}
async function canUseSqlite() {
  if (sqliteCapability !== null) return sqliteCapability;
  const db = await openSqlite(":memory:");
  if (db) {
    try {
      db.close?.();
    } catch {
    }
    sqliteCapability = true;
  } else {
    sqliteCapability = false;
  }
  return sqliteCapability;
}
var cached = null;
function blConfigPath() {
  return path2.join(os2.homedir(), ".bailian", "config.json");
}
function settingsPath() {
  return path2.join(stateRoot(), "settings.json");
}
function readSettings() {
  for (const file of [settingsPath(), path2.join(legacyStateRoot(), "settings.json")]) {
    try {
      const raw = JSON.parse(fs.readFileSync(file, "utf8"));
      return { browser: typeof raw?.browser === "string" ? raw.browser : void 0, adapter: typeof raw?.adapter === "string" ? raw.adapter : void 0 };
    } catch {
    }
  }
  return {};
}
var ADAPTER_IDS = ["cdp-own-profile", "firefox-sqlite", "manual-paste", "bl"];
function adapterForFamily(family) {
  return family === "firefox" ? "firefox-sqlite" : "cdp-own-profile";
}
function pickPreferred(adapters, browsers, def) {
  const s = readSettings();
  if (s.adapter && ADAPTER_IDS.includes(s.adapter) && adapters.includes(s.adapter)) return s.adapter;
  const wanted = browsers.find((b) => b.id === s.browser) ?? browsers.find((b) => b.id === def);
  if (wanted) {
    const a = adapterForFamily(wanted.family);
    if (adapters.includes(a)) return a;
  }
  return adapters[0] ?? null;
}
function safeDefault(resolve2) {
  try {
    return resolve2();
  } catch {
    return null;
  }
}
async function detect(refresh = false, resolveDefault = resolveDefaultBrowser) {
  if (!refresh && cached) return cached;
  const found = [];
  for (const def2 of browserDefs()) {
    const exe = firstExisting(def2.exe);
    if (!exe) continue;
    const userDataDir = def2.firefoxProfiles ? firstFirefoxProfile(def2.firefoxProfiles) : null;
    found.push({ id: def2.id, label: def2.label, exe, userDataDir, family: def2.family });
  }
  const def = safeDefault(resolveDefault);
  const browsers = def ? [...found.filter((b) => b.id === def), ...found.filter((b) => b.id !== def)] : found;
  const canSqlite = await canUseSqlite();
  const hasWebSocket = typeof globalThis.WebSocket === "function";
  const adapters = [];
  if (hasWebSocket && browsers.some((b) => b.family === "chromium")) adapters.push("cdp-own-profile");
  if (canSqlite && browsers.some((b) => b.family === "firefox" && b.userDataDir)) adapters.push("firefox-sqlite");
  adapters.push("manual-paste");
  try {
    if (fs.existsSync(blConfigPath())) adapters.push("bl");
  } catch {
  }
  const preferred = pickPreferred(adapters, browsers, def);
  cached = { browsers, adapters: preferred ? [preferred, ...adapters.filter((a) => a !== preferred)] : adapters, preferred, canUseSqlite: canSqlite };
  return cached;
}
function sleepOrAbort(ms, signal) {
  return new Promise((resolve2, reject) => {
    const t = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve2();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(new Error("aborted"));
    };
    if (signal.aborted) {
      clearTimeout(t);
      reject(new Error("aborted"));
      return;
    }
    signal.addEventListener("abort", onAbort, { once: true });
  });
}
function freePort() {
  return new Promise((resolve2, reject) => {
    const srv = net.createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      srv.close(() => port ? resolve2(port) : reject(new Error("no free port")));
    });
  });
}
function ownProfilesRoot() {
  return path2.join(stateRoot(), "browsers");
}
function ownProfileDir(browserId) {
  return path2.join(ownProfilesRoot(), browserId, "profile");
}
async function versionEndpoint(port, timeoutMs = 1e3) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
async function cdpReady(port) {
  const v = await versionEndpoint(port);
  const ws = typeof v?.webSocketDebuggerUrl === "string" ? v.webSocketDebuggerUrl : "";
  if (!ws) return false;
  try {
    return new URL(ws).port === String(port);
  } catch {
    return false;
  }
}
async function launchChromium(browser, signal) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const port = await freePort();
    const profile = ownProfileDir(browser.id);
    const child = spawn(
      browser.exe,
      [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check", PAGE_URL],
      { detached: false, stdio: "ignore", windowsHide: false }
    );
    const handle = { browserId: browser.id, pid: child.pid ?? -1, port, child };
    const deadline = Date.now() + CDP_READY_MS;
    while (Date.now() < deadline) {
      if (child.exitCode !== null) break;
      if (await cdpReady(port)) return handle;
      try {
        await sleepOrAbort(POLL_MS, signal);
      } catch {
        await closeChromium(handle);
        throw new Error("aborted");
      }
    }
    await closeChromium(handle);
    if (signal.aborted) throw new Error("aborted");
  }
  throw new Error("cdp-launch-failed");
}
function cdpCaller(wsUrl, signal, fn) {
  return new Promise((resolve2, reject) => {
    const WS = globalThis.WebSocket;
    if (typeof WS !== "function") {
      reject(new Error("WebSocket unavailable"));
      return;
    }
    const ws = new WS(wsUrl);
    const pending = /* @__PURE__ */ new Map();
    let id = 0;
    let settled = false;
    const finish = (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      try {
        ws.close();
      } catch {
      }
      if (err) reject(err);
      else resolve2();
    };
    const timer = setTimeout(() => finish(new Error("devtools timeout")), 15e3);
    const onAbort = () => finish(new Error("aborted"));
    signal.addEventListener("abort", onAbort, { once: true });
    const call = (method, params) => new Promise((res, rej) => {
      const msgId = ++id;
      pending.set(msgId, (msg) => msg?.error ? rej(new Error(String(msg.error?.message ?? "cdp error"))) : res(msg?.result));
      try {
        ws.send(JSON.stringify({ id: msgId, method, params }));
      } catch (e) {
        pending.delete(msgId);
        rej(e);
      }
    });
    ws.addEventListener("message", (ev) => {
      let msg;
      try {
        msg = JSON.parse(typeof ev.data === "string" ? ev.data : String(ev.data));
      } catch {
        return;
      }
      const cb = msg?.id != null ? pending.get(msg.id) : void 0;
      if (cb) {
        pending.delete(msg.id);
        cb(msg);
      }
    });
    ws.addEventListener("error", () => finish(new Error("devtools error")));
    ws.addEventListener("close", () => finish(new Error("devtools closed")));
    ws.addEventListener("open", () => {
      fn(call).then(() => finish()).catch(finish);
    });
  });
}
function buildCookieHeader(cookies) {
  if (!Array.isArray(cookies)) return null;
  const picked = cookies.filter((c) => typeof c?.name === "string" && typeof c?.value === "string").filter((c) => {
    const raw = typeof c?.domain === "string" ? c.domain : typeof c?.host === "string" ? c.host : "";
    const d = raw.replace(/^\./, "").toLowerCase();
    return d === "aliyun.com" || d.endsWith(".aliyun.com");
  });
  if (!picked.length) return null;
  return picked.map((c) => `${c.name}=${c.value}`).join("; ");
}
async function pageTarget(port) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(1500) });
    if (!res.ok) return null;
    const list = await res.json();
    if (!Array.isArray(list)) return null;
    return list.find((t) => t?.type === "page" && typeof t.url === "string" && t.url.includes("bailian.console.aliyun.com")) ?? null;
  } catch {
    return null;
  }
}
async function createPageTarget(port, signal) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(PAGE_URL)}`, { method: "PUT", signal: AbortSignal.timeout(1500) });
    if (res.ok) return await res.json();
  } catch {
  }
  const v = await versionEndpoint(port);
  const browserWs = typeof v?.webSocketDebuggerUrl === "string" ? v.webSocketDebuggerUrl : "";
  if (!browserWs) return null;
  let targetId = null;
  try {
    await cdpCaller(browserWs, signal, async (call) => {
      const r = await call("Target.createTarget", { url: PAGE_URL });
      targetId = typeof r?.targetId === "string" ? r.targetId : null;
    });
  } catch {
    return null;
  }
  return targetId ? { webSocketDebuggerUrl: `ws://127.0.0.1:${port}/devtools/page/${targetId}` } : null;
}
async function readChromiumCookies(port, signal) {
  const target = await pageTarget(port) ?? await createPageTarget(port, signal);
  const wsUrl = typeof target?.webSocketDebuggerUrl === "string" ? target.webSocketDebuggerUrl : "";
  if (!wsUrl) return null;
  let cookies;
  try {
    await cdpCaller(wsUrl, signal, async (call) => {
      await call("Network.enable");
      const r = await call("Network.getCookies", { urls: ["https://bailian.console.aliyun.com/", "https://bailian-cs.console.aliyun.com/"] });
      cookies = r?.cookies;
    });
  } catch {
    return null;
  }
  return buildCookieHeader(cookies);
}
function waitExit(child, ms) {
  if (child.exitCode !== null) return Promise.resolve(true);
  return new Promise((resolve2) => {
    const t = setTimeout(() => {
      child.removeListener("exit", onExit);
      resolve2(child.exitCode !== null);
    }, ms);
    const onExit = () => {
      clearTimeout(t);
      resolve2(true);
    };
    child.once("exit", onExit);
  });
}
async function closeChromium(handle) {
  if (!handle || handle.pid <= 0) return;
  const { child, pid, port } = handle;
  if (child.exitCode !== null) return;
  try {
    const v = await versionEndpoint(port);
    const ws = typeof v?.webSocketDebuggerUrl === "string" ? v.webSocketDebuggerUrl : "";
    if (ws) {
      await cdpCaller(ws, new AbortController().signal, async (call) => {
        await call("Browser.close");
      }).catch(() => void 0);
    }
  } catch {
  }
  if (await waitExit(child, 2e3)) return;
  try {
    child.kill();
  } catch {
  }
  if (await waitExit(child, 2e3)) return;
  try {
    if (process.platform === "win32") spawnSync2("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
    else process.kill(pid, "SIGKILL");
  } catch {
  }
}
async function readFirefoxCookies(browser) {
  const profile = browser.userDataDir;
  if (!profile) return null;
  const src = path2.join(profile, "cookies.sqlite");
  let tmpDir = "";
  try {
    if (!fs.existsSync(src)) return null;
    tmpDir = fs.mkdtempSync(path2.join(os2.tmpdir(), "atp-cookie-"));
    for (const suffix of ["", "-wal", "-shm"]) {
      const from = src + suffix;
      if (fs.existsSync(from)) fs.copyFileSync(from, path2.join(tmpDir, `cookies.sqlite${suffix}`));
    }
    const db = await openSqlite(path2.join(tmpDir, "cookies.sqlite"));
    if (!db) return null;
    try {
      const stmt = typeof db.prepare === "function" ? db.prepare("SELECT host, name, value FROM moz_cookies WHERE host LIKE '%aliyun.com'") : db.query("SELECT host, name, value FROM moz_cookies WHERE host LIKE '%aliyun.com'");
      const rows = stmt.all?.() ?? [];
      return buildCookieHeader(rows);
    } finally {
      try {
        db.close();
      } catch {
      }
    }
  } catch {
    return null;
  } finally {
    if (tmpDir) {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {
      }
    }
  }
}

// src/core/quota/credentials.ts
var TARGET_WINDOW_MS = 18e4;
var HTTP_TIMEOUT_MS = 3e4;
var COOKIE_POLL_MS = 2e3;
var cred = null;
var state = "none";
var storage = "none";
var fail = (kind, message) => ({ ok: false, kind, message: redact(message).slice(0, 120) });
function credentialRoot() {
  return stateRoot();
}
function credentialFilePath() {
  return path3.join(credentialRoot(), "credential.json");
}
function legacyCredentialFilePath() {
  return path3.join(legacyStateRoot(), "credential.json");
}
var PS_PROTECT = "Add-Type -AssemblyName System.Security; [Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Protect([Text.Encoding]::UTF8.GetBytes($env:ATP_SECRET),$null,'CurrentUser'))";
var PS_UNPROTECT = "Add-Type -AssemblyName System.Security; [Text.Encoding]::UTF8.GetString([Security.Cryptography.ProtectedData]::Unprotect([Convert]::FromBase64String($env:ATP_SECRET),$null,'CurrentUser'))";
function powershellExe() {
  const root = process.env.SystemRoot ?? process.env.windir;
  const abs = root ? path3.join(root, "System32", "WindowsPowerShell", "v1.0", "powershell.exe") : "";
  return abs && fs2.existsSync(abs) ? abs : "powershell.exe";
}
function runPowerShell(script, secret) {
  return new Promise((resolve2) => {
    const child = spawn2(powershellExe(), ["-NoProfile", "-NonInteractive", "-Command", script], {
      env: { ...process.env, ATP_SECRET: secret },
      stdio: ["ignore", "pipe", "ignore"],
      windowsHide: true
    });
    let out = "";
    const timer = setTimeout(() => {
      child.kill();
      resolve2(null);
    }, 8e3);
    child.stdout?.on("data", (d) => out += String(d));
    child.once("error", () => {
      clearTimeout(timer);
      resolve2(null);
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      const text = out.trim();
      resolve2(code === 0 && text ? text : null);
    });
  });
}
async function persist() {
  if (!cred || process.platform !== "win32") {
    storage = "session";
    return storage;
  }
  const blob = await runPowerShell(PS_PROTECT, JSON.stringify({ v: 1, ...cred }));
  if (!blob) {
    storage = "session";
    return storage;
  }
  try {
    const file = credentialFilePath();
    fs2.mkdirSync(path3.dirname(file), { recursive: true });
    fs2.writeFileSync(file, JSON.stringify({ schemaVersion: 1, prot: "dpapi", savedAt: (/* @__PURE__ */ new Date()).toISOString(), data: blob }));
    storage = "dpapi";
    return storage;
  } catch {
    storage = "session";
    return storage;
  }
}
async function restoreFromDisk() {
  if (process.platform !== "win32") return null;
  let blob = null;
  for (const file of [credentialFilePath(), legacyCredentialFilePath()]) {
    try {
      const raw = JSON.parse(fs2.readFileSync(file, "utf8"));
      if (raw?.schemaVersion !== 1 || raw?.prot !== "dpapi" || typeof raw?.data !== "string") continue;
      blob = raw.data;
      break;
    } catch {
    }
  }
  if (!blob) return null;
  const plain = await runPowerShell(PS_UNPROTECT, blob);
  if (!plain) return null;
  try {
    const parsed = JSON.parse(plain);
    if (parsed?.kind === "cookie" && typeof parsed.jar === "string" && parsed.jar) {
      storage = "dpapi";
      return { kind: "cookie", jar: parsed.jar, source: parsed.source ?? "browser-session" };
    }
    if (parsed?.kind === "bearer" && typeof parsed.token === "string" && parsed.token) {
      storage = "dpapi";
      return { kind: "bearer", token: parsed.token, source: "bl" };
    }
  } catch {
    return null;
  }
  return null;
}
function readBlToken() {
  try {
    const cfg = JSON.parse(fs2.readFileSync(blConfigPath(), "utf8"));
    const token = cfg?.console?.access_token ?? cfg?.access_token ?? cfg?.tokens?.console?.access_token;
    return typeof token === "string" && token ? { kind: "bearer", token, source: "bl" } : null;
  } catch {
    return null;
  }
}
function linkAbort(signal, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new DOMException("timeout", "TimeoutError")), ms);
  const onAbort = () => ctrl.abort(signal.reason);
  if (signal.aborted) ctrl.abort(signal.reason);
  else signal.addEventListener("abort", onAbort, { once: true });
  return {
    signal: ctrl.signal,
    done: () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
    }
  };
}
function secToken() {
  const v = process.env.ALIYUN_SEC_TOKEN?.trim();
  return v ? v : void 0;
}
async function postWith(c, api, data, signal) {
  const headers = baseHeaders();
  if (c.kind === "bearer") headers.Authorization = `Bearer ${c.token}`;
  else headers.Cookie = c.jar;
  const link = linkAbort(signal, HTTP_TIMEOUT_MS);
  try {
    const res = await fetch(buildGatewayUrl(api, c.kind === "bearer" ? "cli" : "data"), {
      method: "POST",
      headers,
      body: buildRequestBody(api, data, secToken()),
      signal: link.signal
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new GatewayError(`HTTP ${res.status}: ${body.slice(0, 500)}`, String(res.status));
    }
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new GatewayError(`not JSON: ${text.slice(0, 200)}`, "not-json");
    }
  } finally {
    link.done();
  }
}
async function probeWith(c, signal) {
  try {
    unwrap(await postWith(c, API.subscription, { queryInstanceInfoRequest: { commodityCode: COMMODITY.solo } }, signal));
    return { ok: true };
  } catch (e) {
    const err = classifyError(e);
    return { ok: false, kind: err.kind, message: err.message };
  }
}
function invalidatePersisted() {
  storage = "none";
}
async function consoleRequest(api, data, signal, deps = {}) {
  if (!cred) await probeCredential(deps);
  const c = cred;
  if (!c) throw new GatewayError("\u672A\u6388\u6743 \xB7 \u6253\u5F00 /tokenplan \u6388\u6743", "NO_CREDENTIAL");
  try {
    const payload = deps.request ? await deps.request(api, data, signal) : await postWith(c, api, data, signal);
    unwrap(payload);
    return payload;
  } catch (e) {
    if (classifyError(e).kind === "unauthorized") {
      cred = null;
      state = "expired";
      (deps.invalidate ?? invalidatePersisted)();
    }
    throw e;
  }
}
async function probeCredential(deps = {}) {
  if (cred) {
    state = "authorized";
    return state;
  }
  if (state === "expired") return state;
  cred = await (deps.restore ?? restoreFromDisk)() ?? readBlToken();
  state = cred ? "authorized" : "none";
  return state;
}
function credentialSource() {
  return cred?.source ?? null;
}
async function forgetCredential() {
  cred = null;
  state = "none";
  storage = "none";
  for (const file of [credentialFilePath(), legacyCredentialFilePath()]) {
    try {
      fs2.rmSync(file, { force: true });
    } catch {
    }
  }
  for (const dir of [ownProfilesRoot(), path3.join(legacyStateRoot(), "browsers")]) {
    try {
      fs2.rmSync(dir, { recursive: true, force: true });
    } catch {
    }
  }
}
async function detectCredentialAdapters(resolveDefault) {
  const { browsers, adapters, preferred } = await detect(true, resolveDefault);
  return { browsers, adapters, preferred };
}
async function login(opts) {
  const { signal, onProgress: progress } = opts;
  const detected = await detect(true);
  const order = opts.adapters?.length ? opts.adapters.filter((a) => detected.adapters.includes(a)) : detected.adapters;
  const chromium = detected.browsers.filter((b) => b.family === "chromium");
  state = "awaiting-login";
  for (const adapter of order) {
    if (signal.aborted) return fail("none", "\u5DF2\u53D6\u6D88\u6388\u6743");
    if (adapter === "bl") {
      const c = readBlToken();
      if (!c) continue;
      const r = await probeWith(c, signal);
      if (r.ok) {
        cred = c;
        state = "authorized";
        return { ok: true, storage: await persist() };
      }
      continue;
    }
    if (adapter === "firefox-sqlite") {
      for (const b of detected.browsers.filter((x) => x.family === "firefox")) {
        progress({ phase: "verifying", secondsLeft: 0 });
        const jar = await readFirefoxCookies(b);
        if (!jar) continue;
        const c = { kind: "cookie", jar, source: "firefox" };
        if ((await probeWith(c, signal)).ok) {
          cred = c;
          state = "authorized";
          return { ok: true, storage: await persist() };
        }
      }
      continue;
    }
    if (adapter === "manual-paste") {
      state = "manual-needed";
      return fail("browser-unavailable", "\u65E0\u6CD5\u81EA\u52A8\u8BFB\u53D6\u767B\u5F55\u6001 \xB7 \u8BF7\u5728 /tokenplan \u7C98\u8D34 Cookie");
    }
    for (const browser of chromium) {
      if (signal.aborted) return fail("none", "\u5DF2\u53D6\u6D88\u6388\u6743");
      progress({ phase: "launching", secondsLeft: Math.round(TARGET_WINDOW_MS / 1e3) });
      let handle = null;
      try {
        handle = await launchChromium(browser, signal);
        progress({ phase: "waiting-login", secondsLeft: Math.round(TARGET_WINDOW_MS / 1e3) });
        const result = await waitForLogin(handle, signal, progress);
        if (result) {
          cred = result;
          state = "authorized";
          return { ok: true, storage: await persist() };
        }
      } catch {
        if (signal.aborted) return fail("none", "\u5DF2\u53D6\u6D88\u6388\u6743");
      } finally {
        progress({ phase: "closing", secondsLeft: 0 });
        await closeChromium(handle);
      }
    }
  }
  state = "manual-needed";
  return fail("browser-unavailable", "\u65E0\u6CD5\u81EA\u52A8\u8BFB\u53D6\u767B\u5F55\u6001 \xB7 \u8BF7\u5728 /tokenplan \u7C98\u8D34 Cookie");
}
async function waitForLogin(handle, signal, progress) {
  const deadline = Date.now() + TARGET_WINDOW_MS;
  let lastJar = "";
  while (Date.now() < deadline) {
    if (signal.aborted) return null;
    progress({ phase: "waiting-login", secondsLeft: Math.ceil((deadline - Date.now()) / 1e3) });
    try {
      await sleepOrAbort(COOKIE_POLL_MS, signal);
    } catch {
      return null;
    }
    const jar = await readChromiumCookies(handle.port, signal);
    if (!jar || jar === lastJar) continue;
    lastJar = jar;
    progress({ phase: "verifying", secondsLeft: Math.ceil((deadline - Date.now()) / 1e3) });
    const c = { kind: "cookie", jar, source: "browser-session" };
    if ((await probeWith(c, signal)).ok) return c;
  }
  return null;
}
async function submitManualCookie(raw, signal) {
  const jar = normalizeCookieInput(raw);
  if (!jar) return fail("paste-invalid", "Cookie \u65E0\u6548\u6216\u5DF2\u8FC7\u671F \xB7 \u8BF7\u91CD\u65B0\u590D\u5236");
  const c = { kind: "cookie", jar, source: "manual" };
  const r = await probeWith(c, signal);
  if (!r.ok) return fail("paste-invalid", "Cookie \u65E0\u6548\u6216\u5DF2\u8FC7\u671F \xB7 \u8BF7\u91CD\u65B0\u590D\u5236");
  cred = c;
  state = "authorized";
  return { ok: true, storage: await persist() };
}
function normalizeCookieInput(raw) {
  if (typeof raw !== "string") return null;
  let s = raw.trim();
  if (!s || /[\r\n]/.test(s)) return null;
  s = s.replace(/^cookie\s*:\s*/i, "");
  const pairs = s.match(/[^=;\s]+=[^;]*/g) ?? [];
  const usable = pairs.filter((p) => p.slice(p.indexOf("=") + 1).trim().length > 0);
  return usable.length >= 2 ? usable.map((p) => p.trim()).join("; ") : null;
}

// src/core/quota/fetch.ts
var NO_CRED_MESSAGE = {
  none: "\u672A\u6388\u6743 \xB7 \u6253\u5F00 /tokenplan \u2192 \u6388\u6743\uFF08\u6D4F\u89C8\u5668\u767B\u4E00\u6B21\u5373\u5B8C\u6210\uFF09",
  "browser-unavailable": "\u65E0\u6CD5\u81EA\u52A8\u8BFB\u53D6\u767B\u5F55\u6001 \xB7 \u8BF7\u5728 /tokenplan \u7C98\u8D34 Cookie",
  unauthorized: "\u767B\u5F55\u5DF2\u8FC7\u671F \xB7 \u5728 /tokenplan \u91CD\u65B0\u6388\u6743"
};
function failed(fetchedAt, error) {
  return { ok: false, source: null, fetchedAt, plan: null, window: null, addon: null, qwenwork: null, error };
}
function degrade(res, normalize) {
  if (res.status === "rejected") return { error: classifyError(res.reason).message };
  try {
    return normalize(unwrap(res.value));
  } catch (e) {
    return { error: classifyError(e).message };
  }
}
async function fetchQuota(opts = {}) {
  const deps = opts.deps ?? {};
  const signal = opts.signal ?? new AbortController().signal;
  const fetchedAt = (deps.now ?? (() => /* @__PURE__ */ new Date()))().toISOString();
  const request = deps.request ?? consoleRequest;
  let state2;
  try {
    state2 = await (deps.credentialState ?? probeCredential)();
  } catch {
    state2 = "none";
  }
  if (state2 !== "authorized") {
    const kind = state2 === "manual-needed" ? "browser-unavailable" : state2 === "expired" ? "unauthorized" : "none";
    return failed(fetchedAt, { kind, message: NO_CRED_MESSAGE[kind] ?? NO_CRED_MESSAGE.none });
  }
  const source = () => deps.source?.() ?? credentialSource();
  try {
    const plan = normalizePlan(unwrap(await request(API.subscription, { queryInstanceInfoRequest: { commodityCode: COMMODITY.solo } }, signal)));
    const window = pickUsageWindow(unwrap(await request(API.usage, {}, signal)));
    const [addonRes, qwenRes] = await Promise.allSettled([
      request(API.addon, { commodityCode: COMMODITY.addon }, signal),
      request(API.qwenwork, {}, signal)
    ]);
    const addon = degrade(addonRes, normalizeAddon);
    const qwenwork = degrade(qwenRes, normalizeQwenwork);
    return { ok: true, source: source(), fetchedAt, plan, window, addon, qwenwork, error: null };
  } catch (e) {
    return failed(fetchedAt, classifyError(e));
  }
}

// src/core/quota-cache.ts
import * as fs3 from "node:fs";
import * as path4 from "node:path";
var QUOTA_CACHE_SCHEMA = 2;
var QUOTA_CACHE_CAP = 64 * 1024;
function quotaCachePath() {
  return path4.join(stateDir(), "quota-cache.json");
}
function projectQuota(s) {
  const addon = s.addon && "error" in s.addon ? { error: String(s.addon.error) } : s.addon ?? null;
  const qwenwork = s.qwenwork && "error" in s.qwenwork ? { error: String(s.qwenwork.error) } : s.qwenwork ?? null;
  return {
    ok: !!s.ok,
    source: s.source ?? null,
    fetchedAt: String(s.fetchedAt ?? ""),
    plan: s.plan ? {
      status: s.plan.status ?? null,
      specCode: s.plan.specCode ?? null,
      remainingDays: s.plan.remainingDays ?? null,
      endTime: s.plan.endTime ?? null,
      endAtMs: s.plan.endAtMs ?? null
    } : null,
    window: s.window ? {
      window: s.window.window,
      usedPercent: s.window.usedPercent,
      remainingPercent: s.window.remainingPercent,
      resetTime: s.window.resetTime ?? null,
      resetAtMs: s.window.resetAtMs ?? null
    } : null,
    addon,
    qwenwork,
    error: s.error ? { kind: s.error.kind, message: String(s.error.message) } : null
  };
}
async function writeQuotaCache(snap) {
  try {
    const dir = stateDir();
    await fs3.promises.mkdir(dir, { recursive: true });
    const payload = JSON.stringify({
      schemaVersion: QUOTA_CACHE_SCHEMA,
      writtenBy: "@te-river/opencode-alibabatokenplan/tui@0.2.0",
      fetchedAt: snap.fetchedAt,
      quota: projectQuota(snap)
    });
    if (Buffer.byteLength(payload, "utf8") > QUOTA_CACHE_CAP) return false;
    const tmp = path4.join(dir, "quota-cache.json.tmp");
    await fs3.promises.writeFile(tmp, payload);
    await fs3.promises.rename(tmp, quotaCachePath());
    return true;
  } catch {
    return false;
  }
}
async function readQuotaCache() {
  let parsed;
  try {
    parsed = JSON.parse(await fs3.promises.readFile(quotaCachePath(), "utf8"));
  } catch {
    return null;
  }
  if (!parsed || parsed.schemaVersion !== QUOTA_CACHE_SCHEMA || !parsed.quota || typeof parsed.quota !== "object") return null;
  return { ...projectQuota(parsed.quota), source: "cache" };
}

// src/core/usage-series.ts
var DAY_MS = 24 * 60 * 60 * 1e3;
var DAY_SECONDS = 86400;
var HOUR_SECONDS = 3600;
var WEEK_DAYS = 7;
var FIVE_HOUR_POINTS = 5;
var SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1e3;
function shanghaiParts(ms) {
  const shifted = new Date(ms + SHANGHAI_OFFSET_MS);
  return {
    y: shifted.getUTCFullYear(),
    m: shifted.getUTCMonth(),
    d: shifted.getUTCDate(),
    h: shifted.getUTCHours(),
    mi: shifted.getUTCMinutes(),
    s: shifted.getUTCSeconds()
  };
}
function shiftMonth(ms, delta) {
  const p = shanghaiParts(ms);
  const firstOfTarget = new Date(Date.UTC(p.y, p.m + delta, 1, p.h, p.mi, p.s));
  const year = firstOfTarget.getUTCFullYear();
  const month = firstOfTarget.getUTCMonth();
  const daysInTarget = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return Date.UTC(year, month, Math.min(p.d, daysInTarget), p.h, p.mi, p.s) - SHANGHAI_OFFSET_MS;
}
function monthStartOf(resetAtMs) {
  if (typeof resetAtMs !== "number" || !Number.isFinite(resetAtMs)) return null;
  return shiftMonth(resetAtMs, -1);
}
function originSeries(raw) {
  let node = raw;
  for (let depth = 0; depth < 3 && node && typeof node === "object"; depth += 1) {
    const current = node;
    if (Array.isArray(current.originData)) return current.originData;
    node = current.data;
  }
  return null;
}
function totalTokenPoints(series) {
  for (const entry of series) {
    const item = entry;
    if (item?.labels?.usage_type !== "total_tokens" || !Array.isArray(item.points)) continue;
    return item.points.filter((point) => {
      const p = point;
      return typeof p?.value === "number" && Number.isFinite(p.value) && typeof p?.timestamp === "number" && Number.isFinite(p.timestamp);
    }).map((point) => ({ at: point.timestamp, value: point.value })).sort((a, b) => a.at - b.at);
  }
  return null;
}
var sum = (points) => points.reduce((total, point) => total + point.value, 0);
async function fetchPoints(request, dto, signal) {
  try {
    const payload = await request(API.modelMonitor, { reqDTO: dto }, signal);
    const series = originSeries(unwrap(payload));
    return series ? totalTokenPoints(series) : null;
  } catch {
    return null;
  }
}
var monitorDto = (startTime, endTime, step) => ({
  productMode: "TokenPlanPersonal",
  startTime,
  endTime,
  step,
  metricFilters: [{ aggMethod: "sum", metricName: "model_usage" }]
});
async function fetchUsageSeries(opts = {}) {
  const now = opts.now ?? Date.now();
  const signal = opts.signal ?? new AbortController().signal;
  const request = opts.requestImpl ?? consoleRequest;
  const monthStart = monthStartOf(opts.resetAtMs);
  const hasMonth = monthStart !== null && monthStart < now;
  const [dailyRes, hourlyRes] = await Promise.allSettled([
    fetchPoints(request, monitorDto(hasMonth ? monthStart : now - WEEK_DAYS * DAY_MS, now, DAY_SECONDS), signal),
    fetchPoints(request, monitorDto(now - WEEK_DAYS * DAY_MS, now, HOUR_SECONDS), signal)
  ]);
  const daily = dailyRes.status === "fulfilled" ? dailyRes.value : null;
  let tokens7d;
  let tokensMonth;
  if (daily && daily.length > 0) {
    tokens7d = sum(daily.slice(-WEEK_DAYS));
    if (hasMonth && daily.length >= 2) tokensMonth = sum(daily);
  } else if (hasMonth) {
    const fallback = await fetchPoints(request, monitorDto(now - WEEK_DAYS * DAY_MS, now, DAY_SECONDS), signal);
    if (fallback && fallback.length > 0) tokens7d = sum(fallback.slice(-WEEK_DAYS));
  }
  const hourly = hourlyRes.status === "fulfilled" ? hourlyRes.value : null;
  const tokens5h = hourly && hourly.length > 0 ? sum(hourly.slice(-FIVE_HOUR_POINTS)) : void 0;
  if (tokensMonth === void 0 && tokens7d === void 0 && tokens5h === void 0) return null;
  const result = { fetchedAt: now, source: "server" };
  if (tokensMonth !== void 0) result.tokensMonth = tokensMonth;
  if (tokens7d !== void 0) result.tokens7d = tokens7d;
  if (tokens5h !== void 0) result.tokens5h = tokens5h;
  return result;
}

// src/core/usage-history.ts
import * as fs4 from "node:fs";
import * as path5 from "node:path";
var SCHEMA_VERSION = 1;
var KEEP_MS = 8 * 24 * 60 * 60 * 1e3;
var MAX_SAMPLES = 2e3;
function usageHistoryPath() {
  return path5.join(stateRoot(), "usage-history.json");
}
function isSample(value) {
  if (!value || typeof value !== "object") return false;
  const s = value;
  return typeof s.at === "number" && Number.isFinite(s.at) && typeof s.usedPercent === "number" && Number.isFinite(s.usedPercent) && typeof s.remainingPercent === "number" && Number.isFinite(s.remainingPercent);
}
function readUsageHistory() {
  try {
    const parsed = JSON.parse(fs4.readFileSync(usageHistoryPath(), "utf8"));
    if (!parsed || parsed.schemaVersion !== SCHEMA_VERSION || !Array.isArray(parsed.samples)) return [];
    return parsed.samples.filter(isSample).map((s) => ({ at: s.at, usedPercent: s.usedPercent, remainingPercent: s.remainingPercent })).sort((a, b) => a.at - b.at);
  } catch {
    return [];
  }
}
function recordUsageSample(sample) {
  const entry = { at: sample.at, usedPercent: sample.usedPercent, remainingPercent: sample.remainingPercent };
  if (!isSample(entry)) return;
  try {
    const cutoff = entry.at - KEEP_MS;
    const samples = readUsageHistory().filter((s) => s.at >= cutoff && s.at !== entry.at).concat(entry).sort((a, b) => a.at - b.at).slice(-MAX_SAMPLES);
    const file = usageHistoryPath();
    fs4.mkdirSync(path5.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    fs4.writeFileSync(tmp, JSON.stringify({ schemaVersion: SCHEMA_VERSION, samples }));
    fs4.renameSync(tmp, file);
  } catch {
  }
}
function periodUsage(history, nowMs, windowMs) {
  const sinceMs = nowMs - windowMs;
  const inWindow = history.filter((s) => s.at >= sinceMs && s.at <= nowMs);
  if (inWindow.length === 0) return { usedPercent: 0, since: null, samples: 0 };
  let first = inWindow[0];
  let last = inWindow[0];
  for (const s of inWindow) {
    if (s.at < first.at) first = s;
    if (s.at >= last.at) last = s;
  }
  const delta = Math.round(Math.max(0, last.usedPercent - first.usedPercent) * 100) / 100;
  return { usedPercent: delta, since: first.at, samples: inWindow.length };
}

// src/tui/state.ts
var REFRESH_INTERVAL_MS = 6e4;
var WEEK_MS = 7 * 24 * 60 * 60 * 1e3;
var FIVE_HOUR_MS = 5 * 60 * 60 * 1e3;
function fallbackSnapshot() {
  return {
    ok: false,
    source: null,
    fetchedAt: (/* @__PURE__ */ new Date()).toISOString(),
    plan: null,
    window: null,
    addon: null,
    qwenwork: null,
    error: { kind: "unknown", message: "\u989D\u5EA6\u8BF7\u6C42\u5931\u8D25 \xB7 60 \u79D2\u540E\u81EA\u52A8\u91CD\u8BD5" }
  };
}
function usagePeriods(quota, nowMs) {
  if (!quota.ok || !quota.window) return void 0;
  const history = readUsageHistory();
  return {
    week: periodUsage(history, nowMs, WEEK_MS),
    fiveHour: periodUsage(history, nowMs, FIVE_HOUR_MS)
  };
}
function createTokenPlanView() {
  const [status, setStatus] = createSignal(null);
  const [refreshing, setRefreshing] = createSignal(false);
  const [lastError, setLastError] = createSignal(null);
  let version = 0;
  let inFlight = null;
  let controller = null;
  let disposed = false;
  let lastDocument = null;
  const apply = (snapshot, opts = {}) => {
    if (disposed) return;
    try {
      const previous = status();
      if (snapshot.ok) {
        setLastError(null);
      } else {
        setLastError(snapshot.error?.message ?? "\u989D\u5EA6\u8BF7\u6C42\u5931\u8D25 \xB7 60 \u79D2\u540E\u81EA\u52A8\u91CD\u8BD5");
        if (previous && !opts.discountChanged && opts.series === void 0) return;
      }
      const effectiveQuota = snapshot.ok || !previous ? snapshot : previous.quota;
      const now = /* @__PURE__ */ new Date();
      if (snapshot.ok && snapshot.source !== "cache" && snapshot.window && Number.isFinite(snapshot.window.usedPercent)) {
        recordUsageSample({
          at: now.getTime(),
          usedPercent: snapshot.window.usedPercent,
          remainingPercent: snapshot.window.remainingPercent
        });
      }
      const series = opts.series !== void 0 ? opts.series : previous?.usageSeries;
      setStatus(buildMergedStatus(
        effectiveQuota,
        now,
        lastDocument ?? void 0,
        usagePeriods(effectiveQuota, now.getTime()),
        series
      ));
    } catch {
    }
  };
  const refresh = () => {
    if (inFlight) return inFlight;
    const mine = ++version;
    controller = new AbortController();
    const signal = controller.signal;
    setRefreshing(true);
    const run2 = (async () => {
      const [quotaResult, documentResult] = await Promise.allSettled([
        fetchQuota({ signal }),
        fetchPersonalPlanOffers({ signal })
      ]);
      const snapshot = quotaResult.status === "fulfilled" ? quotaResult.value : fallbackSnapshot();
      const series = await fetchUsageSeries({ signal, resetAtMs: snapshot.window?.resetAtMs ?? null });
      if (disposed || mine !== version) return;
      const discountChanged = documentResult.status === "fulfilled";
      if (discountChanged) lastDocument = documentResult.value;
      apply(snapshot, { discountChanged, series });
      if (snapshot.ok) void writeQuotaCache(snapshot).catch(() => {
      });
    })();
    inFlight = run2.finally(() => {
      if (mine !== version) return;
      setRefreshing(false);
      inFlight = null;
    });
    return inFlight;
  };
  void readQuotaCache().then((cached2) => {
    if (cached2 && !status()) apply(cached2);
  }).catch(() => {
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
    }
  };
}
function createClock(intervalMs = 1e3) {
  const [now, setNow] = createSignal(Date.now());
  const timer = setInterval(() => setNow(Date.now()), intervalMs);
  onCleanup(() => clearInterval(timer));
  return now;
}

// src/tui/views.tsx
import { memo as _$memo } from "@opentui/solid";
import { effect as _$effect } from "@opentui/solid";
import { createComponent as _$createComponent } from "@opentui/solid";
import { insertNode as _$insertNode } from "@opentui/solid";
import { insert as _$insert } from "@opentui/solid";
import { setProp as _$setProp } from "@opentui/solid";
import { createElement as _$createElement } from "@opentui/solid";
import { For, Show } from "solid-js";

// src/tui/format.ts
var DASH = "\u2014";
function localStamp(iso) {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? DASH : formatTs(ms).slice(0, 16);
}
function rowLabelText(label) {
  return `${label.padEnd(12)} `;
}
function quotaSeverity(usedPercent) {
  if (usedPercent === null || usedPercent === void 0 || !Number.isFinite(usedPercent)) return null;
  if (usedPercent >= 90) return "error";
  if (usedPercent >= 70) return "warning";
  return "success";
}
var PALETTE = {
  base: "#FFFFFF",
  muted: "#7F848E",
  success: "#98C379",
  warning: "#E5C07B",
  error: "#E06C75",
  cyan: "#56B6C2"
};
var NAMED_SEVERITY_FG = {
  success: PALETTE.success,
  warning: PALETTE.warning,
  error: PALETTE.error
};
function colorString(value, fallback) {
  return typeof value === "string" && value.trim() ? value : fallback;
}
function parseRgb(color) {
  const value = color.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value);
  if (hex) {
    const raw = hex[1].length === 3 ? hex[1].split("").map((char) => char + char).join("") : hex[1];
    return [parseInt(raw.slice(0, 2), 16), parseInt(raw.slice(2, 4), 16), parseInt(raw.slice(4, 6), 16)];
  }
  const rgb = /^rgba?\(([^)]+)\)$/i.exec(value);
  if (!rgb) return null;
  const parts = rgb[1].split(/[,/\s]+/).filter(Boolean).map((part) => Number.parseFloat(part));
  if (parts.length < 3 || !parts.slice(0, 3).every((n) => Number.isFinite(n))) return null;
  return [parts[0], parts[1], parts[2]];
}
function isWashedOut(color) {
  const rgb = parseRgb(color);
  if (!rgb) return false;
  const max = Math.max(...rgb);
  const min = Math.min(...rgb);
  return max > 200 && max - min < 40;
}
function quotaSeverityFg(theme, severity) {
  const feedback = theme.text.feedback;
  const base = colorString(theme.text.base, PALETTE.base);
  const raw = severity === "error" ? feedback?.error?.base : severity === "warning" ? feedback?.warning?.base : severity === "success" ? feedback?.success?.base : void 0;
  const fg = colorString(raw, "");
  if (fg && fg !== base && !isWashedOut(fg)) return fg;
  return severity ? NAMED_SEVERITY_FG[severity] : base;
}
function overlayFg(theme, period) {
  const feedback = theme.text.feedback;
  const base = colorString(theme.text.base, PALETTE.base);
  const preferred = colorString(period === "fiveHour" ? feedback?.info?.base : feedback?.warning?.base, "");
  if (preferred && preferred !== base) return preferred;
  return period === "fiveHour" ? PALETTE.cyan : PALETTE.warning;
}
var METER = /^(.*?)([█▒░]{16} (?:剩 )?\d+(?:\.\d+)?%)(.*)$/;
function splitMeter(line) {
  const parts = METER.exec(line);
  return parts ? [parts[1], parts[2], parts[3]] : null;
}
function isQuotaMeterLine(line) {
  return splitMeter(line) !== null;
}
function percent(value) {
  if (value === null || value === void 0 || !Number.isFinite(value)) return DASH;
  return `${value.toFixed(1)}%`;
}
function remainingOf(usedPercent) {
  return Math.round((100 - usedPercent) * 10) / 10;
}
function usageBar(usedPercent, width = 16) {
  if (usedPercent === null || usedPercent === void 0 || !Number.isFinite(usedPercent)) return "";
  const clamped = Math.max(0, Math.min(100, usedPercent));
  const used = Math.round(clamped / 100 * width);
  return "\u2588".repeat(width - used) + "\u2591".repeat(used);
}
function consumedPercent(value) {
  if (value === null || value === void 0 || !Number.isFinite(value)) return DASH;
  return `-${Math.abs(value).toFixed(1)}%`;
}
function barSegments(bar) {
  const segments = [];
  for (const char of bar) {
    const kind = char === "\u2588" ? "unused" : char === "\u2592" ? "period" : "used";
    const last = segments[segments.length - 1];
    if (last && last.kind === kind) last.text += char;
    else segments.push({ kind, text: char });
  }
  return segments;
}
function segmentedBar(monthUsedPercent, periodUsedPercent, width = 16) {
  if (monthUsedPercent === null || monthUsedPercent === void 0 || !Number.isFinite(monthUsedPercent)) return "";
  const used = Math.max(0, Math.min(100, monthUsedPercent));
  const unused = Math.round((100 - used) / 100 * width);
  const period = periodUsedPercent === null || periodUsedPercent === void 0 || !Number.isFinite(periodUsedPercent) ? 0 : Math.max(0, Math.min(100, periodUsedPercent));
  const wanted = period > 0 ? Math.max(1, Math.round(period / 100 * width)) : 0;
  const span = Math.min(width - unused, wanted);
  return "\u2588".repeat(unused) + "\u2592".repeat(span) + "\u2591".repeat(width - unused - span);
}
function tokenTotal(value) {
  if (value === null || value === void 0 || !Number.isFinite(value)) return "";
  const n = Math.max(0, value);
  if (n < 1e3) return `${Math.round(n)} Token`;
  if (n < 1e6) return `${(n / 1e3).toFixed(2)}K Token`;
  if (n < 1e9) return `${(n / 1e6).toFixed(2)}M Token`;
  return `${(n / 1e9).toFixed(2)}B Token`;
}
function credits(value) {
  if (value === null || value === void 0 || !Number.isFinite(value)) return DASH;
  return Math.round(value).toLocaleString("zh-CN");
}
function windowLabel2(key) {
  if (key === "5h") return "5 \u5C0F\u65F6";
  return key === "week" ? "\u5468" : "\u6708";
}
function windowCountdown(view, nowMs, compact = false) {
  const at = Date.parse(view.nextBoundaryAt);
  if (Number.isNaN(at)) return view.activeNow ? "\u8FDB\u884C\u4E2D" : "\u5373\u5C06\u5F00\u59CB";
  const left = at - nowMs;
  const span = compact ? fmtShortDur(left) : fmtHMS(left);
  return view.activeNow ? `${span} \u540E\u7ED3\u675F` : `${span} \u540E\u5F00\u59CB`;
}
function nearestWindow(discount, nowMs) {
  let best = null;
  for (const view of discount.windows) {
    const parsed = Date.parse(view.nextBoundaryAt);
    const at = Number.isNaN(parsed) ? nowMs + Number.MAX_SAFE_INTEGER : parsed;
    const rank = view.activeNow ? 0 : 1;
    if (!best || rank < best.rank || rank === best.rank && at < best.at) best = { view, rank, at };
  }
  return best?.view ?? null;
}
var MONTH_LABEL = "\u6708\u989D\u5EA6";
function quotaLines(quota, nowMs, series) {
  if (!quota.ok) return [];
  const view = quota.window;
  if (!view) return quota.plan?.status ? [`\u5957\u9910 ${quota.plan.status}`] : [];
  const left = view.resetAtMs === null ? null : view.resetAtMs - nowMs;
  const reset = left !== null && left > 0 ? `${fmtShortDur(left)} \u540E\u91CD\u7F6E` : view.resetTime ? `\u91CD\u7F6E ${view.resetTime}` : "";
  const total = tokenTotal(series?.tokensMonth);
  const value = [usageBar(view.usedPercent), percent(remainingOf(view.usedPercent)), total].filter(Boolean).join(" ");
  return [reset ? `${MONTH_LABEL} \xB7 ${reset}` : MONTH_LABEL, value];
}
function tierOf(model) {
  const raw = model.effective ?? model.regular;
  if (!raw) return null;
  const factor = Number.parseFloat(raw);
  if (!Number.isFinite(factor) || factor <= 0 || factor > 1) return null;
  return Math.round(factor * 100) / 10;
}
function fmtTier(value) {
  return String(Number(value.toFixed(1)));
}
function isQwen(model) {
  return model.model.toLowerCase().startsWith("qwen");
}
function factorOf(model) {
  const factor = Number.parseFloat(model.effective ?? model.regular ?? "");
  return Number.isFinite(factor) ? factor : Number.POSITIVE_INFINITY;
}
function orderedModels(models) {
  return [...models].sort(
    (a, b) => Number(isQwen(b)) - Number(isQwen(a)) || factorOf(a) - factorOf(b) || a.model.localeCompare(b.model)
  );
}
function sidebarModelLines(view) {
  const ranked = orderedModels(view.models).map((model) => ({ model, tier: tierOf(model) })).filter((entry) => entry.tier !== null);
  const picked = ranked.filter((entry) => isQwen(entry.model)).slice(0, 3);
  if (picked.length < 3) {
    picked.push(...ranked.filter((entry) => !isQwen(entry.model)).slice(0, 3 - picked.length));
  }
  return picked.map((entry) => `${entry.model.model} ${fmtTier(entry.tier)} \u6298`);
}
function sidebarCountdownLine(view, nowMs) {
  return `\u591C\u95F4 ${windowCountdown(view, nowMs, true)}`;
}
function periodValue(period, monthUsedPercent, tokens) {
  const total = tokenTotal(tokens);
  if (period.samples === 0) return `\u6570\u636E\u91C7\u96C6\u4E2D${total ? ` \xB7 ${total}` : ""}`;
  return [segmentedBar(monthUsedPercent, period.usedPercent), consumedPercent(period.usedPercent), total].filter(Boolean).join(" ");
}
function sidebarLines(status, nowMs) {
  const lines = [...quotaLines(status.quota, nowMs, status.usageSeries)];
  const near = nearestWindow(status.discount, nowMs);
  if (near) lines.push(sidebarCountdownLine(near, nowMs));
  if (near) lines.push(...sidebarModelLines(near));
  const view = status.quota.window;
  const periods = status.usagePeriods;
  if (view && periods) {
    lines.push("");
    lines.push("\u8FD17\u5929\u6D88\u8017");
    lines.push(periodValue(periods.week, view.usedPercent, status.usageSeries?.tokens7d));
    lines.push("");
    lines.push("\u8FD15h\u6D88\u8017");
    lines.push(periodValue(periods.fiveHour, view.usedPercent, status.usageSeries?.tokens5h));
  }
  const addon = status.quota.addon;
  if (addon && !("error" in addon) && addon.totalCredits !== null && addon.totalCredits > 0) {
    lines.push(`\u52A0\u8D2D\u5269\u4F59 ${credits(addon.remainingCredits)} credits`);
  }
  return lines;
}
function footerLine(status) {
  const quota = status.quota;
  if (!quota.ok) return "";
  if (quota.window) return `\u989D\u5EA6 ${windowLabel2(quota.window.window)} \u5269 ${percent(remainingOf(quota.window.usedPercent))}`;
  return quota.plan?.status ? `\u989D\u5EA6 \u5957\u9910 ${quota.plan.status}` : "";
}
function quotaRows(quota, nowMs, periods, series) {
  if (!quota.ok) return [{ label: "\u72B6\u6001", value: quota.error?.message ?? "\u672A\u6388\u6743 \xB7 \u6253\u5F00 /tokenplan \u6388\u6743" }];
  const rows = [];
  const plan = quota.plan;
  if (plan) {
    rows.push({ label: "\u5957\u9910", value: [plan.status ?? DASH, plan.specCode ?? ""].filter(Boolean).join(" \xB7 ") });
    if (plan.remainingDays !== null) {
      rows.push({ label: "\u5269\u4F59", value: `${plan.remainingDays} \u5929${plan.endTime ? ` \xB7 \u5230\u671F ${plan.endTime}` : ""}` });
    } else if (plan.endTime) {
      rows.push({ label: "\u5230\u671F", value: plan.endTime });
    }
  }
  const view = quota.window;
  if (view) {
    const left = view.resetAtMs === null ? null : view.resetAtMs - nowMs;
    const reset = left !== null && left > 0 ? `${fmtShortDur(left)} \u540E\u91CD\u7F6E` : view.resetTime ? `\u91CD\u7F6E ${view.resetTime}` : "";
    const monthTotal = tokenTotal(series?.tokensMonth);
    const head = usageBar(view.usedPercent, 10);
    const rest = [
      `\u5269 ${percent(remainingOf(view.usedPercent))}`,
      `\u5DF2\u7528 ${percent(view.usedPercent)}`,
      reset,
      monthTotal ? `\u5408\u8BA1 ${monthTotal}` : ""
    ].filter(Boolean);
    const PANEL_ROW_BUDGET = 64;
    const full = [head, ...rest].join(" \xB7 ");
    const value = full.length > PANEL_ROW_BUDGET && rest.length > 2 ? [head, rest[0], ...rest.slice(2)].join(" \xB7 ") : full;
    rows.push({
      label: `${windowLabel2(view.window)}\u7528\u91CF`,
      value,
      severity: quotaSeverity(view.usedPercent) ?? void 0
    });
    if (periods) {
      rows.push({ label: "\u8FD17\u5929\u6D88\u8017", value: periodValue(periods.week, view.usedPercent, series?.tokens7d), muted: true });
      rows.push({ label: "\u8FD15h\u6D88\u8017", value: periodValue(periods.fiveHour, view.usedPercent, series?.tokens5h), muted: true });
    }
  }
  const addon = quota.addon;
  if (addon) {
    rows.push({
      label: "\u52A0\u8D2D",
      value: "error" in addon ? addon.error : [
        `${credits(addon.remainingCredits)} / ${credits(addon.totalCredits)} credits`,
        addon.usedPercent === null ? "" : `\u5DF2\u7528 ${percent(addon.usedPercent)}`,
        addon.activeCount === null ? "" : `${addon.activeCount} \u4E2A\u5728\u6548`
      ].filter(Boolean).join(" \xB7 ")
    });
  }
  const qwenwork = quota.qwenwork;
  if (qwenwork) {
    rows.push({ label: "Qwenwork", value: "error" in qwenwork ? qwenwork.error : `${credits(qwenwork.credits)} credits` });
  }
  rows.push({ label: "\u6570\u636E\u6E90", value: `${quota.source ?? DASH} \xB7 ${localStamp(quota.fetchedAt)}`, muted: true });
  return rows;
}
function discountRows(discount, nowMs) {
  const view = nearestWindow(discount, nowMs);
  if (!view) return [];
  const rows = [
    {
      // 面板行宽有限：label 只留「夜间折扣 … · 文源 日期」，时段与倒计时移到 value，用 ` · ` 分隔。
      label: view.label.replace(/^Token Plan\s+/, ""),
      value: `${view.start}\u2013${view.end} \xB7 ${windowCountdown(view, nowMs)}`
    }
  ];
  for (const model of orderedModels(view.models)) {
    const prices = [model.effective ? `\u73B0\u4EF7 ${model.effective}` : "", model.regular ? `\u539F\u4EF7 ${model.regular}` : ""].filter(Boolean).join(" / ");
    rows.push({ label: `  ${model.model}`, value: [prices, model.badge ?? ""].filter(Boolean).join(" \xB7 ") || DASH, muted: true });
  }
  return rows;
}

// src/tui/views.tsx
function QuotaLine(props) {
  const base = colorString(props.theme.text.base, PALETTE.base);
  const parts = splitMeter(props.line);
  if (!parts) {
    return (() => {
      var _el$ = _$createElement("text");
      _$setProp(_el$, "fg", base);
      _$setProp(_el$, "wrapMode", "none");
      _$insert(_el$, () => props.line);
      return _el$;
    })();
  }
  const meterFg = quotaSeverityFg(props.theme, quotaSeverity(props.usedPercent));
  return (() => {
    var _el$2 = _$createElement("box"), _el$3 = _$createElement("text"), _el$4 = _$createElement("text"), _el$5 = _$createElement("text");
    _$insertNode(_el$2, _el$3);
    _$insertNode(_el$2, _el$4);
    _$insertNode(_el$2, _el$5);
    _$setProp(_el$2, "flexDirection", "row");
    _$setProp(_el$3, "fg", base);
    _$setProp(_el$3, "wrapMode", "none");
    _$insert(_el$3, () => parts[0]);
    _$setProp(_el$4, "fg", meterFg);
    _$setProp(_el$4, "wrapMode", "none");
    _$insert(_el$4, () => parts[1]);
    _$setProp(_el$5, "fg", base);
    _$setProp(_el$5, "wrapMode", "none");
    _$insert(_el$5, () => parts[2]);
    return _el$2;
  })();
}
var VALUE_LINE = /^([█▒░]{16}) (?=.*)/;
function PeriodLine(props) {
  const base = colorString(props.theme.text.base, PALETTE.base);
  const muted = colorString(props.theme.text.muted, PALETTE.muted);
  const parts = VALUE_LINE.exec(props.line);
  if (!parts) {
    return (() => {
      var _el$6 = _$createElement("text");
      _$setProp(_el$6, "fg", muted);
      _$setProp(_el$6, "wrapMode", "none");
      _$insert(_el$6, () => props.line);
      return _el$6;
    })();
  }
  const accent = overlayFg(props.theme, props.overlay);
  const rest = props.line.slice(parts[1].length);
  return (() => {
    var _el$7 = _$createElement("box"), _el$8 = _$createElement("text");
    _$insertNode(_el$7, _el$8);
    _$setProp(_el$7, "flexDirection", "row");
    _$insert(_el$7, _$createComponent(For, {
      get each() {
        return barSegments(parts[1]);
      },
      children: (segment) => (() => {
        var _el$9 = _$createElement("text");
        _$setProp(_el$9, "wrapMode", "none");
        _$insert(_el$9, () => segment.text);
        _$effect((_$p) => _$setProp(_el$9, "fg", segment.kind === "period" ? accent : segment.kind === "unused" ? base : muted, _$p));
        return _el$9;
      })()
    }), _el$8);
    _$setProp(_el$8, "fg", muted);
    _$setProp(_el$8, "wrapMode", "none");
    _$insert(_el$8, rest);
    return _el$7;
  })();
}
function SidebarLine(props) {
  if (isQuotaMeterLine(props.line)) {
    return _$createComponent(QuotaLine, {
      get theme() {
        return props.theme;
      },
      get line() {
        return props.line;
      },
      get usedPercent() {
        return props.usedPercent;
      }
    });
  }
  if (VALUE_LINE.test(props.line)) {
    return _$createComponent(PeriodLine, {
      get theme() {
        return props.theme;
      },
      get line() {
        return props.line;
      },
      get overlay() {
        return props.overlay;
      }
    });
  }
  const fg = props.line.startsWith(MONTH_LABEL) ? colorString(props.theme.text.base, PALETTE.base) : colorString(props.theme.text.muted, PALETTE.muted);
  return (() => {
    var _el$0 = _$createElement("text");
    _$setProp(_el$0, "fg", fg);
    _$setProp(_el$0, "wrapMode", "none");
    _$insert(_el$0, (() => {
      var _c$ = _$memo(() => props.line.length > 0);
      return () => _c$() ? props.line : " ";
    })());
    return _el$0;
  })();
}
function SidebarView(props) {
  const now = createClock();
  const status = () => props.view.status();
  const lines = () => {
    const current = status();
    return current ? sidebarLines(current, now()) : [];
  };
  return (() => {
    var _el$1 = _$createElement("box");
    _$setProp(_el$1, "flexDirection", "column");
    _$insert(_el$1, _$createComponent(For, {
      get each() {
        return lines();
      },
      children: (line, index) => _$createComponent(SidebarLine, {
        get theme() {
          return props.context.theme;
        },
        line,
        get usedPercent() {
          return status()?.quota.window?.usedPercent;
        },
        get overlay() {
          return index() > 0 && lines()[index() - 1] === "\u8FD15h\u6D88\u8017" ? "fiveHour" : "week";
        }
      })
    }));
    return _el$1;
  })();
}
function FooterView(props) {
  const line = () => {
    const status = props.view.status();
    return status ? footerLine(status) : "";
  };
  return _$createComponent(Show, {
    get when() {
      return line().length > 0;
    },
    get children() {
      var _el$10 = _$createElement("text");
      _$setProp(_el$10, "wrapMode", "none");
      _$insert(_el$10, line);
      _$effect((_$p) => _$setProp(_el$10, "fg", colorString(props.context.theme.text.muted, PALETTE.muted), _$p));
      return _el$10;
    }
  });
}

// src/tui/panel.tsx
import { use as _$use } from "@opentui/solid";
import { createTextNode as _$createTextNode2 } from "@opentui/solid";
import { memo as _$memo3 } from "@opentui/solid";
import { createComponent as _$createComponent3 } from "@opentui/solid";
import { effect as _$effect3 } from "@opentui/solid";
import { insertNode as _$insertNode3 } from "@opentui/solid";
import { insert as _$insert3 } from "@opentui/solid";
import { setProp as _$setProp3 } from "@opentui/solid";
import { createElement as _$createElement3 } from "@opentui/solid";
import { For as For3, Show as Show3, createSignal as createSignal3 } from "solid-js";
import { TextAttributes } from "@opentui/core";
import { useTerminalDimensions } from "@opentui/solid";

// src/tui/login.tsx
import { effect as _$effect2 } from "@opentui/solid";
import { createTextNode as _$createTextNode } from "@opentui/solid";
import { insertNode as _$insertNode2 } from "@opentui/solid";
import { memo as _$memo2 } from "@opentui/solid";
import { insert as _$insert2 } from "@opentui/solid";
import { createComponent as _$createComponent2 } from "@opentui/solid";
import { setProp as _$setProp2 } from "@opentui/solid";
import { createElement as _$createElement2 } from "@opentui/solid";
import { For as For2, Show as Show2, createSignal as createSignal2, onCleanup as onCleanup2 } from "solid-js";
function loginSuccessNotice(storage2) {
  if (storage2 === "dpapi") return "\u6388\u6743\u6210\u529F \xB7 \u51ED\u8BC1\u5DF2\u52A0\u5BC6\u4FDD\u5B58";
  if (storage2 === "session") return "\u6388\u6743\u6210\u529F \xB7 \u4EC5\u672C\u6B21\u4F1A\u8BDD\uFF08\u91CD\u542F\u540E\u9700\u91CD\u65B0\u6388\u6743\uFF09";
  return "\u6388\u6743\u6210\u529F";
}
var PHASE_TEXT = {
  launching: "\u6B63\u5728\u542F\u52A8\u6D4F\u89C8\u5668\u2026",
  "waiting-login": "\u8BF7\u5728\u6D4F\u89C8\u5668\u4E2D\u5B8C\u6210\u767B\u5F55",
  verifying: "\u6B63\u5728\u6821\u9A8C\u767B\u5F55\u6001\u2026",
  closing: "\u6B63\u5728\u5173\u95ED\u6D4F\u89C8\u5668\u2026"
};
function adapterLabel(id) {
  switch (id) {
    case "cdp-own-profile":
      return "\u6253\u5F00\u63D2\u4EF6\u4E13\u7528\u6D4F\u89C8\u5668\u7A97\u53E3\uFF0C\u767B\u5F55\u4E00\u6B21";
    case "firefox-sqlite":
      return "\u8BFB\u53D6 Firefox \u5DF2\u4FDD\u5B58\u7684\u767B\u5F55 Cookie";
    case "manual-paste":
      return "\u7C98\u8D34\u63A7\u5236\u53F0 Cookie";
    default:
      return id;
  }
}
function headerLine(found) {
  const names = found.browsers.map((browser) => browser.label);
  return names.length ? `\u5F53\u524D\u53EF\u7528\uFF1A${names.join(" / ")}` : "\u672A\u68C0\u6D4B\u5230\u5DF2\u5B89\u88C5\u7684\u6D4F\u89C8\u5668";
}
function LoginFlow(props) {
  const [detection, setDetection] = createSignal2(null);
  const [choice, setChoice] = createSignal2(0);
  const [progress, setProgress] = createSignal2(null);
  const [error, setError] = createSignal2(null);
  let controller = null;
  onCleanup2(() => controller?.abort());
  const detect2 = () => {
    void detectCredentialAdapters().then((next) => {
      setDetection(next);
      setChoice(0);
    }).catch(() => {
      setDetection({
        browsers: [],
        adapters: [],
        preferred: null
      });
    });
  };
  detect2();
  const options = () => detection()?.adapters ?? [];
  const start = (adapter) => {
    if (progress()) return;
    if (adapter === "manual-paste") {
      props.onManualPaste();
      return;
    }
    const abort = new AbortController();
    controller = abort;
    setError(null);
    setProgress({
      phase: "launching",
      secondsLeft: 180
    });
    void login({
      signal: abort.signal,
      adapters: [adapter],
      onProgress: setProgress
    }).then((result) => {
      if (abort.signal.aborted) return;
      controller = null;
      setProgress(null);
      if (result.ok) props.onFinished(result.storage);
      else setError(result.message);
    }).catch(() => {
      controller = null;
      setProgress(null);
      setError("\u767B\u5F55\u6D41\u7A0B\u5F02\u5E38\u4E2D\u6B62\uFF0C\u8BF7\u91CD\u8BD5");
    });
  };
  props.context.keymap.layer(() => ({
    mode: "modal",
    commands: [{
      bind: "up",
      title: "\u4E0A\u4E00\u9879",
      group: "Token Plan",
      enabled: () => !progress(),
      run: () => setChoice((index) => Math.max(0, index - 1))
    }, {
      bind: "down",
      title: "\u4E0B\u4E00\u9879",
      group: "Token Plan",
      enabled: () => !progress(),
      run: () => setChoice((index) => Math.min(options().length - 1, index + 1))
    }, {
      bind: "return",
      title: "\u5F00\u59CB\u6388\u6743",
      group: "Token Plan",
      enabled: () => !progress() && options().length > 0,
      run: () => {
        const adapter = options()[choice()];
        if (adapter) start(adapter);
      }
    }]
  }));
  const theme = () => props.context.theme;
  return (() => {
    var _el$ = _$createElement2("box");
    _$setProp2(_el$, "flexDirection", "column");
    _$insert2(_el$, _$createComponent2(Show2, {
      get when() {
        return progress();
      },
      children: (current) => (() => {
        var _el$2 = _$createElement2("box"), _el$3 = _$createElement2("text"), _el$4 = _$createElement2("text"), _el$5 = _$createTextNode(`\u5269\u4F59 `), _el$6 = _$createTextNode(` \u79D2 \xB7 Esc \u53D6\u6D88`);
        _$insertNode2(_el$2, _el$3);
        _$insertNode2(_el$2, _el$4);
        _$setProp2(_el$2, "flexDirection", "column");
        _$insert2(_el$3, () => PHASE_TEXT[current().phase] ?? "\u7B49\u5F85\u767B\u5F55");
        _$insertNode2(_el$4, _el$5);
        _$insertNode2(_el$4, _el$6);
        _$insert2(_el$4, () => current().secondsLeft, _el$6);
        _$effect2((_p$) => {
          var _v$ = theme().text.base, _v$2 = theme().text.muted;
          _v$ !== _p$.e && (_p$.e = _$setProp2(_el$3, "fg", _v$, _p$.e));
          _v$2 !== _p$.t && (_p$.t = _$setProp2(_el$4, "fg", _v$2, _p$.t));
          return _p$;
        }, {
          e: void 0,
          t: void 0
        });
        return _el$2;
      })()
    }), null);
    _$insert2(_el$, _$createComponent2(Show2, {
      get when() {
        return !progress();
      },
      get children() {
        return _$createComponent2(Show2, {
          get when() {
            return detection();
          },
          get fallback() {
            return (() => {
              var _el$7 = _$createElement2("text");
              _$insertNode2(_el$7, _$createTextNode(`\u6B63\u5728\u68C0\u6D4B\u53EF\u7528\u6D4F\u89C8\u5668\u2026`));
              _$effect2((_$p) => _$setProp2(_el$7, "fg", theme().text.muted, _$p));
              return _el$7;
            })();
          },
          children: (found) => (() => {
            var _el$9 = _$createElement2("box"), _el$0 = _$createElement2("text");
            _$insertNode2(_el$9, _el$0);
            _$setProp2(_el$9, "flexDirection", "column");
            _$insert2(_el$0, () => headerLine(found()));
            _$insert2(_el$9, _$createComponent2(Show2, {
              get when() {
                return options().length > 0;
              },
              get fallback() {
                return (() => {
                  var _el$1 = _$createElement2("text");
                  _$insertNode2(_el$1, _$createTextNode(`\u672A\u68C0\u6D4B\u5230\u53EF\u7528\u6388\u6743\u65B9\u5F0F \xB7 \u8BF7\u7A0D\u540E\u91CD\u8BD5`));
                  _$effect2((_$p) => _$setProp2(_el$1, "fg", theme().text.muted, _$p));
                  return _el$1;
                })();
              },
              get children() {
                return _$createComponent2(For2, {
                  get each() {
                    return options();
                  },
                  children: (adapter, index) => (() => {
                    var _el$11 = _$createElement2("box"), _el$12 = _$createElement2("text");
                    _$insertNode2(_el$11, _el$12);
                    _$setProp2(_el$11, "onMouseDown", () => {
                      setChoice(index());
                      start(adapter);
                    });
                    _$setProp2(_el$12, "wrapMode", "none");
                    _$insert2(_el$12, () => index() === choice() ? "\u25B6 " : "  ", null);
                    _$insert2(_el$12, () => adapterLabel(adapter), null);
                    _$insert2(_el$12, () => found().preferred === adapter ? "\uFF08\u63A8\u8350\uFF09" : "", null);
                    _$effect2((_$p) => _$setProp2(_el$12, "fg", index() === choice() ? theme().text.action.primary.selected : theme().text.base, _$p));
                    return _el$11;
                  })()
                });
              }
            }), null);
            _$effect2((_$p) => _$setProp2(_el$0, "fg", theme().text.muted, _$p));
            return _el$9;
          })()
        });
      }
    }), null);
    _$insert2(_el$, _$createComponent2(Show2, {
      get when() {
        return error();
      },
      children: (message) => (() => {
        var _el$13 = _$createElement2("text");
        _$insert2(_el$13, message);
        _$effect2((_$p) => _$setProp2(_el$13, "fg", theme().text.base, _$p));
        return _el$13;
      })()
    }), null);
    return _el$;
  })();
}

// src/tui/panel.tsx
function RowLine(props) {
  const mutedFg = colorString(props.mutedFg, PALETTE.muted);
  const baseFg = colorString(props.baseFg, PALETTE.base);
  const valueFg = colorString(props.valueFg, baseFg);
  return (() => {
    var _el$ = _$createElement3("box"), _el$2 = _$createElement3("text"), _el$3 = _$createElement3("text");
    _$insertNode3(_el$, _el$2);
    _$insertNode3(_el$, _el$3);
    _$setProp3(_el$, "flexDirection", "row");
    _$setProp3(_el$2, "fg", mutedFg);
    _$setProp3(_el$2, "wrapMode", "none");
    _$setProp3(_el$2, "truncate", true);
    _$insert3(_el$2, () => rowLabelText(props.row.label));
    _$setProp3(_el$3, "wrapMode", "none");
    _$setProp3(_el$3, "truncate", true);
    _$insert3(_el$3, () => props.row.value);
    _$effect3((_$p) => _$setProp3(_el$3, "fg", props.row.muted ? mutedFg : valueFg, _$p));
    return _el$;
  })();
}
function TokenPlanPanel(props) {
  const [mode, setMode] = createSignal3("report");
  const [notice, setNotice] = createSignal3(props.initialNotice ?? null);
  const now = createClock();
  const dimensions = useTerminalDimensions();
  let scroll;
  const close = () => props.context.ui.dialog.clear();
  const theme = () => props.context.theme;
  const maxHeight = () => Math.max(8, Math.floor(dimensions().height * 0.7) - 6);
  const repaint = (notice2) => {
    props.context.ui.dialog.show(() => _$createComponent3(TokenPlanPanel, {
      get context() {
        return props.context;
      },
      get view() {
        return props.view;
      },
      initialNotice: notice2
    }));
    props.context.ui.dialog.set({
      size: "large"
    });
  };
  const requestPaste = () => {
    setNotice(null);
    void props.context.ui.dialog.prompt({
      title: "\u7C98\u8D34\u63A7\u5236\u53F0 Cookie",
      description: "\u4ECE\u5DF2\u767B\u5F55\u7684\u767E\u70BC\u63A7\u5236\u53F0\u590D\u5236 Cookie\uFF08\u5355\u884C\uFF0C\u81F3\u5C11\u4E24\u4E2A name=value \u5BF9\uFF09\u3002\u5185\u5BB9\u4E0D\u56DE\u663E\u3001\u4E0D\u5199\u65E5\u5FD7\u3001\u4E0D\u8FDB\u7F13\u5B58\u3002",
      placeholder: "name=value; name2=value2"
    }).then(async (raw) => {
      if (raw === void 0) {
        repaint();
        return;
      }
      const result = await submitManualCookie(raw, new AbortController().signal).catch(() => ({
        ok: false,
        message: "Cookie \u6821\u9A8C\u5931\u8D25 \xB7 \u8BF7\u91CD\u8BD5"
      }));
      if (!result.ok) {
        await props.context.ui.dialog.alert({
          title: "\u6388\u6743\u5931\u8D25",
          message: result.message
        });
        repaint();
        return;
      }
      repaint({
        storage: result.storage
      });
      void props.view.refresh();
    });
  };
  const quotaSection = () => {
    const status = props.view.status();
    return status ? quotaRows(status.quota, now(), status.usagePeriods, status.usageSeries) : [{
      label: "\u72B6\u6001",
      value: "\u8F7D\u5165\u4E2D\u2026"
    }];
  };
  const discountSection = () => {
    const status = props.view.status();
    return status ? discountRows(status.discount, now()) : [];
  };
  props.context.keymap.layer(() => ({
    mode: "modal",
    commands: [{
      bind: "return",
      title: "\u5173\u95ED",
      group: "Token Plan",
      enabled: () => mode() === "report",
      run: close
    }, {
      id: "tokenplan.authorize",
      bind: "a",
      title: "\u6388\u6743 / \u91CD\u65B0\u6388\u6743",
      group: "Token Plan",
      enabled: () => mode() === "report",
      run: () => {
        setNotice(null);
        setMode("login");
      }
    }, {
      id: "tokenplan.forget",
      bind: "d",
      title: "\u9000\u51FA\u767B\u5F55 / \u6E05\u9664\u51ED\u8BC1",
      group: "Token Plan",
      enabled: () => mode() === "report",
      run: async () => {
        await forgetCredential();
        setNotice(null);
        setMode("report");
        await props.view.refresh();
      }
    }, {
      bind: "up",
      title: "\u4E0A\u4E00\u884C",
      group: "Token Plan",
      enabled: () => mode() === "report",
      run: () => scroll?.scrollBy(-1)
    }, {
      bind: "down",
      title: "\u4E0B\u4E00\u884C",
      group: "Token Plan",
      enabled: () => mode() === "report",
      run: () => scroll?.scrollBy(1)
    }, {
      bind: "pageup",
      title: "\u4E0A\u4E00\u9875",
      group: "Token Plan",
      enabled: () => mode() === "report",
      run: () => scroll?.scrollBy(-maxHeight())
    }, {
      bind: "pagedown",
      title: "\u4E0B\u4E00\u9875",
      group: "Token Plan",
      enabled: () => mode() === "report",
      run: () => scroll?.scrollBy(maxHeight())
    }]
  }));
  return (() => {
    var _el$4 = _$createElement3("box"), _el$5 = _$createElement3("text"), _el$6 = _$createElement3("text");
    _$insertNode3(_el$4, _el$5);
    _$insertNode3(_el$4, _el$6);
    _$setProp3(_el$4, "flexDirection", "column");
    _$setProp3(_el$4, "paddingLeft", 2);
    _$setProp3(_el$4, "paddingRight", 2);
    _$insert3(_el$5, () => mode() === "login" ? "Token Plan \u6388\u6743" : `Token Plan \u989D\u5EA6\u4E0E\u4F18\u60E0 \xB7 v${"0.2.21"}`);
    _$insert3(_el$4, _$createComponent3(Show3, {
      get when() {
        return notice();
      },
      children: (current) => (() => {
        var _el$7 = _$createElement3("text");
        _$insert3(_el$7, () => loginSuccessNotice(current().storage));
        _$effect3((_$p) => _$setProp3(_el$7, "fg", current().storage === "session" ? colorString(theme().text.feedback?.warning?.base, PALETTE.warning) : colorString(theme().text.base, PALETTE.base), _$p));
        return _el$7;
      })()
    }), _el$6);
    _$insert3(_el$4, _$createComponent3(Show3, {
      get when() {
        return props.view.lastError();
      },
      children: (message) => (() => {
        var _el$8 = _$createElement3("text"), _el$9 = _$createTextNode2(`\u26A0 `);
        _$insertNode3(_el$8, _el$9);
        _$insert3(_el$8, message, null);
        _$effect3((_$p) => _$setProp3(_el$8, "fg", colorString(theme().text.muted, PALETTE.muted), _$p));
        return _el$8;
      })()
    }), _el$6);
    _$insert3(_el$4, _$createComponent3(Show3, {
      get when() {
        return mode() === "login";
      },
      get fallback() {
        return (() => {
          var _el$0 = _$createElement3("scrollbox"), _el$1 = _$createElement3("box"), _el$10 = _$createElement3("text"), _el$12 = _$createElement3("text");
          _$insertNode3(_el$0, _el$1);
          _$use((element) => scroll = element, _el$0);
          _$insertNode3(_el$1, _el$10);
          _$insertNode3(_el$1, _el$12);
          _$setProp3(_el$1, "flexDirection", "column");
          _$insertNode3(_el$10, _$createTextNode2(`\u989D\u5EA6`));
          _$insert3(_el$1, _$createComponent3(For3, {
            get each() {
              return quotaSection();
            },
            children: (row) => _$createComponent3(RowLine, {
              row,
              get mutedFg() {
                return theme().text.muted;
              },
              get baseFg() {
                return theme().text.base;
              },
              get valueFg() {
                return _$memo3(() => !!row.severity)() ? quotaSeverityFg(theme(), row.severity) : void 0;
              }
            })
          }), _el$12);
          _$insertNode3(_el$12, _$createTextNode2(`\u4F18\u60E0\u7A97\u53E3`));
          _$insert3(_el$1, _$createComponent3(For3, {
            get each() {
              return discountSection();
            },
            children: (row) => _$createComponent3(RowLine, {
              row,
              get mutedFg() {
                return theme().text.muted;
              },
              get baseFg() {
                return theme().text.base;
              }
            })
          }), null);
          _$effect3((_p$) => {
            var _v$4 = maxHeight(), _v$5 = TextAttributes.BOLD, _v$6 = colorString(theme().text.action?.primary?.selected, PALETTE.base), _v$7 = TextAttributes.BOLD, _v$8 = colorString(theme().text.action?.primary?.selected, PALETTE.base);
            _v$4 !== _p$.e && (_p$.e = _$setProp3(_el$0, "maxHeight", _v$4, _p$.e));
            _v$5 !== _p$.t && (_p$.t = _$setProp3(_el$10, "attributes", _v$5, _p$.t));
            _v$6 !== _p$.a && (_p$.a = _$setProp3(_el$10, "fg", _v$6, _p$.a));
            _v$7 !== _p$.o && (_p$.o = _$setProp3(_el$12, "attributes", _v$7, _p$.o));
            _v$8 !== _p$.i && (_p$.i = _$setProp3(_el$12, "fg", _v$8, _p$.i));
            return _p$;
          }, {
            e: void 0,
            t: void 0,
            a: void 0,
            o: void 0,
            i: void 0
          });
          return _el$0;
        })();
      },
      get children() {
        return _$createComponent3(LoginFlow, {
          get context() {
            return props.context;
          },
          onFinished: (storage2) => {
            setNotice({
              storage: storage2
            });
            setMode("report");
            void props.view.refresh();
          },
          onManualPaste: requestPaste
        });
      }
    }), _el$6);
    _$insert3(_el$6, (() => {
      var _c$ = _$memo3(() => mode() === "login");
      return () => _c$() ? "Esc \u53D6\u6D88\uFF08\u4F1A\u5173\u95ED\u672C\u6B21\u542F\u52A8\u7684\u6D4F\u89C8\u5668\uFF09" : `${props.view.refreshing() ? "\u5237\u65B0\u4E2D\u2026 \xB7 " : ""}a \u6388\u6743/\u91CD\u65B0\u6388\u6743 \xB7 d \u9000\u51FA\u767B\u5F55 \xB7 \u2191\u2193 \u6EDA\u52A8 \xB7 Esc \u5173\u95ED`;
    })());
    _$effect3((_p$) => {
      var _v$ = TextAttributes.BOLD, _v$2 = colorString(theme().text.base, PALETTE.base), _v$3 = colorString(theme().text.muted, PALETTE.muted);
      _v$ !== _p$.e && (_p$.e = _$setProp3(_el$5, "attributes", _v$, _p$.e));
      _v$2 !== _p$.t && (_p$.t = _$setProp3(_el$5, "fg", _v$2, _p$.t));
      _v$3 !== _p$.a && (_p$.a = _$setProp3(_el$6, "fg", _v$3, _p$.a));
      return _p$;
    }, {
      e: void 0,
      t: void 0,
      a: void 0
    });
    return _el$4;
  })();
}

// src/tui/index.tsx
var PLUGIN_ID = "@te-river/opencode-alibabatokenplan";
var STEP_REFRESH_GAP_MS = 15e3;
function openPanel(context, view) {
  void view.refresh();
  context.ui.dialog.show(() => _$createComponent4(TokenPlanPanel, {
    context,
    view
  }));
  context.ui.dialog.set({
    size: "large"
  });
}
var index_default = Plugin.define({
  id: PLUGIN_ID,
  setup(context) {
    if (!context || !context.keymap) return () => {
    };
    const view = createTokenPlanView();
    const disposeSidebar = context.ui.slot({
      append: "sidebar.content",
      render: () => _$createComponent4(SidebarView, {
        context,
        view
      })
    });
    const disposeHome = context.ui.slot({
      append: "home.footer.status",
      render: () => _$createComponent4(FooterView, {
        context,
        view
      })
    });
    const disposePromptFooter = context.ui.slot({
      append: "prompt.footer.status",
      render: () => _$createComponent4(FooterView, {
        context,
        view
      })
    });
    context.keymap.layer(() => ({
      mode: "global",
      commands: [{
        id: "tokenplan.open",
        title: "Token Plan \u989D\u5EA6\u4E0E\u4F18\u60E0",
        group: "Token Plan",
        palette: true,
        slash: {
          name: "tokenplan"
        },
        // 同步返回：返回 Promise 会被宿主当成"已处理"。
        run: () => openPanel(context, view)
      }]
    }));
    let lastStepRefresh = 0;
    const stopSteps = context.data.on("session.step.ended", () => {
      const at = Date.now();
      if (at - lastStepRefresh < STEP_REFRESH_GAP_MS) return;
      lastStepRefresh = at;
      void view.refresh();
    });
    return () => {
      stopSteps();
      disposePromptFooter();
      disposeHome();
      disposeSidebar();
      view.dispose();
    };
  }
});
export {
  index_default as default
};
