// 单元测试（零宿主、零网络）：node:test 兼容的最小断言集，跑 dist/core.mjs。
// 覆盖：优惠侧回退链/合并/窗口/配置 + 额度侧（网关请求、信封解包、归一化、失败分类、缓存无凭证、浏览器探测）。
// 前置：先 npm run build（core.mjs 由 src/core/index.ts 打包）。

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { build } from "esbuild";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "atp-test-"));
process.env.ATP_STATE_DIR = path.join(tmp, "state");
// 凭证/浏览器状态根（browsers.stateRoot）：不设就会落到真实 %LOCALAPPDATA%\alibabatokenplan
process.env.ATP_STATE_ROOT = path.join(tmp, "state-root");
// 浏览器探测读的是这些环境变量：整轮测试钉到假 home，绝不碰真实用户目录
const fakeHome = path.join(tmp, "home");
const envBefore = {
  USERPROFILE: process.env.USERPROFILE,
  LOCALAPPDATA: process.env.LOCALAPPDATA,
  APPDATA: process.env.APPDATA,
  ProgramFiles: process.env.ProgramFiles,
  "ProgramFiles(x86)": process.env["ProgramFiles(x86)"],
  HOME: process.env.HOME,
};

const core = await import("../dist/core.mjs");
const {
  buildStatus,
  mergeOffers,
  canonicalize,
  windowState,
  shanghaiISO,
  windowId,
  fmtFactor,
  showStrike,
  bailianSnapshotModels,
  BAILIAN_SNAPSHOT_AT,
  matchProvider,
  buildMergedStatus,
  fetchPersonalPlanOffers,
  fmtShortDur,
  // 额度侧
  unwrap,
  classifyError,
  ratioToPercent,
  formatTs,
  pickUsageWindow,
  normalizePlan,
  normalizeAddon,
  normalizeQwenwork,
  isLoginInvalid,
  redact,
  buildGatewayUrl,
  buildRequestBody,
  API,
  COMMODITY,
  PAGE_URL,
  fetchQuota,
  readQuotaCache,
  writeQuotaCache,
  quotaCachePath,
  detectCredentialAdapters,
  // 本地用量采样（额度条）
  usageHistoryPath,
  recordUsageSample,
  readUsageHistory,
  periodUsage,
  // 服务端用量序列（token 合计文字）
  fetchUsageSeries,
  monthStartOf,
  consoleRequest,
  probeCredential,
  identToBrowser,
  parseRegProgId,
  credentialStorage,
} = core;

