// src/tui/index.tsx
import { createElement, setProp, effect, insert, createComponent } from "@opentui/solid";
import { createSignal, onCleanup } from "solid-js";

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
var MODEL_ALIASES = {
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
  mmodel: "minimax-m2.7"
};
function canonicalize(model) {
  const k = String(model || "").toLowerCase();
  return MODEL_ALIASES[k] ?? k;
}
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
  const windowedModels = /* @__PURE__ */ new Set([
    ...out.filter((o) => o.kind === "time-window").flatMap((o) => o.models.map((m) => m.toLowerCase())),
    ...BAILIAN_WINDOW_RULES.flatMap((r) => r.models.map((m) => m.toLowerCase()))
  ]);
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
  const [h2, min] = s.split(":").map(Number);
  return h2 * 60 + (min || 0);
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
  const h2 = Math.floor(mins % DAY_MIN / 60);
  const m = mins % 60;
  const parts = [];
  if (d) parts.push(d + " \u5929");
  if (h2) parts.push(h2 + " \u5C0F\u65F6");
  parts.push(m + " \u5206\u949F");
  return parts.join(" ");
}
function fmtHMS(msRemaining) {
  const total = Math.max(0, Math.floor(msRemaining / 1e3));
  const h2 = Math.floor(total / 3600);
  const m = Math.floor(total % 3600 / 60);
  const s = total % 60;
  const p = (n) => String(n).padStart(2, "0");
  return `${p(h2)}:${p(m)}:${p(s)}`;
}
function fmtShortDur(msRemaining) {
  const total = Math.max(0, Math.floor(msRemaining / 6e4));
  const d = Math.floor(total / DAY_MIN);
  const h2 = Math.floor(total % DAY_MIN / 60);
  const m = total % 60;
  if (d) return `${d}d${h2}h`;
  if (h2) return `${h2}h${m}m`;
  return `${m}m`;
}

