// src/server/index.ts
import * as http from "node:http";
import * as cp from "node:child_process";
import * as fs2 from "node:fs";
import * as path2 from "node:path";
import { fileURLToPath } from "node:url";

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
var BAILIAN_WINDOW_RULES = [
  {
    id: "night-qwen38-max",
    label: "Token Plan \u591C\u95F4\u4E94\u6298",
    models: ["qwen3.8-max"],
    factor: 0.5,
    start: "22:00",
    end: "08:00",
    source: "\u5B98\u65B9\u6587\u6863 \xB7 Token Plan\uFF08\u4E2A\u4EBA\u7248\uFF09\u6982\u8FF0"
  },
  {
    id: "night-deepseek-v4-pro",
    label: "Token Plan \u591C\u95F4\u4E94\u6298",
    models: ["deepseek-v4-pro-0813"],
    factor: 0.5,
    start: "22:00",
    end: "08:00",
    source: "\u5B98\u65B9\u6587\u6863 \xB7 Token Plan\uFF08\u4E2A\u4EBA\u7248\uFF09\u6982\u8FF0"
  }
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
function parseGroups(list) {
  const out = [];
  const byName = /* @__PURE__ */ new Set();
  for (const g of list || []) {
    const items = Array.isArray(g.items) && g.items.length ? g.items : [g];
    for (const it of items) {
      const model = String(it.model || "");
      if (!model) continue;
      const m = model.match(/^(.*)-\d{4}-\d{2}-\d{2}$/);
      if (m && byName.has(m[1])) continue;
      const prices = [];
      const mp = Array.isArray(it.multiPrices) ? it.multiPrices : [];
      if (mp.length) {
        for (const range of mp) {
          for (const p of range.prices || []) {
            prices.push({
              name: p.priceName ?? p.type ?? "",
              type: p.type ?? "",
              price: Number(p.price),
              unit: p.priceUnit ?? "",
              ...p.timeBand ? { band: p.timeBand } : {},
              ...p.discount !== void 0 && p.discount !== null ? { discount: Number(p.discount) } : {},
              ...range.rangeName ? { range: range.rangeName } : {}
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
            ...p.timeBand ? { band: p.timeBand } : {},
            ...p.discount !== void 0 && p.discount !== null ? { discount: Number(p.discount) } : {}
          });
        }
      }
      byName.add(model);
      out.push({ family: model, model, provider: it.provider ?? g.provider ?? "", context: it.contextWindow, prices });
    }
  }
  return out;
}

// src/core/qoder-snapshot.ts
var QODER_SNAPSHOT_DATE = "2026-08-31";
var W_OFFPEAK = { start: "22:00", end: "08:00", tz: "Asia/Shanghai" };
var L_QWENMAX = "https://docs.qoder.cn/events/qwen-max";
var L_QWEN37 = "https://docs.qoder.cn/product-overview/qwen-3-7-series-model-staggering-discount";
var L_OFFPEAK_RULES = "https://help.aliyun.com/document_detail/3042139.html";
var L_ULTIMATE = "https://docs.qoder.com/zh/events/ultimatediscount";
var L_CANTUS = "https://docs.qoder.com/zh/events/cantuslaunch";
var L_FREECALLS = "https://docs.qoder.com/zh/events/ultimatefreecalls";
var L_REFERRAL = "https://qoder.cn/referral";
function qoderSnapshotOffers() {
  const S = QODER_SNAPSHOT_DATE;
  const o = (r) => ({
    ...r,
    origins: ["qoder-snapshot"],
    snapshotDate: S
  });
  return [
    o({
      id: "atp-offpeak-qwen38",
      kind: "time-window",
      label: "\u9519\u5CF0 5 \u6298\uFF08Off-Peak 50% off\uFF09",
      models: ["qwen3.8-max"],
      unit: "credits-factor",
      factor: 0.25,
      baseFactor: 0.5,
      window: { ...W_OFFPEAK },
      note: "\u5E38\u89C4 0.5x \u2192 \u9519\u5CF0\u65F6\u6BB5 0.25x\uFF085 \u6298\uFF09",
      links: [L_QWENMAX]
    }),
    o({
      id: "atp-offpeak-qwen37max",
      kind: "time-window",
      label: "\u9519\u5CF0 2 \u6298\uFF08Off-Peak 80% off\uFF09",
      models: ["qwen3.7-max"],
      unit: "credits-factor",
      factor: 0.1,
      baseFactor: 0.5,
      window: { ...W_OFFPEAK },
      note: "\u5E38\u89C4 0.5x \u2192 \u9519\u5CF0\u65F6\u6BB5 0.1x\uFF082 \u6298\uFF09",
      links: [L_QWEN37]
    }),
    o({
      id: "atp-offpeak-qwen37plus",
      kind: "time-window",
      label: "\u9519\u5CF0 4 \u6298\uFF08Off-Peak 60% off\uFF09",
      models: ["qwen3.7-plus"],
      unit: "credits-factor",
      factor: 0.04,
      baseFactor: 0.1,
      window: { ...W_OFFPEAK },
      note: "\u5E38\u89C4 0.1x \u2192 \u9519\u5CF0\u65F6\u6BB5 0.04x\uFF084 \u6298\uFF09",
      links: [L_QWEN37]
    }),
    o({
      id: "atp-flat-preview",
      kind: "flat-cut",
      label: "\u9650\u65F6 1 \u6298",
      models: ["qwen3.8-max-preview"],
      unit: "credits-factor",
      factor: 0.1,
      note: "\u6A21\u578B\u63CF\u8FF0\u539F\u6587\uFF1A\u5E38\u89C4\u65F6\u6BB5 1 \u6298",
      links: [L_OFFPEAK_RULES]
    }),
    o({
      id: "atp-flat-glm53f",
      kind: "flat-cut",
      label: "\u5212\u7EBF\u534A\u4EF7\uFF080.1 \u2192 0.05\uFF09",
      models: ["glm-5.3-flash"],
      unit: "credits-factor",
      factor: 0.05,
      baseFactor: 0.1,
      note: "originalPriceFactor \u7ED3\u6784\uFF0C\u65E0 promotion \u6807\u8BB0\uFF08\u5FEB\u7167\uFF09",
      links: [L_OFFPEAK_RULES]
    }),
    o({
      id: "atp-flat-ultimate",
      kind: "flat-cut",
      label: "\u9650\u65F6\u6298\u6263\u8FDB\u884C\u4E2D",
      models: ["ultimate", "cantus"],
      unit: "credits-factor",
      note: "\u6570\u503C\u672A\u516C\u5F00\uFF0C\u4EC5\u6D3B\u52A8\u6587\u6848\uFF08\u5FEB\u7167\uFF09",
      links: [L_ULTIMATE, L_CANTUS]
    }),
    o({
      id: "atp-free-200",
      kind: "free-calls",
      label: "\u6781\u81F4\u6A21\u578B 200 \u6B21\u514D\u8D39",
      models: [],
      unit: "credits-factor",
      note: "\u514D\u8D39\u989D\u5EA6\u6D3B\u52A8\uFF1B\u5DF2\u8FC7\u671F\uFF08expired:true\uFF09",
      expiry: "2026-07-30T23:59:59+08:00",
      links: [L_FREECALLS]
    }),
    o({
      id: "atp-free-800-2000",
      kind: "free-calls",
      label: "qwen3.8-max 800/2000 \u6B21\u514D\u8D39\uFF08claim\uFF09",
      models: ["qwen3.8-max"],
      unit: "credits-factor",
      note: "activityId: qwen38_800_invoke / qwen38_2000_invoke\uFF08\u5FEB\u7167\uFF09",
      links: []
    }),
    o({
      id: "atp-referral",
      kind: "policy",
      label: "\u63A8\u8350\u8FD4\u79EF\u5206 \u226440000+",
      models: [],
      unit: "credits-factor",
      note: "\u63A8\u8350\u6D3B\u52A8\u81F3 2026-09-03",
      expiry: "2026-09-03T23:59:59+08:00",
      links: [L_REFERRAL]
    }),
    o({
      id: "atp-lite",
      kind: "policy",
      label: "lite \u57FA\u7840\u6A21\u578B\u964D\u7EA7\u653F\u7B56",
      models: ["lite"],
      unit: "credits-factor",
      note: "Credits \u8017\u5C3D\u540E\u964D\u7EA7\u4E3A lite \u57FA\u7840\u6A21\u578B\uFF08\u514D\u8D39/\u6BCF\u65E5\u9650\u989D/\u9AD8\u5CF0\u65F6\u6BB5\u53D8\u6162\uFF09\uFF1B\u4F59\u989D <200 \u4F4E\u989D\u63D0\u793A\uFF1B\u9996\u6708 prorated\uFF08\u5FEB\u7167\uFF09",
      links: []
    })
  ];
}
var QODER_INSALE_FACTORS = {
  auto: { factor: 0.5 },
  "qwen3.8-flash": { factor: 0.1 },
  "qwen3.7-flash": { factor: 0.1 },
  "deepseek-v4-pro": { factor: 0.8 },
  "deepseek-v4-flash": { factor: 0.3 },
  "glm-5.3": { factor: 0.6 },
  "glm-5.2": { factor: 0.6 },
  "kimi-k2.7-code": { factor: 0.3, note: "highspeed 0.6" },
  "minimax-m2.7": { factor: 0.2 }
};

// src/core/merge.ts
function originRank(origin) {
  return { "bailian-live": 0, "bailian-cli": 1, "qoder-snapshot": 2, "bailian-snapshot": 3 }[origin];
}
var OFFPEAK_WINDOW = { start: "22:00", end: "08:00", tz: "Asia/Shanghai" };
function catalogToOffers(models, origin, snapshotDate) {
  const out = [];
  const offpeakModels = models.filter((m) => m.prices.some((p) => p.band === "offpeak")).map((m) => m.model.toLowerCase());
  if (offpeakModels.length) {
    out.push({
      id: "catalog-offpeak",
      kind: "time-window",
      label: "\u76EE\u5F55\u591C\u95F4\u4F18\u60E0\uFF08\u9519\u5CF0 5 \u6298\uFF09",
      models: offpeakModels,
      unit: "cny-price",
      factor: 0.5,
      window: { ...OFFPEAK_WINDOW },
      note: "\u76EE\u5F55\u542B offpeak \u6863\u7684\u6A21\u578B\uFF0C\u8C37\u65F6\u4EF7=\u5CF0\u65F6 5 \u6298",
      links: [],
      origins: [origin],
      ...snapshotDate ? { snapshotDate } : {}
    });
  }
  for (const m of models) {
    const model = m.model.toLowerCase();
    if (offpeakModels.includes(model)) continue;
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
function mergeOffers(all) {
  const byKey = /* @__PURE__ */ new Map();
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
function isCrossVerified(r) {
  const hasQ = r.origins.includes("qoder-snapshot");
  const hasB = r.origins.some((o) => o.startsWith("bailian-"));
  return hasQ && hasB;
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

// src/core/text.ts
function fmtFactor(f) {
  if (f === void 0 || !Number.isFinite(f)) return void 0;
  let s = f.toFixed(2);
  s = s.replace(/0+$/, "").replace(/\.$/, ".0");
  return s + "x";
}
function showStrike(base, cur) {
  const b = fmtFactor(base), c = fmtFactor(cur);
  return !!b && !!c && b !== c;
}
function strikethrough(s) {
  return s.replace(/[^\u0300-\u036f]/g, (c) => c + "\u0336");
}

// src/core/status.ts
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
var WRITTEN_BY = "@te-river/opencode-alibabatokenplan/server@0.1.0";
var STALE_AFTER_SEC = 600;
var CATALOG_ORIGIN = {
  live: "bailian-live",
  cli: "bailian-cli",
  snapshot: "bailian-snapshot"
};
function windowId(start, end) {
  const sh = (hm) => String(parseHm(hm) / 60 | 0).padStart(2, "0");
  if (start === "22:00" && end === "08:00") return "offpeak-22-08";
  return `win-${sh(start)}-${sh(end)}`;
}
function buildOffers(catalog) {
  const origin = CATALOG_ORIGIN[catalog.source] ?? "bailian-snapshot";
  const legacy = BAILIAN_WINDOW_RULES.map((r) => ({
    id: r.id,
    kind: "time-window",
    label: r.label,
    models: [...r.models],
    unit: "cny-price",
    factor: r.factor,
    window: { start: r.start, end: r.end, tz: "Asia/Shanghai" },
    note: r.source,
    links: [],
    origins: [origin],
    snapshotDate: BAILIAN_SNAPSHOT_AT
  }));
  return mergeOffers([...qoderSnapshotOffers(), ...legacy, ...catalogToOffers(catalog.models, origin, catalog.fetchedAt?.slice(0, 10))]);
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
      const cross = isCrossVerified(r);
      for (const m of r.models) {
        models.push({
          model: m,
          regular: fmtFactor(r.baseFactor),
          effective: fmtFactor(r.factor),
          badge: r.label + (cross ? " \xB7 \u53CC\u6E90\u5370\u8BC1" : ""),
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
    out.push({
      id: windowId(g.start, g.end),
      label: g.rules[0].label,
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
    const best = applies.find((r) => r.factor !== void 0);
    out.push({
      model,
      applies,
      ...best?.factor !== void 0 ? { bestFactor: best.factor, bestRuleId: best.id } : {}
    });
  }
  const seriesOrder = (n) => /^qwen/.test(n) ? 0 : /^(deepseek|glm|kimi|minimax)/.test(n) ? 1 : 2;
  out.sort((a, b) => {
    const fa = a.bestFactor ?? 1, fb = b.bestFactor ?? 1;
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
          label: w.label + (w.models.find((x) => x.model === name)?.badge?.includes("\u53CC\u6E90") ? " \xB7 \u53CC\u6E90\u5370\u8BC1" : ""),
          countdown: ws.active ? `${fmtCountdown(ws.minutesToNextBoundary)}\u540E\u7ED3\u675F\uFF08${w.end}\uFF09` : `${fmtCountdown(ws.minutesToNextBoundary)}\u540E\u5F00\u59CB\uFF08${w.start}\uFF09`
        };
        break;
      }
    }
    const insale = QODER_INSALE_FACTORS[name];
    if (!m) {
      return { model: name, input: "\u2014", cache: "\u2014", output: "\u2014", ...insale ? { creditsFactor: fmtFactor(insale.factor) } : {}, ...badge ? { badge } : {} };
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
      ...insale ? { creditsFactor: fmtFactor(insale.factor) } : {},
      ...badge ? { badge } : {}
    };
  });
}
function buildNotices(offers, now) {
  return offers.filter((r) => r.kind === "free-calls" || r.kind === "policy").map((r) => ({
    kind: r.kind,
    text: `${r.label}${r.note ? " \u2014 " + r.note : ""}`,
    source: r.origins.includes("qoder-snapshot") ? `Qoder \u5FEB\u7167 ${r.snapshotDate ?? QODER_SNAPSHOT_DATE}` : r.origins[0] ?? "unknown",
    expired: r.expiry ? new Date(r.expiry).getTime() < now.getTime() : void 0
  }));
}
function buildStatus(catalog, now = /* @__PURE__ */ new Date(), quota) {
  const offers = buildOffers(catalog);
  const windows = buildWindows(offers, now);
  return {
    schemaVersion: 1,
    writtenBy: WRITTEN_BY,
    updatedAt: now.toISOString(),
    staleAfterSec: STALE_AFTER_SEC,
    timezone: "Asia/Shanghai",
    creditsPerYuan: CREDITS_PER_YUAN,
    creditsRateNote: "\u636E\u767E\u70BC\u8BA1\u8D39\u793A\u4F8B\u6362\u7B97\uFF0C\u975E\u5B98\u65B9\u6C47\u7387",
    sources: {
      catalog: CATALOG_ORIGIN[catalog.source] ?? "bailian-snapshot",
      qoderSnapshot: QODER_SNAPSHOT_DATE,
      ...catalog.error ? { error: catalog.error } : {}
    },
    windows,
    offers,
    discounts: buildDiscounts(offers),
    textModels: buildTextModels(catalog.models, windows, now),
    quota: quota ?? { available: false, hint: "\u5B9E\u65F6\u989D\u5EA6\u9700: bl auth login --console --console-site domestic" },
    notices: buildNotices(offers, now)
  };
}
var STATUS_SIZE_CAP = 256 * 1024;
function stateDir() {
  return process.env.ATP_STATE_DIR || path.join(os.homedir(), ".cache", "opencode", "alibabatokenplan");
}
function cacheFilePath() {
  return path.join(stateDir(), "cache.json");
}
function portFilePath() {
  return path.join(stateDir(), ".port");
}
function legacyCacheFile() {
  return path.join(os.homedir(), ".cache", "opencode", "bailian-discount-cache.json");
}
function legacyPortFile() {
  return path.join(os.homedir(), ".cache", "opencode", "bailian-discount-panel.port");
}
function configFilePath() {
  return process.env.ATP_CONFIG_DIR ? path.join(process.env.ATP_CONFIG_DIR, "config.jsonc") : path.join(os.homedir(), ".config", "opencode", "alibabatokenplan", "config.jsonc");
}
function parseJsonc(text) {
  let out = "";
  let i = 0;
  let inStr = false;
  let esc = false;
  while (i < text.length) {
    const c = text[i];
    const n = text[i + 1];
    if (inStr) {
      out += c;
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      i++;
      continue;
    }
    if (c === '"') {
      inStr = true;
      out += c;
      i++;
      continue;
    }
    if (c === "/" && n === "/") {
      while (i < text.length && text[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && n === "*") {
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    out += c;
    i++;
  }
  let res = "";
  inStr = false;
  esc = false;
  i = 0;
  while (i < out.length) {
    const c = out[i];
    if (inStr) {
      res += c;
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      i++;
      continue;
    }
    if (c === '"') {
      inStr = true;
      res += c;
      i++;
      continue;
    }
    if (c === ",") {
      let j = i + 1;
      while (j < out.length && /\s/.test(out[j])) j++;
      if (out[j] === "}" || out[j] === "]") {
        i++;
        continue;
      }
    }
    res += c;
    i++;
  }
  return JSON.parse(res);
}
var DEFAULT_CONFIG = {
  webpanel: { enabled: false, port: 7777 },
  sidebar: { order: 160, showNonTokenPlan: false },
  toast: true,
  refresh: { catalogMin: 10, quotaMin: 5 }
};
function loadConfig() {
  const d = structuredClone(DEFAULT_CONFIG);
  try {
    const raw = parseJsonc(fs.readFileSync(configFilePath(), "utf8"));
    if (raw && typeof raw === "object") {
      if (raw.webpanel?.enabled !== void 0) d.webpanel.enabled = !!raw.webpanel.enabled;
      if (Number.isInteger(raw.webpanel?.port)) d.webpanel.port = raw.webpanel.port;
      if (Number.isInteger(raw.sidebar?.order)) d.sidebar.order = raw.sidebar.order;
      if (raw.sidebar?.showNonTokenPlan !== void 0) d.sidebar.showNonTokenPlan = !!raw.sidebar.showNonTokenPlan;
      if (raw.toast !== void 0) d.toast = !!raw.toast;
      if (Number.isInteger(raw.refresh?.catalogMin) && raw.refresh.catalogMin > 0) d.refresh.catalogMin = raw.refresh.catalogMin;
      if (Number.isInteger(raw.refresh?.quotaMin) && raw.refresh.quotaMin > 0) d.refresh.quotaMin = raw.refresh.quotaMin;
    }
  } catch {
  }
  return d;
}
function writeStatusAtomic(st) {
  try {
    const dir = stateDir();
    fs.mkdirSync(dir, { recursive: true });
    let payload = JSON.stringify(st);
    if (Buffer.byteLength(payload, "utf8") > STATUS_SIZE_CAP) {
      const shrunk = { ...st, textModels: st.textModels.slice(0, 20), discounts: st.discounts.slice(0, 60), offers: st.offers.slice(0, 60), windows: st.windows.slice(0, 8) };
      payload = JSON.stringify(shrunk);
      if (Buffer.byteLength(payload, "utf8") > STATUS_SIZE_CAP) payload = JSON.stringify({ ...shrunk, textModels: [], discounts: [] });
    }
    const tmp = path.join(dir, "status.json.tmp");
    fs.writeFileSync(tmp, payload);
    fs.renameSync(tmp, path.join(dir, "status.json"));
    return true;
  } catch {
    return false;
  }
}

// src/server/index.ts
var PKG_ID = "@te-river/opencode-alibabatokenplan";
var state = { source: "snapshot", fetchedAt: BAILIAN_SNAPSHOT_AT, models: bailianSnapshotModels() };
var quotaState = { available: false, hint: "\u5B9E\u65F6\u989D\u5EA6\u9700\u8981\u63A7\u5236\u53F0\u6388\u6743\uFF1A\u6267\u884C\u4E00\u6B21 bl auth login --console --console-site domestic \u540E\u81EA\u52A8\u542F\u7528" };
var ZELDA_API = "zeldaHttp.dashscopeModel./zelda/api/v1/modelCenter/listFoundationModels";
var GATEWAY_URL = "https://bailian-cs.console.aliyun.com/cli/api.json?action=BroadScopeAspnGateway&product=sfm_bailian&api=" + encodeURIComponent(ZELDA_API);
async function fetchCatalogPage(pageNo, pageSize) {
  const params = JSON.stringify({
    Api: ZELDA_API,
    V: "1.0",
    Data: {
      input: {
        pageNo,
        pageSize,
        name: "",
        providers: [],
        inferenceProviders: [],
        features: [],
        group: false,
        capabilities: [],
        contextWindows: [],
        queryPermissions: false,
        queryApplyStatus: false,
        queryActivationStatus: false,
        queryPrice: true,
        queryQpmInfo: false,
        supports: { inference: true }
      },
      cornerstoneParam: { protocol: "V2", console: "ONE_CONSOLE", productCode: "p_efm", switchUserType: 3, consoleSite: "BAILIAN_ALIYUN" }
    }
  });
  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "params=" + encodeURIComponent(params) + "&region=cn-beijing",
    signal: AbortSignal.timeout(2e4)
  });
  if (!res.ok) throw new Error(`catalog HTTP ${res.status}`);
  const j = await res.json();
  const inner = j?.data?.DataV2?.data?.data;
  if (!inner || !Array.isArray(inner.list)) throw new Error("catalog \u54CD\u5E94\u7ED3\u6784\u5F02\u5E38: " + JSON.stringify(j).slice(0, 160));
  return { total: Number(inner.total) || inner.list.length, list: inner.list };
}
async function fetchCatalogLive() {
  const all = [];
  const pageSize = 50;
  let total = Infinity;
  for (let page = 1; page <= 15 && all.length < total; page++) {
    const r = await fetchCatalogPage(page, pageSize);
    total = r.total;
    if (!r.list.length) break;
    all.push(...r.list);
  }
  if (!all.length) throw new Error("catalog \u8FD4\u56DE\u4E3A\u7A7A");
  return parseGroups(all);
}
function runBl(args, timeoutMs = 3e4) {
  return new Promise((resolve) => {
    const cmdline = process.platform === "win32" ? ["bl", ...args].join(" ") : "bl " + args.join(" ");
    const child = cp.spawn(cmdline, { shell: process.platform === "win32", env: { ...process.env, NO_COLOR: "1" } });
    let stdout = "", stderr = "";
    let done = false;
    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        child.kill();
        resolve({ code: -1, stdout, stderr: stderr + "\ntimeout" });
      }
    }, timeoutMs);
    child.stdout.on("data", (d) => stdout += d.toString());
    child.stderr.on("data", (d) => stderr += d.toString());
    child.on("error", (e) => {
      if (!done) {
        done = true;
        clearTimeout(timer);
        resolve({ code: -1, stdout, stderr: String(e) });
      }
    });
    child.on("close", (code) => {
      if (!done) {
        done = true;
        clearTimeout(timer);
        resolve({ code: code ?? -1, stdout, stderr });
      }
    });
  });
}
async function fetchCatalogCli() {
  const r = await runBl(["model", "list", "--page-size", "50", "--page", "1", "--output", "json"]);
  if (r.code !== 0) throw new Error("bl model list \u9000\u51FA\u7801 " + r.code + " " + r.stderr.slice(0, 120));
  const j = JSON.parse(r.stdout);
  const groups = Array.isArray(j) ? j : j.items || [];
  const models = parseGroups(groups);
  if (!models.length) throw new Error("bl model list \u65E0\u6570\u636E");
  return models;
}
function loadCache() {
  try {
    const j = JSON.parse(fs2.readFileSync(cacheFilePath(), "utf8"));
    if (Array.isArray(j.models) && j.models.length) return j.models;
  } catch {
  }
  try {
    const j = JSON.parse(fs2.readFileSync(legacyCacheFile(), "utf8"));
    if (Array.isArray(j.models) && j.models.length) return j.models;
  } catch {
  }
  return null;
}
function saveCache(models) {
  try {
    fs2.mkdirSync(path2.dirname(cacheFilePath()), { recursive: true });
    fs2.writeFileSync(cacheFilePath(), JSON.stringify({ savedAt: (/* @__PURE__ */ new Date()).toISOString(), models }, null, 2));
  } catch {
  }
}
function lastPort() {
  for (const f of [portFilePath(), legacyPortFile()]) {
    try {
      const v = Number(fs2.readFileSync(f, "utf8").trim());
      if (Number.isInteger(v) && v >= 1024 && v <= 65535) return v;
    } catch {
    }
  }
  return 0;
}
function savePort(port) {
  try {
    fs2.mkdirSync(path2.dirname(portFilePath()), { recursive: true });
    fs2.writeFileSync(portFilePath(), String(port));
  } catch {
  }
}
var refreshing = false;
async function refreshCatalog(cfg, force = false) {
  if (refreshing) return;
  refreshing = true;
  try {
    let models = null;
    let source = "snapshot";
    let err = "";
    try {
      models = await fetchCatalogLive();
      source = "live";
    } catch (e) {
      err = "live: " + String(e?.message || e);
      try {
        models = await fetchCatalogCli();
        source = "cli";
      } catch (e2) {
        err += " | cli: " + String(e2?.message || e2);
      }
    }
    if (models && models.length) {
      state.source = source;
      state.fetchedAt = (/* @__PURE__ */ new Date()).toISOString();
      state.models = models;
      state.error = err || void 0;
      saveCache(models);
    } else if (force) {
      const cached = loadCache();
      if (cached) {
        state.models = cached;
        state.fetchedAt = BAILIAN_SNAPSHOT_AT + "\uFF08\u7F13\u5B58\uFF09";
      }
      state.error = err || state.error;
    }
    publishStatus();
    if (cfg.toast) void maybeToast();
  } finally {
    refreshing = false;
  }
}
async function refreshQuota() {
  quotaState.checkedAt = (/* @__PURE__ */ new Date()).toISOString();
  const r = await runBl(["usage", "token-plan", "--output", "json"], 45e3);
  const out = (r.stdout || "").trim();
  if (r.code === 0 && out.startsWith("{")) {
    try {
      quotaState.data = JSON.parse(out);
      quotaState.available = true;
      quotaState.hint = void 0;
      publishStatus();
      return;
    } catch {
    }
  }
  quotaState.data = void 0;
  quotaState.available = false;
  const s = r.stderr + " " + r.stdout;
  quotaState.hint = /console|token|login|auth/i.test(s) ? "\u5B9E\u65F6\u989D\u5EA6\u9700\u8981\u63A7\u5236\u53F0\u6388\u6743\uFF1A\u6267\u884C\u4E00\u6B21 bl auth login --console --console-site domestic \u540E\u81EA\u52A8\u542F\u7528" : "\u65E0\u6CD5\u83B7\u53D6\u5B9E\u65F6\u989D\u5EA6\uFF08bl CLI \u4E0D\u53EF\u7528\u6216\u67E5\u8BE2\u5931\u8D25\uFF1A" + (r.stderr || r.stdout || "").slice(0, 120) + "\uFF09";
  publishStatus();
}
function currentStatus() {
  return buildStatus(state, /* @__PURE__ */ new Date(), { ...quotaState });
}
function publishStatus() {
  try {
    writeStatusAtomic(currentStatus());
  } catch {
  }
}
var client = null;
var lastActive = /* @__PURE__ */ new Map();
async function maybeToast() {
  const st = currentStatus();
  for (const w of st.windows) {
    const ws = windowState(w, /* @__PURE__ */ new Date());
    const prev = lastActive.get(w.id);
    if (cfgNow?.toast !== false && prev !== void 0 && prev !== ws.active && client) {
      const models = w.models.map((m) => `${m.model}${m.effective ? "\u2192" + m.effective : ""}`);
      const msg = ws.active ? `${w.label}\u5DF2\u5F00\u59CB\uFF1A${models.join("\u3001")}\uFF08\u81F3 ${w.end}\uFF0C\u5317\u4EAC\u65F6\u95F4\uFF09` : `${w.label}\u5DF2\u7ED3\u675F\uFF1A${models.join("\u3001")}\uFF08\u4E0B\u6B21 ${w.start} \u5F00\u59CB\uFF09`;
      try {
        await client.tui?.showToast?.({ body: { title: "Token Plan \u4F18\u60E0\u63D0\u9192", message: msg, variant: ws.active ? "success" : "info", duration: 8e3 } });
      } catch {
      }
    }
    lastActive.set(w.id, ws.active);
  }
}
function renderHtml() {
  try {
    const here = path2.dirname(fileURLToPath(import.meta.url));
    for (const p of [path2.join(here, "..", "src", "server", "panel.html"), path2.join(here, "panel.html")]) {
      if (fs2.existsSync(p)) return fs2.readFileSync(p, "utf8");
    }
  } catch {
  }
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>Token Plan \u4F18\u60E0\u96F7\u8FBE</title></head><body><pre id="p">\u52A0\u8F7D\u4E2D\u2026</pre><script>async function l(){var r=await fetch("/api/status");document.getElementById("p").textContent=JSON.stringify(await r.json(),null,2)}l();setInterval(l,30000);</script></body></html>`;
}
var server = null;
function startPanel(port) {
  return new Promise((resolve) => {
    const handler = (req, res) => {
      const url = (req.url || "/").split("?")[0];
      if (url === "/api/status") {
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" });
        res.end(JSON.stringify(currentStatus()));
        return;
      }
      if (url === "/api/refresh") {
        refreshCatalog(cfgNow ?? loadConfig(), true).then(() => {
          res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("ok");
        }).catch(() => {
          res.writeHead(500);
          res.end("refresh failed");
        });
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(renderHtml());
    };
    const candidates = [.../* @__PURE__ */ new Set([lastPort(), port, ...Array.from({ length: 20 }, (_, i) => port + 1 + i)])].filter((p) => p > 0);
    let idx = 0;
    const tryListen = () => {
      const p = candidates[idx];
      const s = http.createServer(handler);
      s.on("error", () => {
        if (++idx >= candidates.length) {
          resolve("");
          return;
        }
        tryListen();
      });
      s.listen(p, "127.0.0.1", () => {
        savePort(p);
        resolve(`http://127.0.0.1:${p}`);
      });
      server = s;
    };
    tryListen();
  });
}
async function loadToolHelper() {
  try {
    const m = await import("@opencode-ai/plugin");
    if (m?.tool) return m.tool;
  } catch {
  }
  const chain = function() {
    return chain;
  };
  chain.optional = () => chain;
  chain.describe = () => chain;
  const shim = (t) => t;
  shim.schema = { string: () => chain, number: () => chain, boolean: () => chain };
  return shim;
}
function unitLabel(r) {
  return r.unit === "credits-factor" ? "Credits \u500D\u7387" : "\xA5\u4EF7\u683C\u500D\u7387";
}
function renderToolOutput(filter) {
  const st = currentStatus();
  const lines = [];
  const srcNote = st.sources.catalog === "bailian-live" ? "\u5B9E\u65F6\u63A5\u53E3" : st.sources.catalog === "bailian-cli" ? "\u672C\u673A CLI" : "\u5FEB\u7167";
  lines.push(`\u6570\u636E\u6E90: ${srcNote}\uFF08\u66F4\u65B0\u4E8E ${state.fetchedAt}\uFF09+ Qoder \u5FEB\u7167 ${QODER_SNAPSHOT_DATE}\uFF08\u9759\u6001\uFF0C\u4E0D\u8C03\u79C1\u6709\u7AEF\u70B9\uFF09\uFF1B1 \u5143 = ${CREDITS_PER_YUAN} Credits\uFF08\u8BA1\u8D39\u793A\u4F8B\u6362\u7B97\uFF0C\u975E\u5B98\u65B9\u6C47\u7387\uFF09\uFF1B\u65F6\u533A Asia/Shanghai`);
  for (const w of st.windows) {
    const ws = windowState(w, /* @__PURE__ */ new Date());
    const cd = ws.active ? `${fmtCountdown(ws.minutesToNextBoundary)}\u540E\u7ED3\u675F\uFF08${w.end}\uFF09` : `${fmtCountdown(ws.minutesToNextBoundary)}\u540E\u5F00\u59CB\uFF08${w.start}\uFF09`;
    for (const m of w.models) {
      if (filter && m.model !== filter && !m.model.includes(filter)) continue;
      const strike = showStrike(parseFloat(m.regular ?? ""), parseFloat(m.effective ?? ""));
      lines.push(`\u2022 [${w.start}\u2013${w.end}] ${m.model}: ${strike ? strikethrough(m.regular) + " " : ""}${m.effective ?? ""} ${m.badge ?? ""}${isCrossVerified(m) ? "\uFF08\u53CC\u6E90\u5370\u8BC1\uFF09" : ""} \u2192 ${w.activeNow ? "\u4F18\u60E0\u4E2D\uFF0C" : ""}${cd}`);
    }
  }
  const flat = st.offers.filter((r) => r.kind === "flat-cut" && (!filter || r.models.some((x) => x === filter || x.includes(filter))));
  if (flat.length) {
    lines.push("\u9650\u65F6\u4F18\u60E0\uFF08\u4E24\u5957\u5355\u4F4D\u4E0D\u4E92\u7B97\uFF09\uFF1A");
    for (const r of flat.slice(0, 30)) {
      const tags = [r.factor !== void 0 ? `\xD7${r.factor}` : "", r.batchStack !== void 0 ? `Batch\u53E0\u52A0\xD7${r.batchStack}` : ""].filter(Boolean).join(" ");
      lines.push(`\u2022 ${r.models.join(", ")}\uFF08${unitLabel(r)}\uFF09: ${tags}${r.note ? " \u2014 " + r.note : ""}`);
    }
  }
  const tms = st.textModels.filter((m) => !filter || m.model.includes(filter));
  for (const m of tms) {
    lines.push(`\u2022 ${m.model}: \u8F93\u5165 ${m.input} / \u7F13\u5B58 ${m.cache} / \u8F93\u51FA ${m.output} Credits/\u767E\u4E07tokens${m.bands ? `\uFF08${m.bands}\uFF09` : ""}${m.creditsFactor ? ` \xB7 Qoder \u500D\u7387 ${m.creditsFactor}` : ""}${m.badge ? `\uFF08${m.badge.label}\uFF0C${m.badge.countdown}\uFF09` : ""}`);
  }
  const inSale = Object.entries(QODER_INSALE_FACTORS).filter(([k]) => !filter || k === filter);
  if (inSale.length && !filter) lines.push("Qoder \u5728\u5356\u5E38\u89C4\u500D\u7387\uFF08\u975E\u4F18\u60E0\uFF09\uFF1A" + inSale.map(([k, v]) => `${k} ${fmtFactor(v.factor)}${v.note ? "(" + v.note + ")" : ""}`).join(" \xB7 "));
  for (const n of st.notices) if (!n.expired || filter) lines.push(`\u2022 [${n.kind}] ${n.text}${n.expired ? "\uFF08\u5DF2\u8FC7\u671F\uFF09" : ""} \u6765\u6E90:${n.source}`);
  if (!st.quota.available) lines.push(`\u989D\u5EA6: ${st.quota.hint ?? "\u4E0D\u53EF\u7528"}`);
  else lines.push(`\u989D\u5EA6: \u5B9E\u65F6\u53EF\u7528\uFF08${st.quota.checkedAt}\uFF09`);
  if (st.sources.error) lines.push(`\u6570\u636E\u6E90\u964D\u7EA7: ${st.sources.error}`);
  lines.push("\u53E3\u5F84\uFF1A\u6D88\u8017/Cost \u5355\u4F4D Credit\uFF1BruntimeConfig \u4F1A\u53D8\u5B9E\u9645\u6D88\u8017\uFF1B\u6298\u6263\u4EE5\u63A7\u5236\u53F0\u8D26\u5355\u4E3A\u51C6\u3002");
  return lines.join("\n");
}
var cfgNow = null;
var plugin = async (input, options) => {
  client = input?.client ?? null;
  const g = globalThis;
  if (g.__atpServerStarted) return { event: async () => {
  } };
  g.__atpServerStarted = true;
  cfgNow = loadConfig();
  try {
    const extra = typeof options === "string" ? void 0 : options;
    if (extra && typeof extra === "object") {
      const merged = JSON.parse(JSON.stringify(cfgNow));
      for (const k of ["webpanel", "sidebar", "toast", "refresh"]) if (extra[k] !== void 0) Object.assign(merged[k] ?? {}, extra[k]);
      cfgNow = merged;
    }
  } catch {
  }
  const cfg = cfgNow ?? loadConfig();
  cfgNow = cfg;
  const cached = loadCache();
  if (cached) {
    state.models = cached;
    state.fetchedAt = BAILIAN_SNAPSHOT_AT + "\uFF08\u7F13\u5B58\uFF09";
  }
  publishStatus();
  refreshCatalog(cfg);
  refreshQuota().catch(() => {
  });
  let panelUrl = "";
  if (cfg.webpanel.enabled) {
    panelUrl = await startPanel(cfg.webpanel.port);
    console.log(`[alibabatokenplan] \u9762\u677F\u5DF2\u542F\u52A8: ${panelUrl || "\u542F\u52A8\u5931\u8D25\uFF08\u7AEF\u53E3\u8017\u5C3D\uFF09"}`);
  }
  const catalogTimer = setInterval(() => {
    refreshCatalog(cfg).catch(() => {
    });
  }, cfg.refresh.catalogMin * 6e4);
  const quotaTimer = setInterval(() => {
    refreshQuota().catch(() => {
    });
  }, cfg.refresh.quotaMin * 6e4);
  const tickTimer = setInterval(() => {
    if (cfg.toast) maybeToast().catch(() => {
    });
    publishStatus();
  }, 6e4);
  for (const t of [catalogTimer, quotaTimer, tickTimer]) t.unref?.();
  const toolHelper = await loadToolHelper();
  const S = toolHelper.schema;
  const toolDef = (descPrefix) => toolHelper({
    description: descPrefix + "\u67E5\u8BE2\u767E\u70BC Token Plan \u5F53\u524D\u4F18\u60E0\u7B56\u7565\u3001\u4F18\u60E0\u65F6\u6BB5\u4E0E\u5F00\u59CB/\u7ED3\u675F\u5012\u8BA1\u65F6\uFF08\u542B Qoder \u5FEB\u7167 2026-08-31 \u9759\u6001\u6570\u636E\uFF09\uFF0C\u4EE5\u53CA\u5404\u6A21\u578B Credits \u6D88\u8017\u500D\u7387\u3002\u53EF\u9009\u53C2\u6570 model \u8FC7\u6EE4\u5355\u4E2A\u6A21\u578B\u3002\u65E0\u9700\u767B\u5F55\u5373\u53EF\u4F7F\u7528\u3002",
    args: {
      model: S.string().optional().describe("\u6309\u6A21\u578B\u540D\u8FC7\u6EE4\uFF0C\u4F8B\u5982 qwen3.8-max")
    },
    async execute(args) {
      return { title: "Token Plan \u4F18\u60E0\u4E0E\u500D\u7387", output: renderToolOutput(args?.model ? String(args.model) : "") };
    }
  });
  return {
    event: async () => {
    },
    config: async (config) => {
      config.command = config.command ?? {};
      config.command.tokenplan = {
        description: "\u67E5\u8BE2 Token Plan \u4F18\u60E0/\u500D\u7387/\u5012\u8BA1\u65F6\uFF08\u7531 @te-river/opencode-alibabatokenplan \u6CE8\u5165\uFF1B\u672C\u515C\u5E95\u8DEF\u5F84\u7ECF LLM\uFF0C\u4F1A\u6D88\u8017 token\uFF09",
        template: "\u8C03\u7528 tokenplan_discounts \u5DE5\u5177\uFF0C\u628A\u5F53\u524D Token Plan \u4F18\u60E0\u7A97\u53E3\u3001\u5012\u8BA1\u65F6\u4E0E\u5404\u6A21\u578B\u500D\u7387\u539F\u6837\u6574\u7406\u7ED9\u6211\uFF0C\u4E0D\u8981\u989D\u5916\u53D1\u6325\u3002$ARGUMENTS"
      };
    },
    tool: {
      tokenplan_discounts: toolDef(""),
      bailian_discounts: toolDef("(\u5DF2\u5E76\u5165 tokenplan_discounts) ")
    }
  };
};
var index_default = { id: PKG_ID, server: plugin };
var AliBabaTokenPlanPlugin = plugin;
export {
  AliBabaTokenPlanPlugin,
  index_default as default
};