const formatBundle = await build({
  entryPoints: ["src/tui/format.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  write: false,
  logLevel: "silent",
});
const { barSegments, colorString, discountRows, footerLine, isQuotaMeterLine, overlayFg, percent, quotaRows, quotaSeverityFg, remainingOf, rowLabelText, segmentedBar, segmentedUsageBar, sidebarLines, splitMeter, tokenTotal, usageBar } = await import(
  `data:text/javascript;base64,${Buffer.from(formatBundle.outputFiles[0].text).toString("base64")}`,
);

const catalog = () => ({ source: "snapshot", models: bailianSnapshotModels(), fetchedAt: BAILIAN_SNAPSHOT_AT });

// 公开页相关章节的语义夹具：正文、时间与模型 ID 逐字保真，script/style 放错误数据验证剥离。
const OFFICIAL_DOC_HTML = `<!doctype html><html><head>
<style>限时夜间折扣：每晚 01:00 - 次日 02:00 调用 style-only 享 1 折。</style>
<script>限时夜间折扣：每晚 01:00 - 次日 02:00 调用 script-only 享 1 折。</script>
</head><body><section id="tppo-h-models"><h2>支持的模型</h2>
<p>重要 <strong>qwen4-max-preview 预览权益</strong>：当前为预览版；限时活动期间 Credits 消耗低至 2 折（增加 5 倍用量），每晚 22:00 - 次日 08:00 再享 4 折（即原标准的 0.8 折）。</p>
<p>限时夜间折扣 ：每晚 22:00 - 次日 08:00 调用 qwen3.8-max、qwen3.8-flash 享 4 折，调用 deepseek-v4-pro-0813、deepseek-v4-flash-0731、deepseek-v4.1-flash、deepseek-v4.1-flash-1017 享 5 折。</p>
<p><strong>decision-model-preview 限时免费</strong>：调用不消耗 Credits。</p>
<h3>千问</h3><table><tr><th>模型 ID（Model ID）</th></tr><tr><td>qwen3.8-max</td></tr></table>
</section><h2>支持的模型内置工具</h2><p>限时夜间折扣：每晚 01:00 - 次日 02:00 调用 outside-section 享 1 折。</p></body></html>`;
const OFFICIAL_DOC_NOW = new Date("2026-11-16T04:05:06.000Z");
const officialFetch = async (url) => {
  assert.equal(url, core.PERSONAL_PLAN_OFFERS_URL);
  return new Response(OFFICIAL_DOC_HTML, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
};
const officialDocument = await fetchPersonalPlanOffers({ fetchImpl: officialFetch, now: OFFICIAL_DOC_NOW });

// ═════════════════ 测试隔离：凭证状态根不落真实用户目录 ═════════════════

test("凭证隔离：ATP_STATE_ROOT 指向临时根，测试进程无落盘凭据", () => {
  assert.equal(credentialStorage(), "none");
});

// ═════════════════ 实时公开文档解析与静态时窗移除 ═════════════════

test("官方文档：qwen 4 折、DeepSeek 5 折，预览 2×4=0.8 折，免费模型不被覆盖", () => {
  assert.equal(officialDocument.fetchedAt, OFFICIAL_DOC_NOW.toISOString());
  assert.equal(officialDocument.sourceUrl, core.PERSONAL_PLAN_OFFERS_URL);
  const ruleFor = (model) => officialDocument.offers.find((rule) => rule.models.includes(model));
  for (const model of ["qwen3.8-max", "qwen3.8-flash"]) {
    assert.equal(ruleFor(model).factor, 0.4, model);
    assert.equal(ruleFor(model).label, "Token Plan 夜间四折");
    assert.deepEqual(ruleFor(model).window, { start: "22:00", end: "08:00", tz: "Asia/Shanghai" });
  }
  for (const model of ["deepseek-v4-pro-0813", "deepseek-v4-flash-0731", "deepseek-v4.1-flash", "deepseek-v4.1-flash-1017"]) {
    assert.equal(ruleFor(model).factor, 0.5, model);
    assert.deepEqual(ruleFor(model).window, { start: "22:00", end: "08:00", tz: "Asia/Shanghai" });
  }
  const preview = ruleFor("qwen4-max-preview");
  assert.equal(preview.factor, 0.08);
  assert.equal(preview.baseFactor, 0.2);
  assert.match(preview.label, /预览二折.*夜间再四折/);
  assert.equal(ruleFor("decision-model-preview"), undefined);
  assert.equal(ruleFor("script-only"), undefined);
  assert.equal(ruleFor("outside-section"), undefined);
  assert.ok(!JSON.stringify(officialDocument.offers).includes("night-qwen38-max"));
});

test("官方文档：模型列表支持顿号、和、及与逗号", async () => {
  const variant = OFFICIAL_DOC_HTML
    .replace("qwen3.8-max、qwen3.8-flash", "qwen3.8-max 和 qwen3.8-flash")
    .replace("deepseek-v4-flash-0731、deepseek-v4.1-flash、deepseek-v4.1-flash-1017", "deepseek-v4-flash-0731, deepseek-v4.1-flash 及 deepseek-v4.1-flash-1017");
  const result = await fetchPersonalPlanOffers({ fetchImpl: async () => new Response(variant), now: OFFICIAL_DOC_NOW });
  const night = result.offers.filter((rule) => rule.id.startsWith("doc-night-"));
  assert.deepEqual(night[0].models, ["qwen3.8-max", "qwen3.8-flash"]);
  assert.equal(night[1].models.length, 4);
  assert.equal(night[1].factor, 0.5);
});

test("窗口标题按整窗档位：混合 4/5 折显示区间，全 4 折显示单一折数", async () => {
  const now = new Date("2026-08-31T12:00:00+08:00");
  const mixed = buildStatus(catalog(), now, undefined, officialDocument.offers);
  assert.equal(mixed.windows.length, 1);
  assert.match(mixed.windows[0].label, /^Token Plan 夜间折扣 0\.8–5 折 · 文源 \d{4}-\d{2}-\d{2}$/);
  assert.ok(!mixed.windows[0].label.includes("夜间四折"));
  assert.ok(!mixed.windows[0].label.includes("qwen4-max-preview"));

  const uniformHtml = OFFICIAL_DOC_HTML.replace(/<p>重要[\s\S]*?<\/p>/, "").replace("享 5 折", "享 4 折");
  const uniform = await fetchPersonalPlanOffers({ fetchImpl: async () => new Response(uniformHtml), now: OFFICIAL_DOC_NOW });
  const uniformStatus = buildStatus(catalog(), now, undefined, uniform.offers);
  assert.equal(uniformStatus.windows[0].label, `Token Plan 夜间四折 · 文源 ${OFFICIAL_DOC_NOW.toISOString().slice(0, 10)}`);
});

test("官方文档：缺时间/折数或无夜间行都抛错，绝不回落旧静态规则", async () => {
  const malformed = OFFICIAL_DOC_HTML.replace("限时夜间折扣 ：每晚 22:00 - 次日 08:00", "限时夜间折扣 ：每晚 - 次日 08:00");
  await assert.rejects(fetchPersonalPlanOffers({ fetchImpl: async () => new Response(malformed) }), /时间窗口/);
  await assert.rejects(fetchPersonalPlanOffers({ fetchImpl: async () => new Response("<h2>支持的模型</h2><p>decision-model-preview 限时免费：调用不消耗 Credits。</p>") }), /夜间模型优惠/);
  assert.equal(core.BAILIAN_WINDOW_RULES, undefined);
});

test("文档 HTTP 失败原样成为错误；无文档的构建不含时窗或旧规则 ID", async () => {
  await assert.rejects(fetchPersonalPlanOffers({ fetchImpl: async () => new Response("down", { status: 503 }) }), /HTTP 503/);
  const status = buildStatus(catalog(), new Date("2026-08-31T12:00:00+08:00"));
  assert.deepEqual(status.windows, []);
  assert.ok(!JSON.stringify(status.offers).includes("night-qwen38-max"));
  const runtime = fs.readFileSync(path.resolve("dist/core.mjs"), "utf8");
  assert.ok(!runtime.includes("BAILIAN_WINDOW_RULES"));
  assert.ok(!runtime.includes("night-qwen38-max"));
});

// ═════════════════ 优惠侧（v1 保留能力，原样回归） ═════════════════

test("回退链：snapshot 目录加实时文档构建出完整 StatusFile", () => {
  const st = buildStatus(catalog(), new Date("2026-08-31T12:00:00+08:00"), undefined, officialDocument.offers);
  assert.equal(st.schemaVersion, 1);
  assert.equal(st.sources.catalog, "bailian-snapshot");
  assert.ok(st.windows.length >= 1);
  assert.equal(st.textModels.length, 8);
  assert.ok(st.offers.every((o) => o.origins.length >= 1));
});

test("额度未接入时 status.quota 给出「打开 /tokenplan 授权」指引（不再提 bailian-cli）", () => {
  const st = buildStatus(catalog(), new Date("2026-08-31T12:00:00+08:00"));
  assert.equal(st.quota.available, false);
  assert.match(st.quota.hint, /\/tokenplan/);
  assert.ok(!/console-site domestic/.test(st.quota.hint));
});

test("别名归一：模型串统一小写（Qoder 别名表已随快照移除）", () => {
  assert.equal(canonicalize("Qwen3.8-Max"), "qwen3.8-max");
  assert.equal(canonicalize(bailianSnapshotModels()[0].model.toUpperCase()), bailianSnapshotModels()[0].model.toLowerCase());
  assert.equal(canonicalize(""), "");
});

test("合并：多 model 规则拆 per-model，交集模型 origins 并集", () => {
  const base = { kind: "time-window", label: "W", unit: "cny-price", factor: 0.5, window: { start: "22:00", end: "08:00", tz: "Asia/Shanghai" }, links: [] };
  const merged = mergeOffers([
    { ...base, id: "ab", models: ["a-one", "shared"], origins: ["bailian-live"] },
    { ...base, id: "bc", models: ["shared", "c-two"], origins: ["bailian-cli"] },
  ]);
  assert.equal(merged.length, 3); // (model,窗口,factor,unit) 全等的 shared 行合 1
  const row = merged.find((o) => o.models[0] === "shared");
  assert.equal(row.models.length, 1);
  assert.ok(row.origins.includes("bailian-live") && row.origins.includes("bailian-cli"));
  assert.equal(merged.filter((o) => o.id.endsWith("#shared")).length, 1);
  assert.equal(mergeOffers([...merged]).length, merged.length); // 幂等
});

test("跨午夜窗口：00:30 在 22:00–08:00 内且距结束≈7.5h", () => {
  const w = windowState({ start: "22:00", end: "08:00" }, new Date("2026-08-31T00:30:00+08:00"));
  assert.equal(w.active, true);
  assert.equal(w.boundaryKind, "end");
  assert.equal(w.minutesToNextBoundary, 450);
  assert.match(shanghaiISO(w.nextBoundaryAtMs), /^2026-08-31T08:00:00/);
});

test("非活动窗口指向下一 start 边界", () => {
  const w = windowState({ start: "22:00", end: "08:00" }, new Date("2026-09-01T19:59:00+08:00"));
  assert.equal(w.active, false);
  assert.equal(w.boundaryKind, "start");
  assert.equal(w.minutesToNextBoundary, 121);
});

test("倍率串与划线价规则：toFixed(2) 去尾 0；仅数值不等才划线", () => {
  assert.equal(fmtFactor(0.25), "0.25x");
  assert.equal(fmtFactor(0.1), "0.1x");
  assert.equal(fmtFactor(0.5), "0.5x");
  assert.equal(showStrike(0.5, 0.5), false);
  assert.equal(showStrike(0.5, 0.25), true);
});

test("windowId 保分钟：同小时不同分钟不再碰撞；offpeak 契约命名保留", () => {
  assert.equal(windowId("22:00", "08:00"), "offpeak-22-08");
  assert.equal(windowId("09:15", "17:45"), "win-0915-1745");
  assert.notEqual(windowId("10:00", "10:30"), windowId("10:00", "10:45"));
});

test("文档窗口规则保留实时来源与文源日期，不随目录源漂移", () => {
  const stLive = buildStatus(
    { source: "snapshot", models: bailianSnapshotModels(), fetchedAt: BAILIAN_SNAPSHOT_AT },
    new Date("2026-08-31T12:00:00+08:00"),
    undefined,
    officialDocument.offers,
  );
  const night = stLive.offers.find((offer) => offer.kind === "time-window" && offer.models.includes("qwen3.8-max"));
  assert.deepEqual(night.origins, ["bailian-live"]);
  assert.equal(night.snapshotDate, officialDocument.fetchedAt.slice(0, 10));
  assert.deepEqual(night.links, [officialDocument.sourceUrl]);
});

test("matchProvider 判定表：family（默认放宽）vs strict", () => {
  const rows = [
    ["alibaba-cn", undefined, true, false],
    ["alibaba-token-plan-cn", undefined, true, true],
    ["anthropic", undefined, false, false],
    ["custom", "https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1", true, true],
    ["custom", "https://coding.dashscope.aliyuncs.com/v1", true, false],
    ["custom", "https://coding.net/api", false, false],
    ["custom", "https://token-plan.evil.io/v1", false, false],
    ["alibabaxyz", undefined, false, false],
    [undefined, undefined, false, false],
  ];
  for (const [id, base, fam, strict] of rows) {
    assert.equal(matchProvider(id, base, "family"), fam, `family(${id}, ${base})`);
    assert.equal(matchProvider(id, base, "strict"), strict, `strict(${id}, ${base})`);
  }
});

test("合并状态：TokenPlanStatus 同时带额度与优惠两段（v1 优惠雷达不丢）", () => {
  const merged = buildMergedStatus(
    { ok: false, source: null, fetchedAt: "2026-11-16T00:00:00.000Z", plan: null, window: null, addon: null, qwenwork: null, error: { kind: "none", message: "未授权" } },
    new Date("2026-08-31T12:00:00+08:00"),
    officialDocument,
  );
  assert.equal(merged.schemaVersion, 2);
  assert.equal(merged.quota.ok, false);
  assert.equal(merged.discount.catalog, "bailian-snapshot");
  assert.equal(merged.discount.snapshotDate, officialDocument.fetchedAt.slice(0, 10));
  assert.ok(merged.discount.windows.length >= 1);
  assert.match(merged.discount.windows[0].label, new RegExp(`文源 ${officialDocument.fetchedAt.slice(0, 10)}`));
  assert.ok(merged.discount.textModels.length >= 1); // 价格表必须跟着走（不是 models:[] 的空壳）
  assert.ok(merged.discount.discounts.some((d) => d.model === "qwen3.8-max" && d.bestFactors["cny-price"] === 0.4));
});

// ═════════════════ TUI 显示行为：短倒计时 / 动态优惠 / 无数据隐藏 ═════════════════

const noQuota = {
  ok: false,
  source: null,
  fetchedAt: "2026-11-16T00:00:00.000Z",
  plan: null,
  window: null,
  addon: null,
  qwenwork: null,
  error: { kind: "none", message: "未授权 · 打开 /tokenplan 授权" },
};

test("合并状态首帧无文档时无优惠窗口，传入成功文档后才展示", () => {
  const now = new Date("2026-08-31T23:00:00+08:00");
  assert.deepEqual(buildMergedStatus(noQuota, now).discount.windows, []);
  const withDocument = buildMergedStatus(noQuota, now, officialDocument);
  assert.equal(withDocument.discount.windows.length, 1);
  assert.equal(withDocument.discount.snapshotDate, officialDocument.fetchedAt.slice(0, 10));
});

function withDistantWindow(status, nowMs) {
  const night = status.discount.windows.find((view) => view.start === "22:00" && view.end === "08:00");
  assert.ok(night, "成功文档必须含夜间窗口");
  status.discount.windows.push({
    ...night,
    id: "test-distant-window",
    label: "较远窗口",
    activeNow: false,
    nextBoundaryAt: new Date(nowMs + 48 * 60 * 60 * 1000).toISOString(),
    models: [],
  });
  return night;
}

test("fmtShortDur：不足一分钟向上取整显示秒，分钟/小时/天档位不变", () => {
  assert.equal(fmtShortDur(47_000), "47s");
  assert.equal(fmtShortDur(59_900), "60s");
  assert.equal(fmtShortDur(60_000), "1m");
  assert.equal(fmtShortDur(0), "0s");
  assert.equal(fmtShortDur(-1), "0s");
  assert.equal(fmtShortDur(65_000), "1m");
  assert.equal(fmtShortDur((5 * 60 + 23) * 60_000), "5h23m");
  assert.equal(fmtShortDur(26 * 60 * 60_000), "1d2h");
  assert.equal(fmtShortDur((2 * 24 * 60 + 3 * 60 + 4) * 60_000), "2d3h");
});

test("usageBar：非法值为空；█ 未用实心 + ░ 已用虚影（0/50/100 均固定 16 格）", () => {
  assert.equal(usageBar(null), "");
  assert.equal(usageBar(undefined), "");
  assert.equal(usageBar(Number.NaN), "");
  assert.equal(usageBar(0), "█".repeat(16));
  assert.equal(usageBar(50), "█".repeat(8) + "░".repeat(8));
  assert.equal(usageBar(100), "░".repeat(16));
  assert.equal(usageBar(-1), "█".repeat(16));
  assert.equal(usageBar(101), "░".repeat(16));
});

test("percent：固定一位小数（四舍五入到 0.1），非法值为破折号", () => {
  assert.equal(percent(83.25), "83.3%");
  assert.equal(percent(83), "83.0%");
  assert.equal(percent(82.64), "82.6%");
  assert.equal(percent(17.36), "17.4%");
  assert.equal(percent(0), "0.0%");
  assert.equal(percent(null), "—");
  assert.equal(percent(undefined), "—");
  assert.equal(percent(Number.NaN), "—");
});

test("discountRows：进行中只选最近窗口，qwen 全部在前，其余品牌随后、各按折数升序", () => {
  const now = new Date("2026-08-31T23:00:00+08:00");
  const status = buildMergedStatus(noQuota, now, officialDocument);
  const night = withDistantWindow(status, now.getTime());
  const template = night.models[0];
  assert.ok(template);
  night.models = [
    { ...template, model: "glm-test", effective: "0.5x" },
    { ...template, model: "qwen3-test-b", effective: "0.2x" },
    { ...template, model: "Qwen3-test-a", effective: "0.2x" },
    { ...template, model: "deepseek-test", effective: "0.1x" },
    { ...template, model: "qwen4-test", effective: "0.1x" },
  ];
  const rows = discountRows(status.discount, now.getTime());
  assert.equal(rows[0].label, night.label.replace(/^Token Plan\s+/, ""));
  assert.ok(!rows[0].label.startsWith("Token Plan"));
  assert.match(rows[0].value, /^22:00–08:00 · .+ 后(开始|结束)$/);
  assert.match(rows[0].value, /^22:00–08:00 · /);
  assert.ok(rows[0].label.includes("文源"));
  // 面板不再限三行：qwen 组（折数升序、同折按名）在最前，非 qwen 组随后。
  assert.deepEqual(rows.slice(1).map((row) => row.label.trim()), [
    "qwen4-test",
    "Qwen3-test-a",
    "qwen3-test-b",
    "deepseek-test",
    "glm-test",
  ]);
  const rendered = JSON.stringify(rows);
  assert.ok(!rendered.includes("较远窗口"));
  assert.ok(!rendered.includes("输入 "));
  assert.ok(!rendered.includes("缓存 "));
  assert.ok(!rendered.includes("目录源"));
});

test("discountRows：夜间五折未开始时仍只显示最近窗口及开始倒计时", () => {
  const now = new Date("2026-08-31T12:00:00+08:00");
  const status = buildMergedStatus(noQuota, now, officialDocument);
  const night = withDistantWindow(status, now.getTime());
  const rows = discountRows(status.discount, now.getTime());
  assert.equal(rows[0].label, night.label.replace(/^Token Plan\s+/, ""));
  assert.match(rows[0].value, /^22:00–08:00 · .+ 后开始$/);
  assert.ok(!JSON.stringify(rows).includes("较远窗口"));
});

test("discountRows：空模型只留窗口行，空窗口完全不产出占位行", () => {
  const now = new Date("2026-08-31T23:00:00+08:00");
  const status = buildMergedStatus(noQuota, now, officialDocument);
  const night = status.discount.windows.find((view) => view.start === "22:00" && view.end === "08:00");
  assert.ok(night);
  status.discount.windows = [{ ...night, models: [] }];
  const rows = discountRows(status.discount, now.getTime());
  assert.equal(rows.length, 1);
  assert.equal(rows[0].label, night.label.replace(/^Token Plan\s+/, ""));
  assert.match(rows[0].value, /^22:00–08:00 · /);
  status.discount.windows = [];
  assert.deepEqual(discountRows(status.discount, now.getTime()), []);
});

test("discountRows：真实文档 7 个模型全展示，qwen 组全部排在非 qwen 之前", () => {
  const now = new Date("2026-11-16T23:00:00+08:00");
  const status = buildMergedStatus(noQuota, now, officialDocument);
  const rows = discountRows(status.discount, now.getTime());
  const models = rows.slice(1);
  const window = status.discount.windows[0];
  assert.ok(window, "真实文档必须含夜间窗口");
  assert.equal(models.length, window.models.length);
  assert.equal(models.length, 7);
  const names = models.map((row) => row.label.trim());
  const qwenCount = names.filter((name) => name.toLowerCase().startsWith("qwen")).length;
  assert.equal(qwenCount, 3);
  assert.deepEqual(names.slice(0, qwenCount), ["qwen4-max-preview", "qwen3.8-flash", "qwen3.8-max"]);
  assert.ok(
    names.slice(qwenCount).every((name) => !name.toLowerCase().startsWith("qwen")),
    `qwen 行必须全在前面: ${names.join(",")}`,
  );
  const factors = models.map((row) => Number.parseFloat(/现价 ([\d.]+)x/.exec(row.value)[1]));
  assert.deepEqual(factors.slice(0, qwenCount), [...factors.slice(0, qwenCount)].sort((a, b) => a - b));
  assert.deepEqual(factors.slice(qwenCount), [...factors.slice(qwenCount)].sort((a, b) => a - b));
});

test("版本注入：构建产物面板标题带 package.json 版本", () => {
  const version = JSON.parse(fs.readFileSync("package.json", "utf8")).version;
  // esbuild 把非 ASCII 转义成 \uXXXX / \xXX，断言前先还原成字面量。
  const bundle = fs
    .readFileSync("dist/tui.js", "utf8")
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)));
  assert.ok(bundle.includes("Token Plan 额度与优惠 · v"));
  assert.ok(bundle.includes(version));
});

