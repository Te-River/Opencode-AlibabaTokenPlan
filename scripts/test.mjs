// 单元测试（零宿主）：node --test 兼容的最小断言集，跑 dist/core.mjs。
// 覆盖：回退链数据结构 / 合并正确性 / 跨午夜窗口 / 别名归一 / JSONC / 陈旧判定。

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "atp-test-"));
process.env.ATP_STATE_DIR = path.join(tmp, "state");

const core = await import("../dist/core.mjs");
const srv = await import("../dist/server.js"); // 零宿主可导入：静态依赖仅 node 内建 + core
const {
  buildStatus, mergeOffers, catalogToOffers, canonicalize, windowState, shanghaiISO, windowId,
  fmtFactor, showStrike, parseJsonc, writeStatusAtomic, readStatusFile, isStale, isCrossVerified,
  bailianSnapshotModels, qoderSnapshotOffers, BAILIAN_SNAPSHOT_AT,
} = core;

const catalog = () => ({ source: "snapshot", models: bailianSnapshotModels(), fetchedAt: BAILIAN_SNAPSHOT_AT });

test("回退链：snapshot 源构建出完整 StatusFile", () => {
  const st = buildStatus(catalog(), new Date("2026-08-31T12:00:00+08:00"));
  assert.equal(st.schemaVersion, 1);
  assert.equal(st.sources.catalog, "bailian-snapshot");
  assert.equal(st.sources.qoderSnapshot, "2026-08-31");
  assert.ok(st.windows.length >= 1);
  assert.ok(st.textModels.length === 8);
  assert.ok(st.offers.every((o) => o.origins.length >= 1));
});

test("别名归一：qmodel_38max→qwen3.8-max，未知串仅小写化", () => {
  assert.equal(canonicalize("qmodel_38max"), "qwen3.8-max");
  assert.equal(canonicalize("QModel_Latest"), "qwen3.7-max");
  assert.equal(canonicalize("SomeOther"), "someother");
});