// src/core/text.ts
function fmtFactor(f) {
  if (f === void 0 || !Number.isFinite(f)) return void 0;
  let s = f.toFixed(2);
  s = s.replace(/0+$/, "").replace(/\.$/, ".0");
  return s + "x";
}
function sourceBadgeLine(st) {
  const cat = st.sources.catalog;
  const catLabel = cat === "qoder-snapshot" ? "Qoder\u5FEB\u7167" : cat === "bailian-live" ? "\u5B9E\u65F6" : cat === "bailian-cli" ? "CLI" : "\u5FEB\u7167";
  const t = st.updatedAt ? new Date(st.updatedAt) : void 0;
  const hhmm = t && !Number.isNaN(t.getTime()) ? t.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Shanghai" }) : "";
  return `\u6E90:${catLabel}${hhmm ? " " + hhmm : ""} \xB7 Qoder\u5FEB\u7167${st.sources.qoderSnapshot.slice(5)}`;
}
function homeSummaryLine(st, now = /* @__PURE__ */ new Date()) {
  const w = st.windows.find((x) => x.id.startsWith("offpeak")) ?? st.windows[0];
  if (!w) return "Token Plan \u6682\u65E0\u5DF2\u77E5\u4F18\u60E0";
  const starModel = w.models.find((m) => m.model === "qwen3.8-max") ?? w.models.find((m) => m.model.startsWith("qwen")) ?? w.models[0];
  const parts = [`\u9519\u5CF0 ${w.start}\u2013${w.end}`];
  if (starModel) {
    const seg = starModel.regular && starModel.effective && starModel.regular !== starModel.effective ? `${starModel.model}\xD7${starModel.regular.replace("x", "")}/\xD7${starModel.effective.replace("x", "")}` : `${starModel.model}\xD7${(starModel.effective ?? starModel.regular ?? "").replace("x", "")}`;
    parts.push(seg);
  }
  const ws = windowState(w, now);
  parts.push(`${ws.active ? "\u8DDD\u7ED3\u675F" : "\u8DDD\u5F00\u59CB"} ${fmtShortDur(ws.nextBoundaryAtMs - now.getTime())}`);
  parts.push(sourceBadgeLine(st));
  return parts.join(" \xB7 ");
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
  if (start === "22:00" && end === "08:00") return "offpeak-22-08";
  return `win-${start.replace(":", "")}-${end.replace(":", "")}`;
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
    origins: ["bailian-snapshot"],
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
function isStale(st, now = /* @__PURE__ */ new Date()) {
  const t = new Date(st.updatedAt).getTime();
  if (Number.isNaN(t)) return true;
  return now.getTime() - t > st.staleAfterSec * 1e3;
}
var STATUS_SIZE_CAP = 256 * 1024;
function stateDir() {
  return process.env.ATP_STATE_DIR || path.join(os.homedir(), ".cache", "opencode", "alibabatokenplan");
}
function statusFilePath() {
  return path.join(stateDir(), "status.json");
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
      if (Number.isInteger(raw.webpanel?.port) && raw.webpanel.port >= 1024 && raw.webpanel.port <= 65535) d.webpanel.port = raw.webpanel.port;
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
function readStatusFile(now = /* @__PURE__ */ new Date()) {
  let text;
  try {
    text = fs.readFileSync(statusFilePath(), "utf8");
  } catch {
    return { kind: "missing" };
  }
  try {
    const j = JSON.parse(text);
    if (!j || j.schemaVersion !== 1 || !Array.isArray(j.windows)) return { kind: "corrupt", error: "schema" };
    return isStale(j, now) ? { kind: "stale", status: j } : { kind: "live", status: j };
  } catch (e) {
    return { kind: "corrupt", error: String(e?.message || e) };
  }
}

// src/tui/read-status.ts
function recomputeWindows(status, now) {
  return {
    ...status,
    windows: status.windows.map((w) => {
      const ws = windowState(w, now);
      return { ...w, activeNow: ws.active, boundaryKind: ws.boundaryKind, nextBoundaryAt: ws.nextBoundaryAt };
    })
  };
}
function embeddedSnapshotView(now = /* @__PURE__ */ new Date()) {
  const status = buildStatus({ source: "snapshot", models: [], fetchedAt: "embedded" }, now);
  return { status, degraded: true };
}
function loadStatusView(now = /* @__PURE__ */ new Date()) {
  const r = readStatusFile(now);
  switch (r.kind) {
    case "live":
      return { status: r.status, degraded: false };
    case "stale":
      return { status: recomputeWindows(r.status, now), degraded: true };
    default:
      return { status: recomputeWindows(embeddedSnapshotView(now).status, now), degraded: true };
  }
}

// src/tui/index.tsx
var PKG_ID = "@te-river/opencode-alibabatokenplan";
var POLL_MS = 3e4;
var EVENT_DEBOUNCE_MS = [150, 600];
var getNow = () => Date.now();
var stopSharedTicker = null;
function h(type, props, ...children) {
  const el = createElement(type);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (k === "ref" && typeof v === "function") {
      v(el);
      continue;
    }
    if (typeof v === "function" && !k.startsWith("on")) {
      effect((p) => {
        setProp(el, k, v(), p);
      });
    } else {
      setProp(el, k, v);
    }
  }
  for (const c of children) insertChild(el, c);
  return el;
}
function insertChild(parent, c) {
  if (c === null || c === void 0 || c === false || c === "") return;
  if (Array.isArray(c)) {
    for (const x of c) insertChild(parent, x);
    return;
  }
  insert(parent, c);
}
function line(text, style = {}) {
  const props = { wrapMode: "word", ...style, content: text };
  return h("text", props);
}
var TP_PROVIDER_RE = /^alibaba-token-plan(-cn)?$/i;
var TP_HOST_RE = /token-plan\.[a-z0-9-]+\.maas\.aliyuncs\.com/i;
function isTPProviderID(id) {
  return typeof id === "string" && TP_PROVIDER_RE.test(id);
}
function sessionProviderID(api, sessionID) {
  try {
    const sess = api.state.session.get(sessionID);
    const direct = sess?.data?.model?.providerID ?? sess?.model?.providerID ?? sess?.providerID;
    if (typeof direct === "string" && direct) return direct;
  } catch {
  }
  try {
    const msgs = api.state.session.messages(sessionID) ?? [];
    for (let i = msgs.length - 1; i >= 0; i--) {
      const mi = msgs[i]?.info ?? msgs[i];
      if (typeof mi?.providerID === "string" && mi.providerID) return mi.providerID;
    }
  } catch {
  }
  return void 0;
}
function sessionIsTokenPlan(api, sessionID) {
  const pid = sessionProviderID(api, sessionID);
  if (isTPProviderID(pid)) return true;
  if (!pid) return false;
  try {
    const p = api.state.provider?.find((x) => x?.id === pid || x?.provider?.id === pid);
    const base = p?.options?.baseURL ?? p?.provider?.options?.baseURL ?? "";
    return TP_HOST_RE.test(String(base));
  } catch {
    return false;
  }
}
function anyTokenPlanProvider(api) {
  try {
    for (const p of api.state.provider ?? []) {
      if (isTPProviderID(p?.id) || isTPProviderID(p?.provider?.id)) return true;
      const base = p?.options?.baseURL ?? p?.provider?.options?.baseURL ?? "";
      if (TP_HOST_RE.test(String(base))) return true;
    }
  } catch {
  }
  return false;
}
function createViewState(api) {
  const cfg = loadConfig();
  const [view, setView] = createSignal(loadStatusView());
  const refresh = () => {
    try {
      setView(loadStatusView());
    } catch {
    }
  };
  const timer = setInterval(refresh, POLL_MS);
  timer.unref?.();
  const offs = [];
  let t1, t2;
  const debounced = () => {
    clearTimeout(t1);
    clearTimeout(t2);
    t1 = setTimeout(refresh, EVENT_DEBOUNCE_MS[0]);
    t2 = setTimeout(refresh, EVENT_DEBOUNCE_MS[1]);
  };
  for (const ev of ["message.updated", "session.idle", "tui.session.select"]) {
    try {
      offs.push(api.event.on(ev, debounced));
    } catch {
    }
  }
  onCleanup(() => {
    clearInterval(timer);
    clearTimeout(t1);
    clearTimeout(t2);
    for (const off of offs) {
      try {
        off();
      } catch {
      }
    }
  });
  return { get: view, refresh, cfg };
}
function wState(w, now) {
  return windowState(w, new Date(now));
}
function currentWindow(st, now) {
  return [...st.windows].sort((a, b) => {
    const aa = wState(a, now).active ? 0 : 1, bb = wState(b, now).active ? 0 : 1;
    if (aa !== bb) return aa - bb;
    return new Date(a.nextBoundaryAt).getTime() - new Date(b.nextBoundaryAt).getTime();
  })[0];
}
function sessionModelName(api, sessionID) {
  try {
    const sess = api.state.session.get(sessionID);
    const m = sess?.data?.model?.modelID ?? sess?.model?.modelID ?? sess?.model?.id;
    if (m) return canonicalize(String(m));
    const msgs = api.state.session.messages(sessionID) ?? [];
    for (let i = msgs.length - 1; i >= 0; i--) {
      const mi = msgs[i]?.info ?? msgs[i];
      if (mi?.modelID) return canonicalize(String(mi.modelID));
    }
  } catch {
  }
  return void 0;
}
function strikethroughText(s) {
  return s.replace(/[^\u0300-\u036f]/g, (c) => c + "\u0336");
}
function buildSidebar(api, vs, sessionID, collapsed, toggle) {
  const theme = () => api.theme.current;
  const now = getNow;
  const header = h(
    "box",
    { style: { flexDirection: "row", gap: 1 }, onMouseUp: toggle },
    line("Token Plan \u4F18\u60E0", { fg: () => theme().text }),
    line(
      () => vs.get().degraded ? `\u9759\u6001\u5FEB\u7167(\u622A\u81F3${QODER_SNAPSHOT_DATE})` : sourceBadgeLine(vs.get().status),
      { fg: () => vs.get().degraded ? theme().textMuted : theme().success }
    )
  );
  const body = h("box", { style: { flexDirection: "column" } });
  insert(body, () => {
    const sv = vs.get();
    if (collapsed()) {
      return line(() => "\u5DF2\u6298\u53E0 \xB7 /tokenplan \u67E5\u770B", { fg: theme().textMuted });
    }
    const s = sv.status;
    const w = currentWindow(s, now());
    if (!w) return line("\u6682\u65E0\u5DF2\u77E5\u4F18\u60E0\u7A97\u53E3", { fg: theme().textMuted });
    const star = w.models[0];
    const rows = [
      line(() => `${wState(w, now()).active ? "\u25B8" : "\u25B9"} ${w.label} ${w.start}\u2013${w.end}${star?.effective ? " " + star.effective : ""}`, {
        fg: () => wState(w, now()).active ? theme().success : theme().text
      }),
      line(() => `${fmtHMS(new Date(w.nextBoundaryAt).getTime() - now())} ${wState(w, now()).active ? "\u540E\u7ED3\u675F\xB7\u8FDB\u884C\u4E2D" : "\u540E\u5F00\u59CB"}`, {
        fg: () => wState(w, now()).active ? theme().success : theme().warning
      })
    ];
    const model = sessionModelName(api, sessionID);
    if (model) {
      const entry = s.discounts.find((d) => d.model === model);
      const qf = QODER_INSALE_FACTORS[model];
      const factorRules = (entry?.applies ?? []).filter(
        (r) => r.unit === "credits-factor" && r.factor !== void 0 && (r.kind === "time-window" && r.window ? wState(r.window, now()).active : true)
      );
      const cur = factorRules[factorRules.length - 1];
      const fStr = fmtFactor(cur?.factor ?? qf?.factor) ?? "\u2014";
      const bStr = fmtFactor(cur?.baseFactor ?? qf?.factor);
      const struck = bStr && bStr !== fStr ? strikethroughText(bStr) + " " : "";
      rows.push(
        line(
          () => `\u5F53\u524D ${model} ${struck}${fmtFactor(cur?.factor ?? QODER_INSALE_FACTORS[model]?.factor)}${cur ? ` ${cur.label}${isCrossVerified(cur) ? " [\u53CC\u6E90\u5370\u8BC1]" : ""}` : " Credits\u500D\u7387"}`,
          { fg: () => theme().accent }
        )
      );
    }
    for (const o of s.windows.filter((x) => x.id !== w.id).slice(0, 2)) {
      rows.push(
        line(() => {
          const ws = wState(o, now());
          return `${o.label} \xB7 ${ws.active ? "\u5269" : "\u8DDD"} ${fmtShortDur(new Date(o.nextBoundaryAt).getTime() - now())}${ws.active ? "\u7ED3\u675F" : "\u5F00\u59CB"}`;
        }, { fg: () => theme().textMuted })
      );
    }
    if (sv.degraded) rows.push(line(`\u5FEB\u7167\u53EF\u80FD\u5931\u6548 \xB7 \u6570\u636E\u622A\u81F3 ${QODER_SNAPSHOT_DATE}`, { fg: () => theme().warning }));
    return h("box", { style: { flexDirection: "column" } }, ...rows.slice(0, 6));
  });
  return h("box", { style: { flexDirection: "column" } }, header, body);
}
var TABS = [
  { key: "windows", title: "\u7A97\u53E3\u5012\u8BA1\u65F6", desc: "\u5404\u4F18\u60E0\u7A97\u53E3\u4E0E\u4E0B\u4E00\u8FB9\u754C\uFF08\u6BCF\u79D2\u8D70\u5B57\uFF09" },
  { key: "models", title: "\u6A21\u578B\u500D\u7387", desc: "\u767E\u70BC\u76EE\u5F55\u4EF7 + Qoder \u5728\u5356\u500D\u7387" },
  { key: "limited", title: "\u9650\u65F6\u4F18\u60E0", desc: "flat-cut \u660E\u7EC6\uFF08\u4E24\u5355\u4F4D\u4E0D\u4E92\u7B97\uFF09" },
  { key: "free", title: "\u514D\u8D39\u6D3B\u52A8", desc: "free-calls / policy \u4E0E\u65F6\u6548\u58F0\u660E" },
  { key: "about", title: "\u53E3\u5F84\u8BF4\u660E", desc: "\u6570\u636E\u6E90\u3001\u6C47\u7387\u3001\u5FEB\u7167\u7EA2\u7EBF" }
];
function openMainDialog(api, vs) {
  try {
    api.ui.dialog.replace(
      () => createComponent(api.ui.DialogSelect, {
        title: `Token Plan \u4F18\u60E0\uFF08Qoder \u5FEB\u7167\u622A\u81F3 ${QODER_SNAPSHOT_DATE}\uFF09`,
        options: TABS.map((t) => ({ title: t.title, value: t.key, description: t.desc })),
        current: (() => {
          try {
            return api.kv.get("atp.lastDialogTab", "windows");
          } catch {
            return "windows";
          }
        })(),
        onSelect: (opt) => {
          try {
            api.kv.set("atp.lastDialogTab", opt.value);
          } catch {
          }
          openTabDialog(api, vs, String(opt.value));
        }
      })
    );
    api.ui.dialog.setSize("medium");
  } catch {
    try {
      api.ui.toast({ variant: "error", message: "Token Plan \u9762\u677F\u6253\u5F00\u5931\u8D25" });
    } catch {
    }
  }
}
function openTabDialog(api, vs, tab) {
  const theme = () => api.theme.current;
  const now = getNow;
  const rowsFor = () => {
    const s = vs.get().status;
    const tt = now();
    switch (tab) {
      case "windows":
        return s.windows.flatMap((w) => {
          const ws = wState(w, tt);
          const head = `${w.label} [${w.start}\u2013${w.end}] ${ws.active ? "\u8FDB\u884C\u4E2D" : "\u672A\u5F00\u59CB"} \xB7 ${ws.active ? "\u8DDD\u7ED3\u675F" : "\u8DDD\u5F00\u59CB"} ${fmtHMS(new Date(w.nextBoundaryAt).getTime() - tt)}`;
          const rows = w.models.map(
            (m) => `  ${m.model} ${m.regular && m.regular !== m.effective ? strikethroughText(m.regular) + " " : ""}${m.effective ?? ""} ${m.badge ?? ""}${isCrossVerified(m) ? " [\u53CC\u6E90\u5370\u8BC1]" : ""}`
          );
          return [head, ...rows];
        });
      case "models":
        return [
          "\u2014 \u767E\u70BC\u76EE\u5F55\uFF08Credits/\u767E\u4E07tok\uFF09\u2014",
          ...s.textModels.map((m) => `${m.model} \u8F93\u5165 ${m.input} \u7F13\u5B58 ${m.cache} \u8F93\u51FA ${m.output}${m.bands ? `\uFF08${m.bands}\uFF09` : ""}${m.creditsFactor ? ` \xB7 Qoder ${m.creditsFactor}` : ""}${m.badge ? ` \xB7 ${m.badge.label}` : ""}`),
          "\u2014 Qoder \u5728\u5356\u500D\u7387\uFF08\u5FEB\u7167\uFF0C\u975E\u4F18\u60E0\uFF09\u2014",
          ...Object.entries(QODER_INSALE_FACTORS).map(([k, v]) => `${k} ${fmtFactor(v.factor)}${v.note ? ` (${v.note})` : ""}`)
        ];
      case "limited":
        return s.offers.filter((r) => r.kind === "flat-cut").flatMap((r) => [
          `${r.models.join(", ")} \xD7${r.factor ?? "-"}\uFF08${r.unit === "credits-factor" ? "Qoder Credits" : "\u767E\u70BC \xA5"}\uFF09${r.batchStack !== void 0 ? ` Batch\u53E0\u52A0\xD7${r.batchStack}` : ""}`,
          ...r.note ? ["  " + r.note] : []
        ]);
      case "free":
        return s.notices.map((n) => `[${n.kind}] ${n.text}${n.expired ? "\uFF08\u5DF2\u8FC7\u671F\uFF0C\u5FEB\u7167\u53EF\u80FD\u5931\u6548\uFF09" : ""} \xB7 ${n.source}`);
      default:
        return [
          `\u767E\u70BC\u76EE\u5F55\u6E90: ${s.sources.catalog}\uFF08live\u2192cli\u2192snapshot \u4E09\u7EA7\u56DE\u9000\uFF09`,
          `Qoder \u5FEB\u7167: ${s.sources.qoderSnapshot}\uFF08\u9759\u6001\uFF0C\u4E0D\u8C03\u7528\u4EFB\u4F55 Qoder \u79C1\u6709\u7AEF\u70B9\uFF09`,
          `\u6362\u7B97\u6CE8\u8BB0: 1 \u5143 = ${s.creditsPerYuan} Credits\uFF08${s.creditsRateNote}\uFF09`,
          "\u4E24\u5957\u5355\u4F4D\u6C38\u4E0D\u4E92\u7B97\uFF1ACredits \u500D\u7387\u4E0E \xA5 \u4EF7\u683C\u500D\u7387\u5404\u5C45\u5176 facet",
          "\u6298\u540E\u6D88\u8017\u663E\u793A\u300C\u6D88\u8017/Cost\uFF0C\u5355\u4F4D Credit\u300D\uFF1BruntimeConfig \u4F1A\u53D8\u5B9E\u9645\u6D88\u8017",
          s.quota.available ? `\u989D\u5EA6: \u5B9E\u65F6\uFF08${s.quota.checkedAt}\uFF09` : `\u989D\u5EA6: ${s.quota.hint ?? "\u4E0D\u53EF\u7528"}`
        ];
    }
  };
  try {
    api.ui.dialog.replace(() => {
      const scroll = h("scrollbox", { style: { flexGrow: 1, flexDirection: "column" } });
      insert(scroll, () => {
        const container = h("box", { style: { flexDirection: "column" } });
        for (const r of rowsFor()) insertChild(container, line(r));
        return container;
      });
      return h(
        "box",
        { style: { flexDirection: "column", height: "100%" } },
        line(`${TABS.find((x) => x.key === tab)?.title ?? tab} \xB7 \u6570\u636E\u622A\u81F3 ${QODER_SNAPSHOT_DATE} \xB7 esc \u5173\u95ED`, { fg: () => theme().textMuted }),
        scroll
      );
    });
    api.ui.dialog.setSize("large");
  } catch {
    try {
      api.ui.toast({ variant: "error", message: "Token Plan \u660E\u7EC6\u6253\u5F00\u5931\u8D25" });
    } catch {
    }
  }
}
var tui = async (api, options, _meta) => {
  const g = globalThis;
  if (g.__atpTuiLoaded) return;
  g.__atpTuiLoaded = true;
  const [nowSig, setNowSig] = createSignal(Date.now());
  getNow = nowSig;
  const sharedTick = setInterval(() => setNowSig(Date.now()), 1e3);
  sharedTick.unref?.();
  let stopped = false;
  stopSharedTicker = () => {
    if (stopped) return;
    stopped = true;
    clearInterval(sharedTick);
  };
  try {
    onCleanup(stopSharedTicker);
  } catch {
  }
  const stopTicker = stopSharedTicker;
  const vs = createViewState(api);
  let cfg = vs.cfg;
  try {
    const extra = typeof options === "string" ? void 0 : options;
    if (extra && typeof extra === "object") {
      for (const k of ["sidebar", "webpanel", "toast", "refresh"]) {
        const v = extra[k];
        if (v === void 0) continue;
        if (typeof v !== "object" || v === null) cfg[k] = v;
        else Object.assign(cfg[k] ?? {}, v);
      }
    }
  } catch {
  }
  const collapsed = () => {
    try {
      return !!api.kv.get("atp.collapsed", false);
    } catch {
      return false;
    }
  };
  const toggleCollapsed = () => {
    try {
      api.kv.set("atp.collapsed", !collapsed());
    } catch {
    }
  };
  api.slots.register({
    order: cfg.sidebar.order,
    slots: {
      sidebar_content(_ctx, props) {
        const sid = String(props?.session_id ?? "");
        if (!sid) return null;
        const tp = sessionIsTokenPlan(api, sid);
        if (!tp && !cfg.sidebar.showNonTokenPlan) return null;
        if (!tp) {
          return line(() => {
            const w = currentWindow(vs.get().status, Date.now());
            return w ? `Token Plan: ${w.label} ${wState(w, Date.now()).active ? "\u8FDB\u884C\u4E2D" : w.start + " \u5F00\u59CB"}` : "Token Plan: \u65E0\u5DF2\u77E5\u7A97\u53E3";
          }, { fg: () => api.theme.current.textMuted });
        }
        return buildSidebar(api, vs, sid, collapsed, toggleCollapsed);
      },
      home_bottom() {
        if (!anyTokenPlanProvider(api)) return null;
        return line(() => homeSummaryLine(vs.get().status, new Date(getNow())), { fg: () => api.theme.current.textMuted });
      }
    }
  });
  const dispose = api.keymap.registerLayer({
    commands: [{
      namespace: "palette",
      name: "tokenplan.main",
      title: "Token Plan \u4F18\u60E0\u603B\u89C8",
      desc: `\u767E\u70BC+Qoder \u5FEB\u7167\u4F18\u60E0\u7A97\u53E3/\u500D\u7387/\u5012\u8BA1\u65F6\uFF08\u6570\u636E\u622A\u81F3 ${QODER_SNAPSHOT_DATE}\uFF09`,
      category: "Token Plan",
      slashName: "tokenplan",
      run: () => {
        vs.refresh();
        openMainDialog(api, vs);
      }
    }],
    bindings: []
  });
  api.lifecycle.onDispose(() => {
    try {
      stopTicker();
    } catch {
    }
    try {
      dispose();
    } catch {
    }
  });
};
var index_default = { id: PKG_ID, tui };
var AliBabaTokenPlanTui = tui;
export {
  AliBabaTokenPlanTui,
  index_default as default
};