test("sidebarLines：未授权不占行，倒计时独占第 2 行，模型行最多三行且全部是 qwen", () => {
  const now = new Date("2026-08-31T23:00:00+08:00");
  const status = buildMergedStatus(noQuota, now, officialDocument);
  const discountOnly = sidebarLines(status, now.getTime());
  assert.equal(discountOnly.length, 4); // 倒计时 + 3 模型
  assert.match(discountOnly[0], /^夜间 .+ 后结束$/);
  assert.ok(!/qwen|折/.test(discountOnly[0]));
  // 真实文档有 3 个 qwen（0.8 / 4 / 4 折），一行一个，同折按名称（flash < max）；行尾不再拼倒计时。
  assert.deepEqual(discountOnly.slice(1, 3), ["qwen4-max-preview 0.8 折", "qwen3.8-flash 4 折"]);
  assert.equal(discountOnly[3], "qwen3.8-max 4 折");
  assert.ok(!/文源|Token Plan 夜间折扣|0\.8–5 折/.test(discountOnly.join(" ")));
  assert.ok(!/未授权|待刷新/.test(discountOnly.join(" ")));
  status.discount.windows = [];
  assert.deepEqual(sidebarLines(status, now.getTime()), []);
  const empty = buildMergedStatus({ ...noQuota, ok: true, error: null }, now);
  empty.discount.windows = [];
  assert.deepEqual(sidebarLines(empty, now.getTime()), []);
});

test("sidebarLines：qwen 不足三个时用其他品牌按折数升序补齐，总计三行模型", () => {
  const now = new Date("2026-08-31T23:00:00+08:00");
  const status = buildMergedStatus(
    {
      ...noQuota,
      ok: true,
      error: null,
      window: { window: "month", usedPercent: 50, remainingPercent: 50, resetTime: null, resetAtMs: now.getTime() + 86_400_000 },
    },
    now,
    officialDocument,
  );
  const night = status.discount.windows[0];
  assert.ok(night);
  const template = night.models[0];
  night.models = [
    { ...template, model: "deepseek-v4-pro", effective: "0.5x" },
    { ...template, model: "qwen3.8-max", effective: "0.4x" },
    { ...template, model: "glm-4.6", effective: "0.3x" },
    { ...template, model: "deepseek-v4-flash", effective: "0.2x" },
  ];
  const lines = sidebarLines(status, now.getTime());
  assert.match(lines[0], /^月额度 · .+ 后重置$/);
  assert.match(lines[1], /^[█░]{16} 50\.0%$/);
  assert.match(lines[2], /^夜间 .+ 后结束$/);
  assert.equal(lines.length, 6); // 月2 + 倒计时 + 3 模型
  assert.equal(lines[3], "qwen3.8-max 4 折");
  assert.equal(lines[4], "deepseek-v4-flash 2 折");
  assert.equal(lines[5], "glm-4.6 3 折");
});

test("sidebarLines：qwen 超过三个时只取前三个，其他品牌一律让位", () => {
  const now = new Date("2026-08-31T23:00:00+08:00");
  const status = buildMergedStatus(noQuota, now, officialDocument);
  const night = status.discount.windows[0];
  assert.ok(night);
  const template = night.models[0];
  night.models = [
    { ...template, model: "qwen-a", effective: "0.5x" },
    { ...template, model: "qwen-b", effective: "0.1x" },
    { ...template, model: "qwen-c", effective: "0.3x" },
    { ...template, model: "qwen-d", effective: "0.2x" },
    { ...template, model: "deepseek-x", effective: "0.05x" },
  ];
  const lines = sidebarLines(status, now.getTime());
  assert.equal(lines.length, 4); // 倒计时 + 3 模型
  assert.match(lines[0], /^夜间 .+ 后结束$/);
  assert.deepEqual(lines.slice(1).map((line) => line.split(" ")[0]), ["qwen-b", "qwen-d", "qwen-c"]);
  assert.ok(!lines.join(" ").includes("deepseek-x"));
});

test("sidebarLines：有窗口没有模型时保留一行灰色夜间兜底，没有窗口则完全不占行", () => {
  const now = new Date("2026-08-31T12:00:00+08:00");
  const status = buildMergedStatus(noQuota, now, officialDocument);
  const night = status.discount.windows[0];
  assert.ok(night);
  status.discount.windows = [{ ...night, models: [] }];
  const fallback = sidebarLines(status, now.getTime());
  assert.equal(fallback.length, 1);
  assert.match(fallback[0], /^夜间 \S+ 后开始$/);
  status.discount.windows = [];
  assert.deepEqual(sidebarLines(status, now.getTime()), []);
});

test("sidebarLines：总量为 0 的加购不占行，正数总量才显示", () => {
  const now = new Date("2026-08-31T23:00:00+08:00");
  const base = buildMergedStatus({ ...noQuota, ok: true, error: null }, now);
  base.discount.windows = [];
  const zero = { ...base, quota: { ...base.quota, addon: { totalCredits: 0, remainingCredits: 0, activeCount: null, usedPercent: null } } };
  assert.deepEqual(sidebarLines(zero, now.getTime()), []);
  const positive = { ...base, quota: { ...base.quota, addon: { totalCredits: 2000, remainingCredits: 1800, activeCount: null, usedPercent: 10 } } };
  assert.deepEqual(sidebarLines(positive, now.getTime()), ["加购剩余 1,800 credits"]);
});

// ═════════════════ 本地采样（额度条）+ 服务端 token 合计（文字） ═════════════════

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const SERIES_NOW = Date.parse("2026-11-19T12:00:00+08:00");
const SERIES_POINTS = 168;
const MONTH_POINTS = 720;
const usageQuota = {
  ...noQuota,
  ok: true,
  error: null,
  window: { window: "month", usedPercent: 82.6, remainingPercent: 17.4, resetTime: null, resetAtMs: SERIES_NOW + DAY_MS },
};
const sampledPeriods = {
  week: { usedPercent: 72.6, since: SERIES_NOW - 6 * DAY_MS, samples: 3 },
  fiveHour: { usedPercent: 42.6, since: SERIES_NOW - 4 * HOUR_MS, samples: 2 },
};
const noSamples = {
  week: { usedPercent: 0, since: null, samples: 0 },
  fiveHour: { usedPercent: 0, since: null, samples: 0 },
};

test("usage-history：三条采样差分出近 7 天 72.6%、近 5h 42.6%，无样本为 0", () => {
  fs.rmSync(usageHistoryPath(), { force: true });
  recordUsageSample({ at: SERIES_NOW - 6 * DAY_MS, usedPercent: 10, remainingPercent: 90 });
  recordUsageSample({ at: SERIES_NOW - 4 * HOUR_MS, usedPercent: 40, remainingPercent: 60 });
  recordUsageSample({ at: SERIES_NOW, usedPercent: 82.6, remainingPercent: 17.4 });
  const history = readUsageHistory();
  assert.equal(history.length, 3);
  const week = periodUsage(history, SERIES_NOW, 7 * DAY_MS);
  assert.equal(week.usedPercent, 72.6);
  assert.equal(week.since, SERIES_NOW - 6 * DAY_MS);
  assert.equal(week.samples, 3);
  const fiveHour = periodUsage(history, SERIES_NOW, 5 * HOUR_MS);
  assert.equal(fiveHour.usedPercent, 42.6);
  assert.equal(fiveHour.samples, 2);
  assert.deepEqual(periodUsage([], SERIES_NOW, 7 * DAY_MS), { usedPercent: 0, since: null, samples: 0 });
  // 额度重置让「已用」回退时，增量不得为负
  const reset = periodUsage(
    [{ at: SERIES_NOW - 1000, usedPercent: 80, remainingPercent: 20 }, { at: SERIES_NOW, usedPercent: 2, remainingPercent: 98 }],
    SERIES_NOW,
    7 * DAY_MS,
  );
  assert.equal(reset.usedPercent, 0);
  // 同一毫秒覆盖，不新增样本
  recordUsageSample({ at: SERIES_NOW, usedPercent: 83, remainingPercent: 17 });
  assert.equal(readUsageHistory().length, 3);
  fs.rmSync(usageHistoryPath(), { force: true });
});

test("usage-history：裁剪 8 天，损坏文件读回空数组", () => {
  fs.rmSync(usageHistoryPath(), { force: true });
  recordUsageSample({ at: SERIES_NOW - 9 * DAY_MS, usedPercent: 5, remainingPercent: 95 });
  recordUsageSample({ at: SERIES_NOW, usedPercent: 6, remainingPercent: 94 });
  const kept = readUsageHistory();
  assert.equal(kept.length, 1);
  assert.equal(kept[0].usedPercent, 6);
  fs.writeFileSync(usageHistoryPath(), "{not json");
  assert.deepEqual(readUsageHistory(), []);
  fs.rmSync(usageHistoryPath(), { force: true });
});

/** 真实接口形状（本机实测）：DataV2.data.data.originData 共 5 条 series（total_tokens 为求和目标）。 */
function serverUsageEnvelope(values, stepMs = DAY_MS) {
  const start = SERIES_NOW - values.length * stepMs;
  const points = values.map((value, index) => ({ value, timestamp: start + index * stepMs }));
  return {
    code: 200,
    data: {
      DataV2: {
        data: {
          data: {
            originData: [
              { labels: { unit: "tokens", usage_type: "total_tokens" }, points },
              ...["input_tokens", "output_tokens", "cache_read_tokens", "cache_write_tokens"].map((usage_type) => ({
                labels: { unit: "tokens", usage_type },
                points: points.map((point) => ({ ...point, value: 7 })),
              })),
            ],
          },
        },
      },
    },
  };
}

const RESET_AT = Date.parse("2026-12-01T00:00:00+08:00");
const MONTH_START = Date.parse("2026-11-01T00:00:00+08:00");
// 日粒度 20 个点（值 1..20），小时粒度 168 个点（值 1..168）
const dailyPoints = Array.from({ length: 20 }, (_, index) => index + 1);
const hourlyPoints = Array.from({ length: SERIES_POINTS }, (_, index) => index + 1);
const DAILY_7D_SUM = 14 + 15 + 16 + 17 + 18 + 19 + 20;
const HOURLY_5H_SUM = 164 + 165 + 166 + 167 + 168;

