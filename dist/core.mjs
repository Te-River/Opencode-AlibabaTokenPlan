// src/core/provider.ts
var FAMILY_ID_RE = /^alibaba(?:-.+)?$/i;
var STRICT_ID_RE = /^alibaba-token-plan(?:-[a-z]+)*$/i;
var STRICT_HOST_RE = /^token-plan(?:\.[a-z0-9-]+)*\.maas\.aliyuncs\.com$/i;
var FAMILY_MAAS_HOST_RE = /(?:^|\.)maas\.aliyuncs\.com$/i;
var FAMILY_DASHSCOPE_HOST_RE = /(?:^|\.)dashscope(?:-[a-z]+)?\.aliyuncs\.com$/i;
function hostOf(baseURL) {
  if (!baseURL) return "";
  try {
    return new URL(String(baseURL)).host.toLowerCase();
  } catch {
    return "";
  }
}
function matchProvider(providerID, baseURL, mode = "family") {
  const id = typeof providerID === "string" ? providerID.trim() : "";
  const host = hostOf(baseURL);
  if (mode === "strict") {
    if (STRICT_ID_RE.test(id)) return true;
    return !!host && STRICT_HOST_RE.test(host);
  }
  if (FAMILY_ID_RE.test(id)) return true;
  if (!host) return false;
  return FAMILY_MAAS_HOST_RE.test(host) || FAMILY_DASHSCOPE_HOST_RE.test(host);
}
function isProviderMatchMode(v) {
  return v === "family" || v === "strict";
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
function ruleWindow(rule, now = /* @__PURE__ */ new Date()) {
  const w = windowState(rule, now);
  return { active: w.active, minutesToNextBoundary: w.minutesToNextBoundary };
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
  const total = Math.max(0, Math.floor(msRemaining / 6e4));
  const d = Math.floor(total / DAY_MIN);
  const h = Math.floor(total % DAY_MIN / 60);
  const m = total % 60;
  if (d) return `${d}d${h}h`;
  if (h) return `${h}h${m}m`;
  return `${m}m`;
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
function windowCountdownText(start, end, now = /* @__PURE__ */ new Date()) {
  const w = windowState({ start, end }, now);
  return w.active ? `${fmtCountdown(w.minutesToNextBoundary)}\u540E\u7ED3\u675F\uFF08${end}\uFF09` : `${fmtCountdown(w.minutesToNextBoundary)}\u540E\u5F00\u59CB\uFF08${start}\uFF09`;
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

// src/core/qoder-snapshot.ts
var QODER_SNAPSHOT_DATE = "2026-08-31";
var QODER_ORIGIN_LABEL = "Qoder \u5FEB\u7167 2026-08-31";
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

// src/core/status.ts
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
var WRITTEN_BY = "@te-river/opencode-alibabatokenplan/server@0.1.3";
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
  // 0.1.3：仪表盘是主界面（桌面实证：无 TUI 渲染层，web 面板是唯一持久信息面）→ 默认开
  webpanel: { enabled: true, port: 7777 },
  sidebar: { order: 160, showNonTokenPlan: false },
  toast: true,
  refresh: { catalogMin: 10, quotaMin: 5 },
  providerMatch: "family",
  slash: false,
  toastOnBoot: true,
  dashboard: { autoOpen: false }
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
      if (isProviderMatchMode(raw.providerMatch)) d.providerMatch = raw.providerMatch;
      if (raw.slash !== void 0) d.slash = !!raw.slash;
      if (raw.toastOnBoot !== void 0) d.toastOnBoot = !!raw.toastOnBoot;
      if (raw.dashboard?.autoOpen !== void 0) d.dashboard.autoOpen = !!raw.dashboard.autoOpen;
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
export {
  BAILIAN_SNAPSHOT_AT,
  BAILIAN_WINDOW_RULES,
  CREDITS_PER_YUAN,
  DAY_MIN,
  DEFAULT_CONFIG,
  MODEL_ALIASES,
  QODER_INSALE_FACTORS,
  QODER_ORIGIN_LABEL,
  QODER_SNAPSHOT_DATE,
  SH_OFFSET_MIN,
  STALE_AFTER_SEC,
  STATUS_SIZE_CAP,
  TOKEN_PLAN_TEXT_MODELS,
  WRITTEN_BY,
  bailianSnapshotModels,
  buildOffers,
  buildStatus,
  cacheFilePath,
  canonicalize,
  catalogToOffers,
  configFilePath,
  fmtCountdown,
  fmtFactor,
  fmtHMS,
  fmtShortDur,
  homeSummaryLine,
  isCrossVerified,
  isProviderMatchMode,
  isStale,
  legacyCacheFile,
  legacyPortFile,
  loadConfig,
  matchProvider,
  mergeOffers,
  originRank,
  parseGroups,
  parseHm,
  parseJsonc,
  portFilePath,
  qoderSnapshotOffers,
  readStatusFile,
  ruleWindow,
  shanghaiISO,
  shanghaiMinutes,
  showStrike,
  sourceBadgeLine,
  stateDir,
  statusFilePath,
  strikethrough,
  windowCountdownText,
  windowId,
  windowState,
  writeStatusAtomic
};