test("合并：同 (kind,models,窗口,factor,unit) 去重且 origins 并集；异 factor 并列", () => {
  const a = qoderSnapshotOffers();
  const once = mergeOffers(a);
  const dup = mergeOffers([...a, ...a]);
  assert.equal(dup.length, once.length); // 幂等（m1 拆分后仍幂等；多 model 规则拆 per-model 后行数可 > 原规则数）
  // atp-flat-ultimate 的 models=[ultimate,cantus] 按 m1 拆成两条 per-model 行（id 带 #model）
  assert.ok(once.some((o) => o.id === "atp-flat-ultimate#ultimate" && o.models.length === 1));
  assert.ok(once.some((o) => o.id === "atp-flat-ultimate#cantus" && o.models.length === 1));
  const mixed = mergeOffers([
    ...a,
    ...catalogToOffers(bailianSnapshotModels(), "bailian-live"), // cny-price facet
    { id: "x1", kind: "time-window", label: "L", models: ["qwen3.8-max"], unit: "credits-factor", factor: 0.25, baseFactor: 0.5, window: { start: "22:00", end: "08:00", tz: "Asia/Shanghai" }, links: ["https://e"], origins: ["bailian-live"] },
  ]);
  const q = mixed.find((o) => o.id === "atp-offpeak-qwen38");
  assert.ok(q.origins.includes("bailian-live") && q.origins.includes("qoder-snapshot")); // 双源印证合并（全等才合）
  assert.ok(mixed.find((o) => o.factor === 0.5 && o.unit === "cny-price")); // cny 0.5 行另立 facet
  assert.ok(!mixed.some((o) => o.unit === "cny-price" && o.factor === 0.25 && o.id === "x1")); // 单位不互算：x1 不污染 cny 行
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

test("目录→offers：offpeak 档成 time-window，discount 成 flat-cut，Batch 叠加；m2 窗口/限时互斥", () => {
  const offers = catalogToOffers(bailianSnapshotModels(), "bailian-live");
  const win = offers.find((o) => o.id === "catalog-offpeak");
  assert.ok(win && win.unit === "cny-price" && win.models.includes("deepseek-v4-pro-0813"));
  // m2：qwen3.8-max 已在文档窗口规则（night-qwen38-max）出现 → 视为已有 time-window offer，跳过限时行
  assert.ok(!offers.some((o) => o.id === "limited-qwen3.8-max"), "被窗口覆盖的模型不应再出限时 flat-cut");
  // qwen3.7-max 有 input_token discount 0.5 且不在任何窗口 → 出 flat-cut
  const lim = offers.find((o) => o.id === "limited-qwen3.7-max");
  assert.equal(lim.factor, 0.5);
  // batch 叠加：qwen3.8-max 若独立算仍为 1×0.5=0.5，但已被窗口吞并；改验证 batchCombined 逻辑经 unit 测试覆盖
});

test("倍率串与划线价规则：toFixed(2) 去尾 0；仅字符串不等才划线", () => {
  assert.equal(fmtFactor(0.25), "0.25x");
  assert.equal(fmtFactor(0.1), "0.1x");
  assert.equal(fmtFactor(0.5), "0.5x");
  assert.equal(showStrike(0.5, 0.5), false);
  assert.equal(showStrike(0.5, 0.25), true);
});

test("parseJsonc：注释与尾逗号", () => {
  const j = parseJsonc(`{ "a": 1, // c\n /* b */ "b": "x//y", }`);
  assert.deepEqual(j, { a: 1, b: "x//y" });
});

test("status.json：原子写→读回→陈旧判定", () => {
  const st = buildStatus(catalog(), new Date("2026-08-31T12:00:00+08:00"));
  assert.ok(writeStatusAtomic(st));
  const r = readStatusFile(new Date("2026-08-31T12:01:00+08:00"));
  assert.equal(r.kind, "live");
  const r2 = readStatusFile(new Date("2026-08-31T12:30:00+08:00")); // 超 staleAfterSec=600
  assert.equal(r2.kind, "stale");
  assert.ok(isStale(st, new Date("2026-08-31T12:30:00+08:00")));
  fs.writeFileSync(path.join(tmp, "state", "status.json"), "{broken");
  assert.equal(readStatusFile().kind, "corrupt");
});

test("TUI 降级：embeddedSnapshotView 仅含 Qoder 源", async () => {
  // 走 dist/core.mjs（tui 的 read-status 依赖它）；这里直接复刻其逻辑断言
  const st = buildStatus({ source: "snapshot", models: [], fetchedAt: "embedded" }, new Date());
  const qOnly = st.offers.filter((o) => o.origins.length && o.origins.every((x) => x === "qoder-snapshot"));
  assert.ok(qOnly.length >= 3);
  assert.ok(st.windows.every((w) => w.nextBoundaryAt.includes("+08:00")));
});

// ═════════════════ review round-1 修复回归锚点（07 报告 M1–M4/m1–m9/D1） ═════════════════

test("M1 runBl argv 形态：command 恒 'bl'、args 逐位数组、shell 仅 win32（POSIX 整串 bug 已除）", () => {
  const argv = ["model", "list", "--page-size", "50", "--page", "1", "--output", "json"];
  const plan = srv.blSpawnPlan(argv);
  assert.equal(plan.command, "bl"); // 旧 bug：POSIX 下 "bl model list …" 整串当 command → ENOENT
  assert.deepEqual(plan.args, argv);
  assert.equal(plan.options.shell, process.platform === "win32");
});

test("M2 面板：/api/refresh 同源校验 + 响应不再带 CORS 通配头", () => {
  const t = srv.__testing;
  assert.equal(t.isSameOrigin({ headers: {} }), true); // Origin 缺省 → 放行
  assert.equal(t.isSameOrigin({ headers: { origin: "http://127.0.0.1:7777", host: "127.0.0.1:7777" } }), true);
  assert.equal(t.isSameOrigin({ headers: { origin: "http://evil.test:7777", host: "127.0.0.1:7777" } }), false);
  assert.equal(t.isSameOrigin({ headers: { host: "127.0.0.1:7777", "sec-fetch-site": "cross-site" } }), false);
  assert.equal(t.isSameOrigin({ headers: { origin: "http://127.0.0.1:7777", host: "127.0.0.1:7777", "sec-fetch-site": "same-origin" } }), true);
  const ssrc = fs.readFileSync(new URL("../src/server/index.ts", import.meta.url), "utf8");
  assert.ok(!ssrc.includes("Access-Control-Allow-Origin"), "CORS 通配头必须删净（panel 同源不需要）");
});

test("m1 合并粒度：多 model 规则拆 per-model，交集模型 origins 并集=双源印证", () => {
  const base = { kind: "time-window", label: "W", unit: "cny-price", factor: 0.5, window: { start: "22:00", end: "08:00", tz: "Asia/Shanghai" }, links: [] };
  const merged = mergeOffers([
    { ...base, id: "ab", models: ["a-one", "shared"], origins: ["bailian-live"] },
    { ...base, id: "bc", models: ["shared", "c-two"], origins: ["qoder-snapshot"] },
  ]);
  assert.equal(merged.length, 3); // (model,窗口,factor,unit) 全等的 shared 行合 1，a-one/c-two 各 1
  const row = merged.find((o) => o.models[0] === "shared");
  assert.equal(row.models.length, 1);
  assert.ok(row.origins.includes("bailian-live") && row.origins.includes("qoder-snapshot"));
  assert.ok(isCrossVerified(row));
  assert.equal(merged.filter((o) => o.id.endsWith("#shared")).length, 1); // 并集只留一行
});

test("m3 discounts.bestFactors 按 unit 分桶（跨单位不互比，旧单值字段已移除）", () => {
  const st = buildStatus(catalog(), new Date("2026-08-31T12:00:00+08:00"));
  const q38 = st.discounts.find((d) => d.model === "qwen3.8-max");
  assert.ok(q38);
  assert.equal(q38.bestFactors["credits-factor"], 0.25); // Qoder 错峰
  assert.equal(q38.bestFactors["cny-price"], 0.5); // 文档夜间窗
  assert.equal("bestFactor" in q38, false);
  assert.equal("bestRuleId" in q38, false);
});

test("m5 windowId 保分钟：同小时不同分钟不再碰撞；offpeak 契约命名保留", () => {
  assert.equal(windowId("22:00", "08:00"), "offpeak-22-08");
  assert.equal(windowId("09:15", "17:45"), "win-0915-1745");
  assert.notEqual(windowId("10:00", "10:30"), windowId("10:00", "10:45")); // 旧 win-10-10 碰撞
});

test("m6 toast 翻转去重：lastActive 先落键再 await，并发重入恰弹一次", async () => {
  const t = srv.__testing;
  const windows = t.getStatus().windows;
  assert.ok(windows.length >= 1);
  t.lastActive.clear();
  const states = windows.map((w) => ({ id: w.id, active: windowState(w, new Date()).active }));
  for (const s of states) t.lastActive.set(s.id, !s.active); // 预置=每窗都发生翻转
  let calls = 0;
  t.setClient({ tui: { showToast: async () => { calls++; await new Promise((r) => setImmediate(r)); } } });
  await Promise.all([t.maybeToast(), t.maybeToast()]); // 修复前两次都读到旧 prev → 双弹
  assert.equal(calls, states.length, "并发翻转每窗恰 1 弹（m6：判翻转后先 set 再 await）");
  for (const s of states) assert.equal(t.lastActive.get(s.id), s.active); // 键已落新态
  calls = 0;
  await t.maybeToast();
  assert.equal(calls, 0, "无翻转不弹");
  t.setClient(null);
});

test("m9 文档窗口规则来源恒 bailian-snapshot，不随目录源（live/cli）漂移", () => {
  const stLive = buildStatus({ source: "live", models: bailianSnapshotModels(), fetchedAt: "2026-08-31T00:00:00Z" }, new Date("2026-08-31T12:00:00+08:00"));
  const nightLive = stLive.offers.find((o) => o.id === "night-qwen38-max");
  assert.ok(nightLive);
  assert.deepEqual(nightLive.origins, ["bailian-snapshot"]); // 不被 bailian-live 抬升 originRank
  const nightSnap = buildStatus(catalog(), new Date("2026-08-31T12:00:00+08:00")).offers.find((o) => o.id === "night-qwen38-max");
  assert.deepEqual(nightSnap.origins, ["bailian-snapshot"]);
});

test("D1 双败降级原因不再丢失 → status.sources.error 可见", () => {
  const st = buildStatus({ ...catalog(), error: "live: HTTP 500 | cli: ENOENT bl" }, new Date("2026-08-31T12:00:00+08:00"));
  assert.equal(st.sources.error, "live: HTTP 500 | cli: ENOENT bl");
  const ok = writeStatusAtomic(st);
  assert.ok(ok);
  const back = readStatusFile(new Date("2026-08-31T12:01:00+08:00"));
  assert.equal(back.status.sources.error, "live: HTTP 500 | cli: ENOENT bl"); // 落盘回读同样带原因
});

test("M3 TUI tick：全模块仅 2 处 setInterval（30s 数据轮询+单一 1Hz 时钟），共享时钟双清理", () => {
  const src = fs.readFileSync(new URL("../src/tui/index.tsx", import.meta.url), "utf8");
  assert.equal((src.match(/setInterval\(/g) ?? []).length, 2);
  assert.equal((src.match(/,\s*1000\)/g) ?? []).length, 1); // 1Hz 只此一处（旧 3 处组件级 tick 已删）
  assert.match(src, /onCleanup\(stopSharedTicker\)/); // Solid root 清理①
  assert.match(src, /api\.lifecycle\.onDispose\(\(\) => \{[\s\S]{0,160}stopTicker\(\)/); // 宿主生命周期清理②
});

// ═════════════════ 0.1.1 R1 桌面命令通道（command.execute.before 拦截重写 parts） ═════════════════

test("R1 拦截：tokenplan → parts 重写为 [ignored 摘要 + synthetic 极简指令]，含窗口行/来源声明/时区", async () => {
  const t = srv.__testing;
  const seen = [];
  t.setClient({ session: { get: async (q) => { seen.push(q); return { data: { model: { providerID: "alibaba-token-plan-cn" } } }; } } });
  const raw = { type: "text", text: "兜底模板 $ARGUMENTS" };
  const output = { parts: [raw] };
  await t.handleTokenplanCommand({ command: "tokenplan", sessionID: "ses_42", arguments: "" }, output);
  assert.equal(seen.length, 1); // sessionID 取自 input.sessionID（宿主 hook 契约）
  assert.equal(seen[0].path.id, "ses_42");
  assert.equal(output.parts.length, 2); // 原模板被原地清空重写（宿主 trigger 后同一数组进 prompt()）
  const [table, directive] = output.parts;
  assert.equal(table.type, "text");
  assert.equal(table.ignored, true); // 用户可见、模型上下文剔除（桌面 asar request-builder 实证过滤 ignored）
  assert.notEqual(table.synthetic, true);
  assert.equal(directive.synthetic, true); // 模型可见、UI 隐藏
  assert.equal(directive.ignored, undefined);
  assert.match(table.text, /Token Plan 优惠摘要/);
  assert.match(table.text, /[▸▹] .+ \d{2}:\d{2}–\d{2}:\d{2}/); // 当前窗口行（label + start–end）
  assert.match(table.text, /后(结束|开始)（\d{2}:\d{2}）/); // 倒计时 + 边界
  assert.match(table.text, /在卖倍率/);
  assert.match(table.text, /来源=百炼公开目录.+快照转录 2026-08-31（静态截至日，不调用任何私有端点）/); // 来源与截至声明
  assert.match(table.text, /Asia\/Shanghai/); // 时区
  t.setClient(null);
});

test("R1 模型过滤：arguments=qwen3.8-flash 时只保留该模型相关行", async () => {
  const t = srv.__testing;
  const output = { parts: [{ type: "text", text: "x" }] };
  t.setClient({ session: { get: async () => ({ data: { model: { providerID: "alibaba-cn" } } }) } });
  await t.handleTokenplanCommand({ command: "tokenplan", sessionID: "s", arguments: " qwen3.8-flash " }, output);
  const text = output.parts[0].text;
  assert.ok(text.includes("qwen3.8-flash"), "过滤目标须在场");
  assert.ok(!text.includes("kimi-k2.7-code"), "其它在卖倍率行不得出现");
  assert.ok(!text.includes("deepseek-v4-pro"), "其它在卖倍率行不得出现（第二样本）");
  t.setClient(null);
});

test("R1 非阿里供应商：不受门控（照常出全量摘要）但行首加前缀注明", async () => {
  const t = srv.__testing;
  t.setClient({ session: { get: async () => ({ data: { model: { providerID: "anthropic" } } }) } });
  const output = { parts: [{ type: "text", text: "x" }] };
  await t.handleTokenplanCommand({ command: "tokenplan", sessionID: "s", arguments: "" }, output);
  const text = output.parts[0].text;
  assert.ok(text.startsWith("⚠ 当前供应商非阿里系（providerID=anthropic）"), `实际首行: ${text.split("\n")[0]}`);
  assert.match(text, /22:00–08:00/, "前缀之外仍输出完整共享倍率/优惠目录（显式调用不设门控）");
  t.setClient(null);
});

test("R1 边界：非 tokenplan 命令/无 client 不改 parts（fail-open）；session.get 异常仅丢前缀", async () => {
  const t = srv.__testing;
  const orig = [{ type: "text", text: "keep" }];
  t.setClient({ session: { get: async () => ({ data: {} }) } });
  const o1 = { parts: [...orig] };
  await t.handleTokenplanCommand({ command: "init", sessionID: "s", arguments: "" }, o1);
  assert.deepEqual(o1.parts, orig); // 其他命令放行
  t.setClient(null);
  const o2 = { parts: [...orig] };
  await t.handleTokenplanCommand({ command: "tokenplan", sessionID: "s", arguments: "" }, o2);
  assert.deepEqual(o2.parts, orig); // 无宿主 client → 保留旧 LLM 兜底模板路径
  t.setClient({ session: { get: async () => { throw new Error("boom"); } } });
  const o3 = { parts: [{ type: "text", text: "x" }] };
  await t.handleTokenplanCommand({ command: "tokenplan", sessionID: "s", arguments: "" }, o3);
  assert.equal(o3.parts.length, 2); // provider 探测失败只丢前缀，不拦摘要
  assert.ok(!o3.parts[0].text.startsWith("⚠"));
  t.setClient(null);
});

// ═════════════════ 0.1.1 R2 provider 门控 family/strict 判定表 ═════════════════

test("R2 matchProvider 判定表：family（默认放宽）vs strict（0.1.0 语义）", () => {
  const { matchProvider } = core;
  const rows = [
    // [providerID, baseURL, family, strict]
    ["alibaba-cn", undefined, true, false], // 用户最常用形态：family 真 / strict 假（0.1.0 会挡）
    ["alibaba-token-plan-cn", undefined, true, true], // 两模式皆真
    ["alibaba-token-plan", undefined, true, true],
    ["anthropic", undefined, false, false], // 两模式皆假
    ["alibaba", undefined, true, false],
    ["custom", "https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1", true, true], // host=token-plan 族
    ["custom", "https://coding.ap-southeast-1.maas.aliyuncs.com/v1", true, false], // host=coding.*：family 真 strict 假
    ["custom", "https://dashscope.aliyuncs.com/compatible-mode/v1", true, false], // dashscope 域：family 真
    ["custom", "https://dashscope-intl.aliyuncs.com/v1", true, false], // dashscope 变体域
    ["custom", "https://api.anthropic.com/v1", false, false], // 无关 host 两假
    [undefined, undefined, false, false], // 空输入
    ["", "not a url", false, false], // 坏 URL 静默按无 host
  ];
  for (const [id, base, fam, strict] of rows) {
    assert.equal(matchProvider(id, base, "family"), fam, `family(${id}, ${base})`);
    assert.equal(matchProvider(id, base, "strict"), strict, `strict(${id}, ${base})`);
  }
  assert.equal(matchProvider("alibaba-cn", undefined), true); // 第三参默认=family
});

test("R2 配置：providerMatch 默认 family；config.jsonc 可切 strict；非法值回退", () => {
  process.env.ATP_CONFIG_DIR = path.join(tmp, "cfg-r2");
  fs.mkdirSync(process.env.ATP_CONFIG_DIR, { recursive: true });
  assert.equal(core.loadConfig().providerMatch, "family"); // 缺席=默认
  fs.writeFileSync(path.join(process.env.ATP_CONFIG_DIR, "config.jsonc"), `{ "providerMatch": "strict" }`);
  assert.equal(core.loadConfig().providerMatch, "strict");
  fs.writeFileSync(path.join(process.env.ATP_CONFIG_DIR, "config.jsonc"), `{ "providerMatch": "whatever" }`);
  assert.equal(core.loadConfig().providerMatch, "family"); // 非法值→默认
  delete process.env.ATP_CONFIG_DIR;
});

test("R2 TUI/桌面接线：sidebar/home 走 cfg.providerMatch；桌面命令不受门控（源码锚点）", () => {
  const tuiSrc = fs.readFileSync(new URL("../src/tui/index.tsx", import.meta.url), "utf8");
  assert.match(tuiSrc, /sessionIsTokenPlan\(api, sid, cfg\.providerMatch\)/); // sidebar 门控用双模式判定
  assert.match(tuiSrc, /anyTokenPlanProvider\(api, cfg\.providerMatch\)/); // home_bottom 同源
  assert.ok(!/TP_PROVIDER_RE|isTPProviderID/.test(tuiSrc), "旧 strict-only 正则应移出 TUI");
  const srvSrc = fs.readFileSync(new URL("../src/server/index.ts", import.meta.url), "utf8");
  assert.match(srvSrc, /"command\.execute\.before": handleTokenplanCommand/); // R1 hook 已挂
  assert.match(srvSrc, /if \(input\?\.command !== "tokenplan"\) return;/); // 仅拦本命令
});