/** 按 step 路由：86400 → 日粒度，3600 → 小时粒度。 */
const seriesRequest = (daily = () => serverUsageEnvelope(dailyPoints)) =>
  async (api, data) => (data.reqDTO.step === 3600 ? serverUsageEnvelope(hourlyPoints, HOUR_MS) : daily(data.reqDTO));

const usageSeries = {
  fetchedAt: SERIES_NOW,
  tokensMonth: 860_923_892,
  tokens7d: 106_040_000,
  tokens5h: 1_200_000,
  source: "server",
};

test("monthStartOf：resetAtMs 往前一个自然月（Asia/Shanghai 日历月，不按 30 天）", () => {
  assert.equal(monthStartOf(RESET_AT), MONTH_START);
  assert.equal(monthStartOf(null), null);
  assert.equal(monthStartOf(undefined), null);
  // 3/31 往前一个月没有 31 日：夹到 2/28
  assert.equal(monthStartOf(Date.parse("2026-03-31T00:00:00+08:00")), Date.parse("2026-02-28T00:00:00+08:00"));
});

test("fetchUsageSeries：日粒度合并查询 —— tokensMonth=全部和、tokens7d=尾部 7 点和；5h 取小时序列尾部 5 点", async () => {
  const calls = [];
  const series = await fetchUsageSeries({
    now: SERIES_NOW,
    resetAtMs: RESET_AT,
    requestImpl: async (api, data) => {
      calls.push({ api, dto: data.reqDTO });
      return seriesRequest()(api, data);
    },
  });
  const daily = calls.find((call) => call.dto.step === 86400);
  const hourly = calls.find((call) => call.dto.step === 3600);
  assert.equal(calls.length, 2);
  assert.equal(daily.api, API.modelMonitor);
  assert.equal(daily.api, "zeldaEasy.bailian-telemetry.platform-model.getModelMonitorDataWithOss");
  assert.equal(daily.dto.productMode, "TokenPlanPersonal");
  assert.equal(daily.dto.startTime, MONTH_START);
  assert.equal(daily.dto.endTime, SERIES_NOW);
  assert.deepEqual(daily.dto.metricFilters, [{ aggMethod: "sum", metricName: "model_usage" }]);
  // 5h 不用 5h 区间（实测返回 0 条 series），而是 7 天小时序列
  assert.equal(hourly.dto.startTime, SERIES_NOW - 7 * DAY_MS);
  assert.equal(hourly.dto.step, 3600);
  assert.equal(series.fetchedAt, SERIES_NOW);
  assert.equal(series.tokensMonth, 210);
  assert.equal(series.tokens7d, DAILY_7D_SUM);
  assert.equal(series.tokens5h, HOURLY_5H_SUM);
});

test("fetchUsageSeries：月查询空 series → tokensMonth 省略并单独补查 7 天，不拿 30 天冒充月合计", async () => {
  const dailyStarts = [];
  const series = await fetchUsageSeries({
    now: SERIES_NOW,
    resetAtMs: RESET_AT,
    requestImpl: seriesRequest((dto) => {
      dailyStarts.push(dto.startTime);
      // 月起点超出服务端保留期：成功但没有 series
      if (dto.startTime === MONTH_START) return { code: 200, data: { DataV2: { data: { data: { originData: [] } } } } };
      return serverUsageEnvelope(dailyPoints.slice(-7));
    }),
  });
  assert.equal(series.tokensMonth, undefined);
  assert.equal(series.tokens7d, DAILY_7D_SUM);
  assert.equal(series.tokens5h, HOURLY_5H_SUM);
  assert.deepEqual(dailyStarts, [MONTH_START, SERIES_NOW - 7 * DAY_MS]);
});

test("fetchUsageSeries：resetAtMs 不可用时只查 7 天窗口，月合计省略但 7d/5h 仍在", async () => {
  const dailyStarts = [];
  const series = await fetchUsageSeries({
    now: SERIES_NOW,
    resetAtMs: null,
    requestImpl: seriesRequest((dto) => {
      dailyStarts.push(dto.startTime);
      return serverUsageEnvelope(dailyPoints.slice(-7));
    }),
  });
  assert.deepEqual(dailyStarts, [SERIES_NOW - 7 * DAY_MS]);
  assert.equal(series.tokensMonth, undefined);
  assert.equal(series.tokens7d, DAILY_7D_SUM);
  assert.equal(series.tokens5h, HOURLY_5H_SUM);
});

test("fetchUsageSeries：失败只丢对应项（可回部分数据），三项全无 → null", async () => {
  const allFail = await fetchUsageSeries({
    now: SERIES_NOW,
    resetAtMs: RESET_AT,
    requestImpl: async () => {
      throw new Error("network");
    },
  });
  assert.equal(allFail, null);
  const gatewayError = await fetchUsageSeries({ now: SERIES_NOW, requestImpl: async () => ({ code: 500, message: "boom" }) });
  assert.equal(gatewayError, null);
  const empty = await fetchUsageSeries({
    now: SERIES_NOW,
    requestImpl: async () => ({ code: 200, data: { DataV2: { data: { data: { originData: [] } } } } }),
  });
  assert.equal(empty, null);
  // 只有小时序列可用：仍返回对象，但没有 month/7d（界面按字段存在性决定是否显示合计）
  const hourlyOnly = await fetchUsageSeries({
    now: SERIES_NOW,
    resetAtMs: RESET_AT,
    requestImpl: async (api, data) => {
      if (data.reqDTO.step === 3600) return serverUsageEnvelope(hourlyPoints, HOUR_MS);
      throw new Error("daily down");
    },
  });
  assert.equal(hourlyOnly.tokensMonth, undefined);
  assert.equal(hourlyOnly.tokens7d, undefined);
  assert.equal(hourlyOnly.tokens5h, HOURLY_5H_SUM);
});

test("tokenTotal：K/M/B 固定两位小数、Token 全称；<1000 用整数", () => {
  assert.equal(tokenTotal(999), "999 Token");
  assert.equal(tokenTotal(1234), "1.23K Token");
  assert.equal(tokenTotal(106_040_000), "106.04M Token");
  assert.equal(tokenTotal(817_140_000), "817.14M Token");
  assert.equal(tokenTotal(1_200_000), "1.20M Token");
  assert.equal(tokenTotal(860_923_892), "860.92M Token");
  assert.equal(tokenTotal(5_600_000_000), "5.60B Token");
  assert.equal(tokenTotal(null), "");
  assert.equal(tokenTotal(Number.NaN), "");
});

test("segmentedUsageBar / segmentedBar：左 █ 未用 + 紧邻 ▒ 周期消耗 + 右 ░ 已用，固定 16 格", () => {
  // used 50 → 未用 round(50%×16)=8 格 █；period 25 → 4 格 ▒；其余 4 格 ░
  const line = segmentedUsageBar(50, 25);
  assert.equal(line.slice(0, 16), "█".repeat(8) + "▒".repeat(4) + "░".repeat(4));
  assert.equal(line.slice(16), " -25.0%");
  assert.equal(segmentedBar(50, 25), line.slice(0, 16));
  // 85.4 / 1.4：未用 round(14.6%×16)=2 格 █ + ▒×1 + ░×13（用户样例）
  assert.equal(segmentedBar(85.4, 1.4), "██" + "▒" + "░".repeat(13));
  assert.equal(segmentedBar(85.4, 1.4).length, 16);
  // 85 / 10：▒ 向已用区延伸 2 格
  assert.equal(segmentedBar(85, 10), "██" + "▒▒" + "░".repeat(12));
  // 越界 clamp：▒ 不得越过可用格数
  const clamped = segmentedBar(90, 50).slice(0, 16);
  assert.equal(clamped, "██" + "▒".repeat(8) + "░".repeat(6));
  assert.equal(clamped.length, 16);
  // 未用满格 / 已用满格
  assert.equal(segmentedBar(0, 0), "█".repeat(16));
  assert.equal(segmentedBar(100, 0), "░".repeat(16));
  assert.equal(usageBar(100), "░".repeat(16));
  assert.equal(segmentedUsageBar(null, 20), "");
  // 小增量至少 1 格（0.1% 也要可见），且 0% 不画 ▒
  assert.equal(segmentedBar(85, 0.1), "██" + "▒" + "░".repeat(13));
  assert.equal(segmentedBar(85, 0), "██" + "░".repeat(14));
  assert.equal(segmentedUsageBar(50, 0).slice(16), " -0.0%"); // 零消耗也带负号
});

test("sidebarLines：月额度 / 近7天消耗 / 近5h消耗 各自两行（标签+值），模型之后与周期之间留空行", () => {
  const now = new Date(SERIES_NOW);
  const lines = sidebarLines(buildMergedStatus(usageQuota, now, officialDocument, sampledPeriods, usageSeries), now.getTime());
  assert.deepEqual(lines, [
    "月额度 · 1d0h 后重置",
    usageBar(82.6) + " 82.6% 860.92M Token", // 月合计 Token 全称，直接跟在百分比后
    lines[2], // 夜间倒计时（下面单独断言格式）
    "qwen4-max-preview 0.8 折",
    "qwen3.8-flash 4 折",
    "qwen3.8-max 4 折",
    "",
    "近7天消耗",
    segmentedBar(82.6, 72.6) + " -72.6% 106.04M Token",
    "",
    "近5h消耗",
    segmentedBar(82.6, 42.6) + " -42.6% 1.20M Token",
  ]);
  assert.equal(lines.length, 12); // 月2 + 夜间 + 3 模型 + "" + 7d2 + "" + 5h2
  assert.match(lines[2], /^夜间 .+ 后(开始|结束)$/);
  assert.ok(!/qwen|折/.test(lines[2]));
  // 值行独占一行后：bar 16 格、token 全称、行长 ≤ 40
  for (const line of [lines[1], lines[8], lines[11]]) {
    assert.ok(line.length <= 40, `侧栏行超宽(${line.length}): ${line}`);
    assert.match(line, /^[█▒░]{16} /); // 值行：16 格条 + 空格 + 数值
  }
  assert.match(lines[8], /-\d+\.\d% \d+\.\d{2}M Token$/);
  // 千级 token 保留 `K Token`；零消耗也带负号（`-0.0%`）
  const kilo = sidebarLines(
    buildMergedStatus(usageQuota, now, officialDocument, sampledPeriods, { fetchedAt: SERIES_NOW, tokens7d: 817_140_000, tokens5h: 18_400, source: "server" }),
    now.getTime(),
  );
  assert.equal(kilo[8], segmentedBar(82.6, 72.6) + " -72.6% 817.14M Token");
  assert.equal(kilo[11], segmentedBar(82.6, 42.6) + " -42.6% 18.40K Token");
  const zero = sidebarLines(
    buildMergedStatus(usageQuota, now, officialDocument, { week: { usedPercent: 0, since: null, samples: 1 }, fiveHour: { usedPercent: 0, since: null, samples: 1 } }, usageSeries),
    now.getTime(),
  );
  assert.match(zero[8], / -0\.0% 106\.04M Token$/);
  assert.match(zero[11], / -0\.0% 1\.20M Token$/);
  // 无本地样本：值行写「数据采集中」，token 段仍在
  const collecting = sidebarLines(buildMergedStatus(usageQuota, now, officialDocument, noSamples, usageSeries), now.getTime());
  assert.equal(collecting[8], "数据采集中 · 106.04M Token");
  assert.equal(collecting[11], "数据采集中 · 1.20M Token");
  // 无 token 数据：整段省略，不留占位符
  const noServer = sidebarLines(buildMergedStatus(usageQuota, now, officialDocument, sampledPeriods), now.getTime());
  assert.equal(noServer[8], segmentedBar(82.6, 72.6) + " -72.6%");
  assert.equal(noServer[11], segmentedBar(82.6, 42.6) + " -42.6%");
  assert.ok(!/Token/.test(noServer.join(" ")));
  // 月合计不可用：值行只剩 bar + 百分比
  const noMonth = sidebarLines(
    buildMergedStatus(usageQuota, now, officialDocument, sampledPeriods, { fetchedAt: SERIES_NOW, tokens7d: 106_040_000, tokens5h: 1_200_000, source: "server" }),
    now.getTime(),
  );
  assert.equal(noMonth[1], usageBar(82.6) + " 82.6%");
  // 加购行在最末（近5h 之后）
  const withAddon = buildMergedStatus(
    { ...usageQuota, addon: { totalCredits: 2000, remainingCredits: 1800, activeCount: null, usedPercent: 10 } },
    now,
    officialDocument,
    sampledPeriods,
    usageSeries,
  );
  const addonLines = sidebarLines(withAddon, now.getTime());
  assert.equal(addonLines.at(-1), "加购剩余 1,800 credits");
  assert.ok(addonLines.length <= 13);
  // 没有月度窗口时不产出周期行与空行
  assert.deepEqual(sidebarLines(buildMergedStatus(noQuota, now), now.getTime()), []);
});

test("isQuotaMeterLine：月额度值行按内容识别（不受行号影响），周期行/标签行不误判", () => {
  const now = new Date(SERIES_NOW);
  const lines = sidebarLines(buildMergedStatus(usageQuota, now, officialDocument, sampledPeriods, usageSeries), now.getTime());
  assert.equal(lines[0].startsWith("月额度"), true); // 标签行在第 0 行
  assert.equal(isQuotaMeterLine(lines[0]), false);
  assert.equal(isQuotaMeterLine(lines[1]), true); // 值行在第 1 行，必须识别为 meter
  assert.match(lines[1], /^[█░]{16} 82\.6% 860\.92M Token$/);
  assert.equal(isQuotaMeterLine(lines[7]), false); // 近7天消耗 标签
  assert.equal(isQuotaMeterLine(lines[8]), false); // 周期值行（带 `-N.N%`）
  assert.equal(isQuotaMeterLine(lines[11]), false); // 5h 值行
  // 直接按形状判断（16 格条：13 █ + 3 ░）
  assert.equal(isQuotaMeterLine("█████████████░░░ 84.0%"), true);
  assert.equal(isQuotaMeterLine("█████████████░░░ 84%"), true); // 整数百分比也兼容
  assert.equal(isQuotaMeterLine("█████████████░░░ -84.0%"), false);
  assert.equal(isQuotaMeterLine("夜间 26m 后开始"), false);
});

test("remainingOf：剩余一律由已用推导（round1(100−used)），已用+剩=100.0", () => {
  assert.equal(percent(84.04), "84.0%");
  assert.equal(percent(remainingOf(84.04)), "16.0%");
  assert.equal(percent(15.96), "16.0%");
  assert.equal(percent(remainingOf(15.96)), "84.0%");
  // 服务端两字段各自四舍五入造成的 99.9% 不再出现
  const drift = { window: "month", usedPercent: 84.04, remainingPercent: 15.9, resetTime: null, resetAtMs: null };
  const status = buildMergedStatus({ ...noQuota, ok: true, error: null, window: drift }, new Date(SERIES_NOW));
  const usage = quotaRows(status.quota, SERIES_NOW).find((row) => row.label === "月用量");
  assert.ok(usage.value.includes("84.0% 已用"));
  assert.ok(usage.value.includes("剩 16.0%"));
  assert.equal(footerLine(status).includes("剩 16.0%"), true);
  assert.ok(!usage.value.includes("剩 15.9%"));
});

test("rowLabelText：label 定宽 12 + 一个空格，超长 label 与 value 之间仍有分隔", () => {
  const longLabel = "夜间折扣 0.8–5 折 · 文源 2026-11-19"; // 超过 12 列
  const value = "22:00–08:00 · 00:10:49 后开始";
  assert.equal(rowLabelText(longLabel) + value, `${longLabel} ${value}`);
  assert.ok((rowLabelText(longLabel) + value).includes(`${longLabel} ${value}`));
  // 短 label 仍按 12 列对齐并留一个空格
  assert.equal(rowLabelText("月用量") + "x", `${"月用量".padEnd(12)} x`);
});

test("colorString：非字符串/空白色值一律回退，绝不把对象传给 fg（线上崩溃回归）", () => {
  assert.equal(colorString({}, "white"), "white");
  assert.equal(colorString(42, "gray"), "gray");
  assert.equal(colorString("   ", "gray"), "gray");
  assert.equal(colorString(null, "yellow"), "yellow");
  assert.equal(colorString("#e5c07b", "white"), "#e5c07b");
  // 主题整块是对象（RGBA）时：两个取色函数只返回字符串
  const broken = { text: { base: {}, muted: {}, feedback: { warning: { base: {} }, info: { base: {} } } } };
  for (const fg of [quotaSeverityFg(broken, "warning"), quotaSeverityFg(broken, null), overlayFg(broken, "week"), overlayFg(broken, "fiveHour")]) {
    assert.equal(typeof fg, "string");
  }
  assert.equal(quotaSeverityFg(broken, "warning"), "yellow");
  assert.equal(quotaSeverityFg(broken, null), "white");
  assert.equal(overlayFg(broken, "week"), "yellow");
  assert.equal(overlayFg(broken, "fiveHour"), "cyan");
  // 正常字符串原样
  const ok = { text: { base: "#ffffff", feedback: { warning: { base: "#e5c07b" } } } };
  assert.equal(quotaSeverityFg(ok, "warning"), "#e5c07b");
  assert.equal(colorString(ok.text.base, "white"), "#ffffff");
});

test("overlayFg：7 天叠加段黄、5h 叠加段青，两者不同色（主题缺 info 时用命名色）", () => {
  const bare = { text: { base: "#ffffff", feedback: { warning: { base: "#ffffff" } } } };
  assert.equal(overlayFg(bare, "week"), "yellow");
  assert.equal(overlayFg(bare, "fiveHour"), "cyan");
  assert.notEqual(overlayFg(bare, "week"), overlayFg(bare, "fiveHour"));
  // 主题定义了 feedback 就用主题色
  const themed = { text: { base: "#ffffff", feedback: { warning: { base: "#e5c07b" }, info: { base: "#56b6c2" } } } };
  assert.equal(overlayFg(themed, "week"), "#e5c07b");
  assert.equal(overlayFg(themed, "fiveHour"), "#56b6c2");
  // 同一个 bar 切段后，两行 overlay 颜色确实不同
  const bar = segmentedBar(82.6, 72.6);
  const colorsFor = (period) =>
    barSegments(bar)
      .filter((segment) => segment.kind === "period")
      .map(() => overlayFg(bare, period));
  assert.deepEqual(colorsFor("week"), ["yellow"]);
  assert.deepEqual(colorsFor("fiveHour"), ["cyan"]);
  assert.notDeepEqual(colorsFor("week"), colorsFor("fiveHour"));
});

test("splitMeter：一位小数（84.0%）与整数（84%）都切得出长条段；非额度句为 null", () => {
  const decimal = splitMeter("月额度 " + "█".repeat(13) + "░".repeat(3) + " 84.0% · 10d2h 后重置");
  assert.deepEqual(decimal, ["月额度 ", "█".repeat(13) + "░".repeat(3) + " 84.0%", " · 10d2h 后重置"]);
  assert.deepEqual(splitMeter(usageBar(84) + " 84%"), ["", usageBar(84) + " 84%", ""]);
  assert.equal(splitMeter("近7天消耗"), null);
  assert.equal(splitMeter(segmentedUsageBar(82.6, 72.6) + " 106.04M TK"), null); // 周期条的 `+72.6%` 不匹配
});

test("quotaSeverityFg：主题 feedback 优先；近白/近灰/缺省时回退命名色，饱和色原样返回", () => {
  const theme = (warningBase) => ({
    text: { base: "#ffffff", feedback: { warning: { base: warningBase } } },
  });
  // 近白（不是与 text.base 完全相等）也要回退
  assert.equal(quotaSeverityFg(theme("#f5f5f5"), "warning"), "yellow");
  assert.equal(quotaSeverityFg(theme("#ffffff"), "warning"), "yellow");
  assert.equal(quotaSeverityFg(theme(undefined), "warning"), "yellow");
  assert.equal(quotaSeverityFg(theme("#e5c07b"), "warning"), "#e5c07b"); // 饱和色原样
  assert.equal(quotaSeverityFg(theme("rgb(229, 192, 123)"), "warning"), "rgb(229, 192, 123)");
  // success/error 的饱和色也原样返回
  const green = { text: { base: "#ffffff", feedback: { success: { base: "#00ff00" }, error: { base: "red" } } } };
  assert.equal(quotaSeverityFg(green, "success"), "#00ff00");
  assert.equal(quotaSeverityFg(green, "error"), "red"); // 命名色直接采用
  // 无效档位 → 正文色
  assert.equal(quotaSeverityFg(theme("#e5c07b"), null), "#ffffff");
  // 近灰（低色度且高亮度）
  assert.equal(quotaSeverityFg({ text: { base: "#ffffff", feedback: { warning: { base: "rgb(230, 228, 226)" } } } }, "warning"), "yellow");
});

test("quotaRows：月用量行后依次是近7天消耗 / 近5h消耗 灰色行（同单位同顺序）", () => {
  const rows = quotaRows(usageQuota, SERIES_NOW, sampledPeriods, usageSeries);
  const labels = rows.map((row) => row.label);
  const monthIndex = labels.indexOf("月用量");
  assert.equal(labels[monthIndex + 1], "近7天消耗");
  assert.equal(labels[monthIndex + 2], "近5h消耗");
  assert.equal(rows[monthIndex].value.includes("合计 860.92M Token"), true);
  assert.ok(rows[monthIndex].value.startsWith(usageBar(82.6, 10) + " 82.6% 已用")); // 百分比在 bar 之后且完整
  assert.ok(rows[monthIndex].value.includes("剩 17.4%"));
  assert.equal(rows[monthIndex + 1].muted, true);
  assert.equal(rows[monthIndex + 1].value, segmentedBar(82.6, 72.6) + " -72.6% 106.04M Token");
  assert.equal(rows[monthIndex + 2].value, segmentedBar(82.6, 42.6) + " -42.6% 1.20M Token");
  const collecting = quotaRows(usageQuota, SERIES_NOW, noSamples, usageSeries);
  assert.equal(collecting[monthIndex + 1].value, "数据采集中 · 106.04M Token");
  const noToken = quotaRows(usageQuota, SERIES_NOW, sampledPeriods);
  assert.equal(noToken[monthIndex + 1].value, segmentedBar(82.6, 72.6) + " -72.6%");
});

test("quotaRows：/tokenplan 面板保留未授权入口", () => {
  const rows = quotaRows(noQuota, Date.parse("2026-08-31T23:00:00+08:00"));
  assert.deepEqual(rows, [{ label: "状态", value: "未授权 · 打开 /tokenplan 授权" }]);
});

// ═════════════════ A6-1 网关请求构造（02 §B5/B6） ═════════════════

test("网关 URL：action/product/api/_v 齐备，Cookie 通道 data、Bearer 通道 cli", () => {
  const url = new URL(buildGatewayUrl(API.usage));
  assert.equal(url.pathname, "/data/api.json");
  assert.equal(url.searchParams.get("action"), "BroadScopeAspnGateway");
  assert.equal(url.searchParams.get("product"), "sfm_bailian");
  assert.equal(url.searchParams.get("api"), API.usage);
  assert.equal(url.searchParams.get("_v"), "");
  assert.equal(new URL(buildGatewayUrl(API.usage, "cli")).pathname, "/cli/api.json");
});

test("网关 body：params 内嵌 Api/V/Data+cornerstoneParam，另带 region=cn-beijing", () => {
  const form = new URLSearchParams(buildRequestBody(API.subscription, { queryInstanceInfoRequest: { commodityCode: COMMODITY.solo } }));
  assert.equal(form.get("region"), "cn-beijing");
  const params = JSON.parse(form.get("params"));
  assert.equal(params.Api, API.subscription);
  assert.equal(params.V, "1.0");
  assert.equal(params.Data.queryInstanceInfoRequest.commodityCode, "sfm_tokenplansolo_public_cn");
  const cs = params.Data.cornerstoneParam;
  assert.equal(cs.protocol, "V2");
  assert.equal(cs.console, "ONE_CONSOLE");
  assert.equal(cs.productCode, "p_efm");
  assert.equal(cs.switchUserType, 3); // 必须是数字
  assert.equal(cs.consoleSite, "BAILIAN_ALIYUN");
  assert.equal(cs.xsp_lang, "zh-CN");
  assert.equal(cs.domain, "bailian.console.aliyun.com");
  assert.equal(cs.feURL, PAGE_URL);
  assert.match(cs.feTraceId, /^[0-9a-f-]{36}$/i);
  assert.equal(cs["X-Anonymous-Id"].length, 24);
  assert.match(cs["X-Anonymous-Id"], /^[A-Za-z0-9]{24}$/);
  // 每次调用都换埋点 id
  const again = JSON.parse(new URLSearchParams(buildRequestBody(API.usage, {})).get("params")).Data.cornerstoneParam;
  assert.notEqual(again.feTraceId, cs.feTraceId);
  assert.notEqual(again["X-Anonymous-Id"], cs["X-Anonymous-Id"]);
});

// ═════════════════ A6-2 信封解包（02 §B7） ═════════════════

test("网关 body：可选 sec_token —— 传了才带；request.ts 不读 env", () => {
  assert.equal(new URLSearchParams(buildRequestBody(API.usage, {}, "tok-abc")).get("sec_token"), "tok-abc");
  process.env.ALIYUN_SEC_TOKEN = "env-should-not-leak";
  try {
    assert.equal(new URLSearchParams(buildRequestBody(API.usage, {})).get("sec_token"), null);
  } finally {
    delete process.env.ALIYUN_SEC_TOKEN;
  }
});

test("unwrap：code 数字/字符串都按 String 比较；data 命中返回 data", () => {
  assert.deepEqual(unwrap({ code: 200, data: { a: 1 } }), { a: 1 });
  assert.deepEqual(unwrap({ code: "200", data: { a: 2 } }), { a: 2 });
  assert.deepEqual(unwrap({ code: "200", successResponse: true, data: { a: 3 } }), { a: 3 });
});

test("unwrap：DataV2.data 优先于 data", () => {
  assert.deepEqual(unwrap({ code: "200", data: { DataV2: { data: { deep: true } }, other: 1 } }), { deep: true });
  assert.deepEqual(unwrap({ code: "200", data: { DataV2: {} } }), { DataV2: {} }); // 无 data → 退回 data 本体
});

test("unwrap：data=null 时返回整个 payload（不炸）", () => {
  assert.deepEqual(unwrap({ code: "200", data: null, extra: 1 }).extra, 1);
});

test("unwrap：DataV2.data 键存在但为 null 时返回 null（不回退整个信封）", () => {
  assert.equal(unwrap({ code: "200", data: { DataV2: { data: null }, other: 1 } }), null);
});

test("unwrap：非 200 且无 successResponse 抛错，消息取 message/errorMsg/code", () => {
  assert.throws(() => unwrap({ code: "500", message: "boom" }), /boom/);
  assert.throws(() => unwrap({ code: "E100", errorMsg: "bad" }), /bad/);
  assert.throws(() => unwrap({ code: "E101" }), /E101/);
});

test("unwrap：data.success=false 抛错（errorCode 优先）", () => {
  assert.throws(() => unwrap({ code: "200", data: { success: false, errorCode: "Forbidden.AuthorityPolicies.NoPermission" } }), /NoPermission/);
  assert.throws(() => unwrap({ code: "200", data: { success: false } }), /request failed/);
});

test("unwrap：服务端回显的凭证在抛出前被脱敏", () => {
  try {
    unwrap({ code: "500", message: "fail Authorization: Bearer abcdef0123456789xyz login=secretvalue1234" });
    assert.fail("应当抛错");
  } catch (e) {
    assert.ok(!/abcdef0123456789xyz/.test(e.message), "Bearer 值必须被抹掉");
    assert.ok(!/secretvalue1234/.test(e.message), "cookie 值必须被抹掉");
  }
});

// ═════════════════ A6-3 归一化（02 §B8，单位是关键） ═════════════════

test("ratioToPercent：0–1 比例 ×100，clamp 到 0–100，非数字 → null", () => {
  assert.equal(ratioToPercent(0.12), 12);
  assert.equal(ratioToPercent(1), 100);
  assert.equal(ratioToPercent(1.5), 100); // clamp
  assert.equal(ratioToPercent(-0.2), 0); // clamp
  assert.equal(ratioToPercent(0.123456), 12.35); // 2 位
  assert.equal(ratioToPercent("0.12"), null); // 字符串不猜
  assert.equal(ratioToPercent(undefined), null);
});

test("formatTs：>1e12 视为毫秒、否则按秒；null/空串 → '-'；他类型 String", () => {
  const ms = Date.UTC(2026, 10, 16, 4, 0, 0); // 2026-11-16 12:00 +08:00
  const expected = formatTs(ms);
  assert.match(expected, /^2026-11-16 12:00:00$/); // 本地时区（本机 Asia/Shanghai）
  assert.equal(formatTs(ms / 1000), expected); // 秒 → 同一时刻
  assert.equal(formatTs(null), "-");
  assert.equal(formatTs(""), "-");
  assert.equal(formatTs("2026/11/16"), "2026/11/16");
});

test("pickUsageWindow：week > month > 5h，取第一个「存在且为数字」的", () => {
  const week = pickUsageWindow({ per1WeekPercentage: 0.62, per1WeekResetTime: 1790000000000, per1MonthPercentage: 0.1 });
  assert.equal(week.window, "week");
  assert.equal(week.usedPercent, 62);
  assert.equal(week.remainingPercent, 38);
  assert.equal(week.resetAtMs, 1790000000000);
  assert.equal(week.resetTime, formatTs(1790000000000));

  const month = pickUsageWindow({ per1WeekPercentage: "n/a", per1MonthPercentage: 0.25 });
  assert.equal(month.window, "month"); // 非数字跳过，落到下一条
  assert.equal(month.usedPercent, 25);
  assert.equal(month.resetTime, null); // 无 resetTime → null

  const fiveH = pickUsageWindow({ usage: { per5HourPercentage: 0.2, per5HourResetTime: 1790000000 } });
  assert.equal(fiveH.window, "5h"); // 嵌套键 usage 也要认
  assert.equal(fiveH.usedPercent, 20);
  assert.equal(fiveH.remainingPercent, 80);
  assert.equal(fiveH.resetAtMs, 1790000000 * 1000); // 秒 → 毫秒

  assert.equal(pickUsageWindow({}), null);
  assert.equal(pickUsageWindow({ usage: {} }), null);
  assert.equal(pickUsageWindow(null), null);

  const clamped = pickUsageWindow({ per5HourPercentage: 1.4 });
  assert.equal(clamped.usedPercent, 100);
  assert.equal(clamped.remainingPercent, 0); // max(0, 100-used)
});

test("normalizePlan：嵌套 instanceInfo/instance/subscription 三档回退，单位是格式化串+毫秒", () => {
  const end = 1790000000000;
  const a = normalizePlan({ instanceInfo: { subStatus: "Normal", specCode: "sfm_tokenplansolo_public_cn", remainingDays: 12, endTime: end } });
  assert.equal(a.status, "Normal");
  assert.equal(a.specCode, "sfm_tokenplansolo_public_cn");
  assert.equal(a.remainingDays, 12);
  assert.equal(a.endAtMs, end);
  assert.equal(a.endTime, formatTs(end));

  const b = normalizePlan({ subscription: { status: "Expired", endTime: end / 1000 } });
  assert.equal(b.status, "Expired"); // 无 subStatus → status
  assert.equal(b.remainingDays, null);
  assert.equal(b.endAtMs, end);

  const c = normalizePlan({ instance: { subStatus: "Normal" } });
  assert.equal(c.endTime, null);
  assert.equal(c.endAtMs, null);
});

test("normalizePlan：status 优先于 subStatus（Python 只读 status）", () => {
  assert.equal(normalizePlan({ instanceInfo: { status: "Active", subStatus: "Normal" } }).status, "Active");
  assert.equal(normalizePlan({ instanceInfo: { subStatus: "Normal" } }).status, "Normal"); // 缺 status 才回退
});

test("normalizeAddon：usedPercent=(total-remaining)/total*100 两位小数，total≤0 → null", () => {
  const a = normalizeAddon({ summary: { totalCredits: 2000, remainingCredits: 760, activeCount: 1 } });
  assert.equal(a.totalCredits, 2000);
  assert.equal(a.remainingCredits, 760);
  assert.equal(a.activeCount, 1);
  assert.equal(a.usedPercent, 62);

  const b = normalizeAddon({ totalCredits: 3, remainingCredits: 2 });
  assert.equal(b.usedPercent, 33.33); // 1/3 → 33.33（Python round(...,2)）

  assert.equal(normalizeAddon({ summary: { totalCredits: 0, remainingCredits: 0 } }).usedPercent, null);
  assert.equal(normalizeAddon({ summary: { totalCredits: 100 } }).usedPercent, null); // remaining 缺失
  assert.equal(normalizeAddon({ summary: { totalCredits: 100, remainingCredits: 150 } }).usedPercent, 0); // 夹到 0
  assert.equal(normalizeAddon({ addonSummary: { totalCredits: 100, remainingCredits: 100 } }).usedPercent, 0);
});

test("normalizeQwenwork：credits 或 data.credits，缺失 → null", () => {
  assert.equal(normalizeQwenwork({ credits: 5 }).credits, 5);
  assert.equal(normalizeQwenwork({ data: { credits: 7 } }).credits, 7);
  assert.equal(normalizeQwenwork({}).credits, null);
  assert.equal(normalizeQwenwork(null).credits, null);
});

// ═════════════════ 真实网关信封（2026-11-16 本机抓取）：unwrap 后字段还在再下一层 data ═════════════════
// 结构逐字复刻：data.DataV2.data = { msg, code, data:{…}, requestId, success }（值里的账号无关字段已替换）。

const realSubscription = {
  code: "200",
  successResponse: true,
  data: {
    DataV2: {
      ret: [{ success: true, code: "200", msg: "success" }],
      data: {
        msg: "success",
        code: "200",
        data: {
          instanceCode: "sfm_tokenplansolo_public_cn_0f1e2d3c",
          specCode: "sfm_tokenplansolo_public_cn",
          remainingDays: 286,
          startTime: 1785289173000,
          endTime: 1819555200000,
          autoRenewFlag: false,
          status: "Normal",
        },
        requestId: "5f2a71c4-3b8e-4d16-9a77-1c2d3e4f5a6b",
        success: true,
      },
      success: true,
      httpStatus: 200,
      errorCode: "",
      api: API.subscription,
      errorMsg: "",
    },
  },
};

const realUsage = {
  code: "200",
  successResponse: true,
  data: {
    DataV2: {
      ret: [{ success: true, code: "200", msg: "success" }],
      data: {
        msg: "success",
        code: "200",
        data: { per1MonthPercentage: 0.8264117165333332, per1MonthResetTime: 1795968000000 },
        requestId: "7c4b2a90-6d1f-4e38-b5a2-9f8e7d6c5b4a",
        success: true,
      },
      success: true,
      httpStatus: 200,
      errorCode: "",
      api: API.usage,
      errorMsg: "",
    },
  },
};

// addon / qwenwork 真实信封本机没抓到，按同构形状构造（同样 data 多一层）。
const envelopedAddon = {
  code: "200",
  successResponse: true,
  data: {
    DataV2: {
      ret: [{ success: true, code: "200", msg: "success" }],
      data: {
        msg: "success",
        code: "200",
        data: { totalCredits: 2000, remainingCredits: 760, activeCount: 1 },
        requestId: "9e8d7c6b-5a4f-4321-8765-0f1e2d3c4b5a",
        success: true,
      },
      success: true,
      httpStatus: 200,
      errorCode: "",
      api: API.addon,
      errorMsg: "",
    },
  },
};

const envelopedQwenwork = {
  code: "200",
  successResponse: true,
  data: {
    DataV2: {
      ret: [{ success: true, code: "200", msg: "success" }],
      data: {
        msg: "success",
        code: "200",
        data: { credits: 240 },
        requestId: "1a2b3c4d-5e6f-4708-9a0b-c1d2e3f4a5b6",
        success: true,
      },
      success: true,
      httpStatus: 200,
      errorCode: "",
      api: API.qwenwork,
      errorMsg: "",
    },
  },
};

test("真实信封 subscription：normalizePlan 下钻一层 data 拿到套餐（此前全 null）", () => {
  const plan = normalizePlan(unwrap(realSubscription));
  assert.equal(plan.status, "Normal");
  assert.equal(plan.specCode, "sfm_tokenplansolo_public_cn");
  assert.equal(plan.remainingDays, 286);
  assert.ok(plan.endTime);
  assert.equal(plan.endAtMs, 1819555200000);
});

test("真实信封 usage：pickUsageWindow 下钻 data → month 窗口 82.64% 且重置时刻为毫秒", () => {
  const w = pickUsageWindow(unwrap(realUsage));
  assert.equal(w.window, "month");
  assert.ok(Math.abs(w.usedPercent - 82.64) <= 0.01, `usedPercent=${w.usedPercent}`);
  assert.equal(w.resetAtMs, 1795968000000);
});

test("老形状不受影响：instanceInfo 嵌套照旧解析，且优先于同层的 data", () => {
  const plan = normalizePlan({ instanceInfo: { status: "Active", specCode: "sfm_tokenplansolo_public_cn", remainingDays: 12, endTime: 1790000000000 } });
  assert.equal(plan.status, "Active");
  assert.equal(plan.remainingDays, 12);
  // 原键命中就不再下钻 data
  assert.equal(normalizePlan({ instanceInfo: { status: "Active" }, data: { status: "Expired" } }).status, "Active");
  // data 里没有目标字段时不采用 data，仍返回原值
  assert.equal(normalizePlan({ status: "Active", data: { foo: 1 } }).status, "Active");
  assert.equal(normalizeAddon({ totalCredits: 3, remainingCredits: 2 }).usedPercent, 33.33);
});

// ═════════════════ A6-4 失败模式与分类（02 §B9，r3 Δ6） ═════════════════

test("分类：ConsoleNeedLogin/NotLogined → unauthorized；NoPermission → parse", () => {
  assert.ok(isLoginInvalid("ConsoleNeedLogin"));
  let err = "";
  try {
    unwrap({ code: "ConsoleNeedLogin", successResponse: false });
  } catch (e) {
    err = e.message;
  }
  assert.equal(classifyError(Object.assign(new Error("x"), { name: "GatewayError", code: "ConsoleNeedLogin" })).kind, "unauthorized");
  assert.match(err, /ConsoleNeedLogin/);
  assert.equal(classifyError(new core.GatewayError("Forbidden.AuthorityPolicies.NoPermission", "Forbidden.AuthorityPolicies.NoPermission")).kind, "parse");
});

test("分类：HTTP 401/403 → unauthorized，5xx → network，非 JSON → parse，超时 → network", () => {
  assert.equal(classifyError(new core.GatewayError("HTTP 403: forbidden", "403")).kind, "unauthorized");
  assert.equal(classifyError(new core.GatewayError("HTTP 401: no", "401")).kind, "unauthorized");
  assert.equal(classifyError(new core.GatewayError("HTTP 500: oops", "500")).kind, "network");
  assert.equal(classifyError(new core.GatewayError("not JSON: <html>", "not-json")).kind, "parse");
  assert.equal(classifyError(Object.assign(new Error("aborted"), { name: "AbortError" })).kind, "network");
  assert.equal(classifyError(new TypeError("fetch failed")).kind, "network");
  assert.equal(classifyError(new Error("weird")).kind, "unknown");
  assert.ok(classifyError(new Error("x".repeat(400))).message.length <= 120);
});

test("redact：Bearer / JWT / cookie 串 / token 键值全部抹掉", () => {
  assert.match(redact("Authorization: Bearer abc.def-ghi_jkl123456"), /Bearer \*\*\*/);
  assert.ok(!/abc\.def-ghi_jkl123456/.test(redact("Authorization: Bearer abc.def-ghi_jkl123456")));
  assert.ok(!/eyJhbGciOiJIUzI1NiJ9\.eyJzdWIiOiIxIn0\.abcdefgh/.test(redact("token=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abcdefgh")));
  assert.ok(!/LOGIN_TICKET_9f8e7d6c5b4a/.test(redact("Cookie: LOGIN_TICKET_9f8e7d6c5b4a; other=1")));
  assert.ok(!/sk_live_1234567890/.test(redact({ access_token: "sk_live_1234567890" })));
});

// ═════════════════ A6-5 fetchQuota 端到端（注入 deps，零网络） ═════════════════

const okEnvelope = (data) => ({ code: "200", successResponse: true, data });
const happyRequest = (api) => {
  if (api === API.subscription) return okEnvelope({ instanceInfo: { subStatus: "Normal", specCode: "sfm_tokenplansolo_public_cn", remainingDays: 9, endTime: 1790000000000 } });
  if (api === API.usage) return okEnvelope({ DataV2: { data: { per1WeekPercentage: 0.62, per1WeekResetTime: 1790000000000 } } });
  if (api === API.addon) return okEnvelope({ summary: { totalCredits: 2000, remainingCredits: 760, activeCount: 1 } });
  if (api === API.qwenwork) return okEnvelope({ data: { credits: 42 } });
  throw new Error("unexpected api " + api);
};
const deps = (over = {}) => ({
  credentialState: async () => "authorized",
  source: () => "browser-session",
  request: async (api, data, signal) => happyRequest(api),
  ...over,
});

test("fetchQuota 无凭证：ok=false + kind=none + 授权指引，不抛", async () => {
  const snap = await fetchQuota({ deps: deps({ credentialState: async () => "none" }) });
  assert.equal(snap.ok, false);
  assert.equal(snap.source, null);
  assert.equal(snap.error.kind, "none");
  assert.match(snap.error.message, /\/tokenplan/);
  assert.equal(snap.plan, null);
});

test("fetchQuota 已过期：kind=unauthorized（不等于「未授权」）", async () => {
  const snap = await fetchQuota({ deps: deps({ credentialState: async () => "expired" }) });
  assert.equal(snap.error.kind, "unauthorized");
});

test("fetchQuota 正常路径：4 个 API 全部归一（单位正确）", async () => {
  const snap = await fetchQuota({ deps: deps() });
  assert.equal(snap.ok, true);
  assert.equal(snap.source, "browser-session");
  assert.equal(snap.plan.specCode, "sfm_tokenplansolo_public_cn");
  assert.equal(snap.plan.remainingDays, 9);
  assert.equal(snap.window.window, "week");
  assert.equal(snap.window.usedPercent, 62);
  assert.equal(snap.addon.usedPercent, 62);
  assert.equal(snap.qwenwork.credits, 42);
  assert.equal(snap.error, null);
});

const realRequest = async (api) => {
  if (api === API.subscription) return realSubscription;
  if (api === API.usage) return realUsage;
  if (api === API.addon) return envelopedAddon;
  if (api === API.qwenwork) return envelopedQwenwork;
  throw new Error("unexpected api " + api);
};

test("fetchQuota 真实四路信封：ok=true、remainingDays 286、window 非空、addon/qwenwork 也归到 data.data", async () => {
  const snap = await fetchQuota({ deps: deps({ request: realRequest }) });
  assert.equal(snap.ok, true);
  assert.equal(snap.error, null);
  assert.equal(snap.plan.remainingDays, 286);
  assert.ok(snap.window);
  assert.equal(snap.window.window, "month");
  assert.equal(snap.addon.totalCredits, 2000);
  assert.equal(snap.qwenwork.credits, 240);
});

test("usageBar：真实合并快照的侧栏与月用量行均含长条和已用百分比", async () => {
  const quota = await fetchQuota({ deps: deps({ request: realRequest }) });
  const now = new Date("2026-11-16T12:00:00+08:00");
  const merged = buildMergedStatus(quota, now);
  const lines = sidebarLines(merged, now.getTime());
  assert.equal(lines[0].startsWith("月额度"), true); // 标签行
  const headline = lines[1]; // 值行：bar16 + 82.6%
  assert.ok(headline.includes("███")); // 未用段（实心）
  assert.ok(headline.includes("82.6%"));
  assert.match(headline, /^[█▒░]{16} 82\.6%$/);
  const usage = quotaRows(quota, now.getTime()).find((row) => row.label === "月用量");
  assert.ok(usage);
  assert.match(usage.value, /^[█░]{10} 82\.6% 已用/); // 已用块锚定右端（前面是空轨）
});

test("sidebarLines：真实额度 + 真实文档时首行是额度长条，其后模型行 ≤3 且全为 qwen", async () => {
  const quota = await fetchQuota({ deps: deps({ request: realRequest }) });
  const now = new Date("2026-11-16T12:00:00+08:00");
  const merged = buildMergedStatus(quota, now, officialDocument);
  const lines = sidebarLines(merged, now.getTime());
  assert.match(lines[0], /^月额度/); // 标签行
  assert.ok(lines[1].includes("█")); // 值行：bar + 百分比
  assert.match(lines[2], /^夜间 .+ 后(开始|结束)$/); // 倒计时紧贴额度值行，且不带模型名
  assert.ok(!/qwen|折/.test(lines[2]));
  assert.ok(lines.length <= 7, `月2 + 1 倒计时 + 3 模型（+1 加购）: ${lines.join(" | ")}`);
  const modelLines = lines.filter((line) => /^[^\s]+ [\d.]+ 折/.test(line));
  assert.equal(modelLines.length, 3);
  assert.ok(modelLines.every((line) => line.startsWith("qwen")), modelLines.join(","));
  assert.ok(modelLines.every((line) => !/后(开始|结束)$/.test(line)), "模型行不再拼倒计时");
});

test("footerLine：只显示剩余额度或套餐状态，未授权与空数据不占位", async () => {
  const quota = await fetchQuota({ deps: deps({ request: realRequest }) });
  const now = new Date("2026-11-16T12:00:00+08:00");
  const merged = buildMergedStatus(quota, now);
  const footer = footerLine(merged);
  assert.ok(footer.includes("剩 17.4%"));
  assert.ok(!/夜间五折|后结束|后开始/.test(footer));
  assert.equal(footerLine({ ...merged, quota: { ...quota, window: null } }), "额度 套餐 Normal");
  assert.equal(footerLine(buildMergedStatus(noQuota, now)), "");
  assert.equal(footerLine(buildMergedStatus({ ...noQuota, ok: true, error: null }, now)), "");
});

test("fetchQuota 非致命降级：addon / qwenwork 失败不影响套餐与窗口", async () => {
  const snap = await fetchQuota({
    deps: deps({
      request: async (api) => {
        if (api === API.addon) throw new core.GatewayError("HTTP 500: addon down", "500");
        if (api === API.qwenwork) throw new Error("qwen broke");
        return happyRequest(api);
      },
    }),
  });
  assert.equal(snap.ok, true);
  assert.equal(snap.window.usedPercent, 62);
  assert.ok(snap.addon.error);
  assert.ok(snap.qwenwork.error);
});

test("fetchQuota 行级降级：addon 返回 200+data.success=false 只降 addon，plan/window 不毁", async () => {
  const snap = await fetchQuota({
    deps: deps({
      request: async (api) => {
        if (api === API.addon) {
          return { code: "200", successResponse: true, data: { success: false, errorCode: "Forbidden.AuthorityPolicies.NoPermission" } };
        }
        return happyRequest(api);
      },
    }),
  });
  assert.equal(snap.ok, true); // 整次快照不能被打成失败
  assert.equal(snap.plan.specCode, "sfm_tokenplansolo_public_cn");
  assert.equal(snap.window.usedPercent, 62);
  assert.ok(snap.addon.error);
  assert.equal(snap.qwenwork.credits, 42);
});

test("fetchQuota 五个失败模式：ConsoleNeedLogin / 非 JSON / HTTP 500 / 401 / 超时", async () => {
  const run = (request) => fetchQuota({ deps: deps({ request }) });

  const login = await run(async () => ({ code: "ConsoleNeedLogin", successResponse: false }));
  assert.equal(login.ok, false);
  assert.equal(login.error.kind, "unauthorized");

  const notJson = await run(async () => {
    throw new core.GatewayError("not JSON: <html>", "not-json");
  });
  assert.equal(notJson.error.kind, "parse");

  const http500 = await run(async () => {
    throw new core.GatewayError("HTTP 500: boom", "500");
  });
  assert.equal(http500.error.kind, "network");

  const http401 = await run(async () => {
    throw new core.GatewayError("HTTP 401: no", "401");
  });
  assert.equal(http401.error.kind, "unauthorized");

  const timeout = await run(async () => {
    throw Object.assign(new Error("The operation was aborted"), { name: "AbortError" });
  });
  assert.equal(timeout.error.kind, "network");
  for (const s of [login, notJson, http500, http401, timeout]) assert.equal(s.plan, null);
});

// ═════════════════ A6-6 缓存：无凭证（结构性保证） ═════════════════

test("quota-cache.json：原子写→读回，且不含任何凭证字段", async () => {
  const snap = {
    ok: true,
    source: "browser-session",
    fetchedAt: "2026-11-16T12:00:00.000Z",
    plan: { status: "Normal", specCode: "s", remainingDays: 3, endTime: "2026-11-19 12:00:00", endAtMs: 1 },
    window: { window: "week", usedPercent: 62, remainingPercent: 38, resetTime: "2026-11-20 00:00:00", resetAtMs: 2 },
    addon: { totalCredits: 2000, remainingCredits: 760, activeCount: 1, usedPercent: 62 },
    qwenwork: { credits: 42 },
    error: null,
    // 故意塞入凭证形状的额外字段：结构化投影必须把它丢掉
    access_token: "SECRET_TOKEN_SHOULD_NOT_LEAK",
    cookie: "LOGIN_TICKET_SHOULD_NOT_LEAK",
  };
  assert.equal(await writeQuotaCache(snap), true);
  const raw = fs.readFileSync(quotaCachePath(), "utf8");
  assert.ok(!/SECRET_TOKEN_SHOULD_NOT_LEAK|LOGIN_TICKET_SHOULD_NOT_LEAK/.test(raw), "缓存里不得出现凭证");
  assert.ok(!/access_?token|cookie|bearer|authorization/i.test(raw), "缓存字段也不得出现凭证键名");
  const back = await readQuotaCache();
  assert.equal(back.window.usedPercent, 62);
  assert.equal(back.addon.usedPercent, 62);
  assert.equal(back.qwenwork.credits, 42);
  assert.equal(back.access_token, undefined);

  fs.writeFileSync(quotaCachePath(), JSON.stringify({ schemaVersion: 1, quota: { ok: true } }));
  assert.equal(await readQuotaCache(), null); // 旧 schema 不认
});

test("quota-cache 回放：读回一律标 source=cache（陈旧数据不冒充实时）", async () => {
  await writeQuotaCache({ ok: true, source: "browser-session", fetchedAt: "2026-11-16T12:00:00.000Z", plan: null, window: null, addon: null, qwenwork: null, error: null });
  const back = await readQuotaCache();
  assert.equal(back.source, "cache");
});

test("凭证：401 之后下一次探针仍是 expired（死 Cookie 不再被读回）", async () => {
  let restored = 0;
  let invalidated = 0;
  const deadCred = { kind: "cookie", jar: "a=1; b=2", source: "browser-session" };
  const deps401 = {
    request: async () => {
      throw new core.GatewayError("HTTP 401: expired", "401");
    },
    restore: async () => {
      restored++;
      return deadCred;
    },
    invalidate: () => {
      invalidated++;
    },
  };
  await assert.rejects(core.consoleRequest(API.subscription, {}, new AbortController().signal, deps401));
  assert.equal(invalidated, 1, "落盘凭证必须被作废");
  const state = await core.probeCredential(deps401);
  assert.equal(state, "expired"); // 修复前这里会重新读盘并回到 authorized
  assert.equal(restored, 1, "第二轮不得再读盘");
});

// ═════════════════ A6-7 detect()：候选表 + 假 home 目录 ═════════════════

function plant(rel, content = "") {
  const p = path.join(fakeHome, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  if (content === null) fs.mkdirSync(p, { recursive: true });
  else fs.writeFileSync(p, content);
}

test("detect()：只枚举存在的浏览器，按 win32 顺序，firefox 取第一个 profile 目录", async () => {
  // 假 home：Edge + Chrome + Firefox 存在，Brave/Vivaldi/Opera 缺失
  plant("AppData/Local/Microsoft/Edge/Application/msedge.exe", "x");
  plant("AppData/Local/Microsoft/Edge/User Data", null);
  plant("AppData/Local/Google/Chrome/Application/chrome.exe", "x");
  plant("AppData/Local/Google/Chrome/User Data", null);
  plant("Program Files/Mozilla Firefox/firefox.exe", "x");
  plant("AppData/Roaming/Mozilla/Firefox/Profiles/abc123.default/cookies.sqlite", "x");
  process.env.USERPROFILE = fakeHome;
  process.env.HOME = fakeHome;
  process.env.LOCALAPPDATA = path.join(fakeHome, "AppData", "Local");
  process.env.APPDATA = path.join(fakeHome, "AppData", "Roaming");
  process.env.ProgramFiles = path.join(fakeHome, "Program Files");
  process.env["ProgramFiles(x86)"] = path.join(fakeHome, "Program Files (x86)");

  // 钉住"无默认偏好"分支：列表顺序即平台表顺序
  const det = await detectCredentialAdapters(() => null);
  assert.deepEqual(det.browsers.map((b) => b.id), ["edge", "chrome", "firefox"]); // win32 顺序：edge → chrome → … → firefox
  assert.deepEqual(det.browsers.map((b) => b.family), ["chromium", "chromium", "firefox"]);
  for (const b of det.browsers) {
    assert.ok(path.isAbsolute(b.exe) && fs.existsSync(b.exe), `${b.id} 的 exe 必须是已存在的绝对路径`);
    assert.equal(typeof b.label, "string");
  }
  const ff = det.browsers.find((b) => b.id === "firefox");
  assert.match(ff.userDataDir, /abc123\.default$/);
  assert.equal(det.browsers.find((b) => b.id === "edge").userDataDir, null); // Chromium 永不暴露真实 profile
  // 适配器：CDP 只走自有 profile + 手动粘贴恒在；Firefox 只在第三方 sqlite 可用时才出现
  let canSqlite = false;
  try {
    await import(["node", "sqlite"].join(":"));
    canSqlite = true;
  } catch {
    try {
      await import(["bun", "sqlite"].join(":"));
      canSqlite = true;
    } catch {
      canSqlite = false;
    }
  }
  assert.deepEqual(det.adapters.filter((a) => a.startsWith("cdp-")), ["cdp-own-profile"]); // 只剩自有 profile 一条 CDP 路
  assert.ok(det.adapters.includes("manual-paste"));
  assert.equal(det.adapters.includes("firefox-sqlite"), canSqlite);
  assert.equal(det.adapters.includes("bl"), false); // 假 home 下没有 ~/.bailian/config.json
  assert.ok(det.adapters.lastIndexOf("manual-paste") >= det.adapters.length - 2); // 末位前
});

async function sqliteAvailable() {
  try {
    await import(["node", "sqlite"].join(":"));
    return true;
  } catch {
    try {
      await import(["bun", "sqlite"].join(":"));
      return true;
    } catch {
      return false;
    }
  }
}

test("detect(默认浏览器=Edge)：Edge 置顶，preferred 指向它的 CDP 适配器", async () => {
  const det = await detectCredentialAdapters(() => "edge");
  assert.equal(det.browsers[0].id, "edge");
  assert.equal(det.adapters[0], "cdp-own-profile");
  assert.equal(det.preferred, "cdp-own-profile");
});

test("detect(默认浏览器=Firefox)：Firefox 置顶，preferred 指向 firefox-sqlite", async () => {
  const det = await detectCredentialAdapters(() => "firefox");
  assert.equal(det.browsers[0].id, "firefox");
  const ok = await sqliteAvailable();
  assert.equal(det.preferred, ok ? "firefox-sqlite" : "cdp-own-profile"); // 缺 sqlite 能力时静默退到下一条可行路
  assert.equal(det.adapters[0], det.preferred);
});

test("detect(未知 ProgId)：顺序不变，首选仍是第一条可行适配器", async () => {
  const det = await detectCredentialAdapters(() => null);
  assert.deepEqual(det.browsers.map((b) => b.id), ["edge", "chrome", "firefox"]);
  assert.ok(det.preferred);
});

test("detect(resolver 抛错)：静默退回平台顺序，仍返回可用列表", async () => {
  const det = await detectCredentialAdapters(() => {
    throw new Error("reg 不可用");
  });
  assert.equal(det.browsers[0].id, "edge");
  assert.ok(det.adapters.includes("cdp-own-profile"));
});

test("默认浏览器标识映射：ProgId / bundle id / .desktop 名 → BrowserId", () => {
  assert.equal(identToBrowser("MSEdgeBHTML"), "edge");
  assert.equal(identToBrowser("ChromeHTML"), "chrome");
  assert.equal(identToBrowser("FirefoxURL-308046B0AF4A39CB"), "firefox");
  assert.equal(identToBrowser("OperaGXStable"), "opera-gx");
  assert.equal(identToBrowser("com.google.chrome"), "chrome");
  assert.equal(identToBrowser("microsoft-edge.desktop"), "edge");
  assert.equal(identToBrowser("google-chrome.desktop"), "chrome");
  assert.equal(identToBrowser("NoSuchBrowser"), null);
});

test("parseRegProgId：从 reg query 输出取 ProgId，报错输出 → null", () => {
  const out = "\r\nHKEY_CURRENT_USER\\SOFTWARE\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\https\\UserChoice\r\n    ProgId    REG_SZ    MSEdgeBHTML\r\n\r\n";
  assert.equal(parseRegProgId(out), "MSEdgeBHTML");
  assert.equal(parseRegProgId("错误: 系统找不到指定的注册表项或值。"), null);
});

test("detect()：无浏览器时只剩手动粘贴，且绝不抛", async () => {
  process.env.USERPROFILE = path.join(tmp, "empty-home");
  process.env.HOME = path.join(tmp, "empty-home");
  process.env.LOCALAPPDATA = path.join(tmp, "empty-home", "AppData", "Local");
  process.env.APPDATA = path.join(tmp, "empty-home", "AppData", "Roaming");
  process.env.ProgramFiles = path.join(tmp, "empty-home", "Program Files");
  process.env["ProgramFiles(x86)"] = path.join(tmp, "empty-home", "Program Files (x86)");
  const det = await detectCredentialAdapters(() => null); // 假 home 下绝不读真机注册表
  assert.deepEqual(det.browsers, []);
  assert.deepEqual(det.adapters, ["manual-paste"]);
  assert.equal(det.preferred, "manual-paste"); // 无浏览器时首选退到唯一可行项
  // 还原环境，避免影响后续人工运行
  for (const [k, v] of Object.entries(envBefore)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  await detectCredentialAdapters();
});
