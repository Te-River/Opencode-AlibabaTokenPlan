// 单元测试（零宿主）：node --test 兼容的最小断言集，跑 dist/core.mjs。
// 覆盖：回退链数据结构 / 合并正确性 / 跨午夜窗口 / 别名归一 / JSONC / 陈旧判定。

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";

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
    ["custom", "https://coding.ap-southeast-1.maas.aliyuncs.com/v1", true, false], // host=coding.*.maas：family 真 strict 假
    ["custom", "https://coding.dashscope.aliyuncs.com/v1", true, false], // 真实 coding 域（02 报告）
    ["custom", "https://coding-intl.dashscope.aliyuncs.com/v1", true, false], // 真实 coding-intl 域
    ["custom", "https://dashscope.aliyuncs.com/compatible-mode/v1", true, false], // dashscope 域：family 真
    ["custom", "https://dashscope-intl.aliyuncs.com/v1", true, false], // dashscope 变体域
    ["custom", "https://api.anthropic.com/v1", false, false], // 无关 host 两假
    // r3 Major-2 负例：主机判定必须全域名锚定，前缀/子串撞车一律 false
    ["custom", "https://coding.net/api", false, false], // "coding." 前缀撞车≠coding 端点
    ["custom", "https://token-plan.evil.io/v1", false, false], // "token-plan." 前缀但非 maas.aliyuncs.com
    ["custom", "https://x@coding.net/v1", false, false], // userinfo 伪饰，host 仍是 coding.net
    ["custom", "https://evil-dashscope.aliyuncs.com.qq.com/v1", false, false], // 子串含 dashscope.aliyuncs.com 但结尾他域
    ["custom", "https://mydashscope.somewhere.cn/v1", false, false], // dashscope 任意位置子串不认
    ["alibabaxyz", undefined, false, false], // providerID 也须锚定，防前缀撞车
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

// ═════════════════ 0.1.2 F5 多实例回归（桌面版按 workspace/实例多次调用 plugin()） ═════════════════
// 防再犯设计本身：0.1.1 守卫让第二次起的调用返回无 hooks 存根 → 这里同进程连调两次
// plugin()，断言「每次都是完整 hooks + 副作用只 boot 一次 + 后启 dispose 不杀首启」。
// 二启模拟=直接再 await plugin(...)：同一模块实例共享 globalThis.__atpServerStarted，
// 与桌面活体一致；进程级副作用经 __testing.setBootOverride 注入计数替身（不真打网络/bl）。

test("多实例：连续两次 plugin() 都返回完整 hooks，boot 仅一次，后启 dispose 不清首启", async () => {
  const t = srv.__testing;
  assert.equal(globalThis.__atpServerStarted, undefined, "本用例需全新进程（无先启污染）");
  assert.equal(t.bootCount, 0);
  let boots = 0, cleans = 0;
  t.setBootOverride(async (cfg) => {
    assert.equal(typeof cfg.toast, "boolean"); // 注入实现收到已解析配置（替代整组真实副作用）
    boots++;
    return () => { cleans++; };
  });
  try {
    // 0.1.3：slash 默认 false（不再注入 /tokenplan）——本用例测的是「每实例都返回完整
    // hooks + boot 一次」，注入断言需显式开 slash:true（缺省行为由 D6 slash 用例覆盖）
    const inst1 = await srv.AliBabaTokenPlanPlugin({ client: { tag: "ws1" } }, { slash: true });
    const inst2 = await srv.AliBabaTokenPlanPlugin({ client: { tag: "ws2" } }, { toast: false, slash: true });
    // ① 修复前的病灶：inst2 = {event,dispose} 存根。现在两次返回值都必须含全 hooks
    for (const [i, inst] of [[1, inst1], [2, inst2]]) {
      assert.equal(typeof inst.config, "function", `实例${i}：config hook 必须存在`);
      assert.equal(typeof inst["command.execute.before"], "function", `实例${i}：命令拦截 hook 必须存在`);
      assert.ok(inst.tool?.tokenplan_discounts && inst.tool?.bailian_discounts, `实例${i}：两个工具名都必须在`);
      assert.equal(typeof inst.tool.tokenplan_discounts.execute, "function");
    }
    // ② 二启实例的 config hook 真能注入命令（桌面 /command 缺 tokenplan 的直接复现断言）
    const cfgObj2 = {};
    await inst2.config(cfgObj2);
    assert.ok(cfgObj2.command?.tokenplan, "后启实例必须照常注入 /tokenplan");
    const cfgObj1 = {};
    await inst1.config(cfgObj1);
    assert.ok(cfgObj1.command?.tokenplan);
    // ③ 副作用不翻倍（publishStatus/refreshCatalog/定时器整组只随首启跑一次）
    assert.equal(boots, 1, "进程级副作用只应执行一次");
    assert.equal(t.bootCount, 1);
    // ④ 后启实例 dispose = no-op（不能让 ws2 unload 杀 ws1 的后台刷新）；首启 dispose 真清理
    inst2.dispose();
    assert.equal(cleans, 0, "后启实例 dispose 不得触发首启清理");
    assert.equal(t.bootCount, 1); // boot 状态不变（无重跑、无误杀）
    inst1.dispose();
    assert.equal(cleans, 1, "首启实例 dispose 应执行真清理");
  } finally {
    t.setBootOverride(null);
  }
});

// ═════════════════ 0.1.3 仪表盘优先（D1/D3/D4/D6：默认值·slash 门控·boot toast·autoOpen·面板渲染） ═════════════════

test("D1 配置默认值：webpanel.enabled=true（仪表盘主界面）/ dashboard.autoOpen=false；slash=false / toastOnBoot=true", () => {
  process.env.ATP_CONFIG_DIR = path.join(tmp, "cfg-13-empty");
  const c = core.loadConfig();
  assert.equal(c.webpanel.enabled, true);
  assert.equal(c.webpanel.port, 7777);
  assert.equal(c.dashboard.autoOpen, false);
  assert.equal(c.slash, false);
  assert.equal(c.toastOnBoot, true);
  fs.mkdirSync(process.env.ATP_CONFIG_DIR, { recursive: true });
  fs.writeFileSync(path.join(process.env.ATP_CONFIG_DIR, "config.jsonc"),
    `{ "webpanel": { "enabled": false, "port": 8123 }, "dashboard": { "autoOpen": true }, "slash": true }`);
  const c2 = core.loadConfig(); // 显式关面板=允许（粘滞端口逻辑保留）
  assert.equal(c2.webpanel.enabled, false);
  assert.equal(c2.webpanel.port, 8123);
  assert.equal(c2.dashboard.autoOpen, true);
  assert.equal(c2.slash, true);
  delete process.env.ATP_CONFIG_DIR;
});

test("D3 slash 门控：缺省不注入命令（斜杠菜单消失）、显式 true 恢复 0.1.1 注入；工具不受影响", async () => {
  const dir = path.join(tmp, "cfg-13-slash");
  fs.mkdirSync(dir, { recursive: true });
  process.env.ATP_CONFIG_DIR = dir;
  try {
    const inst = await srv.AliBabaTokenPlanPlugin({ client: null }); // 缺省 slash=false
    const o1 = {};
    await inst.config(o1);
    assert.equal(o1.command, undefined, "slash=false 时 config hook 不得注入 command.tokenplan");
    assert.ok(inst.tool?.tokenplan_discounts && inst["command.execute.before"], "工具与拦截 hook 本体保留");
    const inst2 = await srv.AliBabaTokenPlanPlugin({ client: null }, { slash: true });
    const o2 = {};
    await inst2.config(o2);
    assert.ok(o2.command?.tokenplan?.template, "slash=true 恢复注入（tuple options 覆盖文件默认）");
  } finally {
    delete process.env.ATP_CONFIG_DIR;
  }
});

test("D4 boot toast：2-3 行含窗口行+端口指引；无 client 静默不烧标志；整进程一次；双闸生效", async () => {
  const t = srv.__testing;
  t.resetBootToast();
  t.setBoundPort(7777);
  const msg = t.renderBootToast(new Date());
  assert.match(msg, /[▸▹] .+ \d{2}:\d{2}–\d{2}:\d{2}/, "窗口行（label+时段）");
  assert.ok(/仪表盘: http:\/\/127\.0\.0\.1:7777/.test(msg), `toast 须附实际绑定端口，实际: ${msg}`);
  assert.ok(msg.split("\n").length <= 3);
  t.setClient(null);
  assert.equal(await t.sendBootToast(core.DEFAULT_CONFIG), false, "无 client → 不烧标志");
  let calls = 0;
  t.setClient({ tui: { showToast: () => { calls++; return Promise.resolve(); } } });
  assert.equal(await t.sendBootToast(core.DEFAULT_CONFIG), true, "client 补上后仍可发（前次未烧标志）");
  assert.equal(calls, 1);
  assert.equal(await t.sendBootToast(core.DEFAULT_CONFIG), false, "整进程一次");
  assert.equal(calls, 1);
  t.resetBootToast();
  assert.equal(await t.sendBootToast({ ...core.DEFAULT_CONFIG, toast: false }), false, "toast 总开关闸");
  assert.equal(await t.sendBootToast({ ...core.DEFAULT_CONFIG, toastOnBoot: false }), false, "toastOnBoot 闸");
  t.resetBootToast();
  t.setClient({}); // 无 tui.showToast 路径也不得抛
  await t.sendBootToast(core.DEFAULT_CONFIG);
  t.setClient(null);
  t.resetBootToast();
  t.setBoundPort(0);
});

test("D1 autoOpen：探测失败返回 false 不抛；显式坏路径 spawn 失败静默；整进程只试一次", async () => {
  const t = srv.__testing;
  assert.equal(typeof t.findEdgePath, "function");
  assert.equal(t.findEdgePath({}, () => false), null, "空 env+全部 miss → null（绝不抛）");
  const hit = t.findEdgePath({ "ProgramFiles(x86)": "X:\\PF" }, (p) => p === "X:\\PF\\Microsoft\\Edge\\Application\\msedge.exe");
  assert.equal(hit, "X:\\PF\\Microsoft\\Edge\\Application\\msedge.exe", "命中常见安装路径");
  t.resetBootToast();
  assert.equal(await t.tryAutoOpen("http://127.0.0.1:7777", null), false, "探测不到 Edge=静默 false");
  assert.equal(await t.tryAutoOpen("http://127.0.0.1:7777", "Z:\\no-such.exe"), false, "一次性：首试已消耗（失败绝不重开）");
  t.resetBootToast();
  const r = await t.tryAutoOpen("http://127.0.0.1:7777", "Z:\\no-such-maybe-exe.exe"); // ENOENT 走 error 事件=静默
  assert.equal(typeof r, "boolean", "spawn 失败路径只要求不抛");
  t.resetBootToast();
});

// ── D2 面板：静态结构 + 零外部依赖 + 纯渲染函数（node vm 直跑 boot 守卫外的部分） ──

const PANEL_HTML = fs.readFileSync(new URL("../src/server/panel.html", import.meta.url), "utf8");

function panelSandbox() {
  const m = PANEL_HTML.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(m, "panel.html 缺内联 <script>");
  // vm 新 ES2019+ 不再把顶层 var/function 镜像回 sandbox 对象 → 脚本内显式导出到 exports 哨兵
  const src = m[1] + "\n;exports.esc=esc;exports.fmtHms=fmtHms;exports.winRemain=winRemain;exports.sortedWindows=sortedWindows;"
    + "exports.renderTopbar=renderTopbar;exports.renderWindows=renderWindows;exports.renderInSale=renderInSale;"
    + "exports.renderPrices=renderPrices;exports.renderNotices=renderNotices;exports.renderQuota=renderQuota;"
    + "exports.renderFooter=renderFooter;exports.renderAll=renderAll;"
    + "Object.defineProperties(exports,{STATE:{get:()=>STATE,set:v=>{STATE=v}}});";
  const ctx = vm.createContext({ exports: {}, console, setTimeout, setInterval: undefined, fetch: undefined, document: undefined });
  vm.runInContext(src, ctx);
  return ctx.exports;
}

test("D2 面板静态冒烟：七大区块容器齐备、内联脚本、零 CDN/外链资源", () => {
  for (const id of ["windows", "insale", "prices", "notices", "quota", "foot", "btnRefresh", "srcinfo"])
    assert.ok(PANEL_HTML.includes(`id="${id}"`), `缺容器 #${id}`);
  assert.ok(PANEL_HTML.includes("钉为独立小窗"), "缺「钉为独立窗口」提示区");
  assert.ok(/start msedge --app=http:\/\/127\.0\.0\.1:/.test(PANEL_HTML), "缺可复制完整钉窗命令");
  assert.ok(!/<script[^>]+src=|<link[^>]+href=|@import|https?:\/\/[^"']*\.css/i.test(PANEL_HTML), "零外部 CDN/字体/样式依赖");
});

test("D2 面板渲染：buildStatus 样例 → 0.25x/截至 2026-08-31/错峰 在场，HH:MM:SS tick 函数正确", () => {
  const sb = panelSandbox();
  const st = buildStatus(catalog(), new Date("2026-08-31T15:00:00+08:00"));
  st.inSale = [{ model: "kimi-k2.7-code", factor: "0.3x", note: "highspeed 0.6" }]; // /api/status 附加载荷
  sb.STATE = st;
  assert.equal(sb.fmtHms(19421000), "05:23:41"); // 秒级倒计时串
  const win = sb.renderWindows(st, new Date("2026-08-31T15:00:00+08:00"));
  assert.ok(win.includes("0.25x") && win.includes("0.5x"), "窗内模型行：0.5x→0.25x 划线价对");
  assert.ok(win.includes("错峰") && /<s>0\.5x<\/s>/.test(win), "错峰标签 + strikethrough baseFactor");
  assert.ok(/data-cd="\d+"/.test(win) && /data-num/.test(win), "每秒 tick 锚点 data-cd/data-num");
  const inSale = sb.renderInSale(st, new Date("2026-08-31T15:00:00+08:00"));
  assert.ok(inSale.includes("截至 2026-08-31"), "③ 区脚注含快照截至日");
  assert.ok(inSale.includes("Qoder Credits 消耗系数"), "③ 区脚注口径声明");
  assert.ok(inSale.includes("highspeed 0.6"), "E 行备注列");
  assert.ok(inSale.includes("限时"), "flat-cut 合并行带「限时」标签");
  const prices = sb.renderPrices(st);
  assert.ok(prices.includes("峰 / 谷") && prices.includes("deepseek-v4-pro-0813"), "④ textModels 峰谷双列");
  assert.ok(prices.includes("永不互算"), "④ 区脚注：与 Qoder 倍率分面不混排");
  const notices = sb.renderNotices(st, new Date("2026-08-31T15:00:00+08:00"));
  assert.ok(notices.includes("800/2000") && notices.includes("已过期 2026-07-30"), "⑤ free-calls claim/过期置灰");
  assert.ok(notices.includes("lite"), "⑤ policy 降级政策行");
  const foot = sb.renderFooter(st);
  assert.ok(foot.includes("钉为独立小窗") && foot.includes("--window-size=430,900"), "⑦ 钉窗命令提示区");
});

test("D2 面板转义：所有动态值经 esc()/safeUrl——注入样本不出裸标签，javascript: 链被丢弃", () => {
  const sb = panelSandbox();
  const evil = '<img src=x onerror="alert(1)">';
  const st = buildStatus(catalog(), new Date("2026-08-31T15:00:00+08:00"));
  st.windows = [{ ...st.windows[0], label: evil, models: [{ ...st.windows[0].models[0], model: evil, badge: evil, links: ["javascript:alert(1)", "https://ok.example/x"] }] }];
  st.offers = st.offers.map((o) => ({ ...o, label: evil, note: evil, links: ["javascript:alert(1)"] }));
  st.inSale = [{ model: evil, factor: evil, note: evil }];
  st.notices = [{ kind: "policy", text: evil, source: evil, expired: false }];
  st.textModels = [{ model: evil, input: evil, cache: evil, output: evil }];
  st.quota = { available: false, hint: evil };
  const all = sb.renderWindows(st, new Date()) + sb.renderInSale(st, new Date()) + sb.renderPrices(st) + sb.renderNotices(st, new Date()) + sb.renderQuota(st) + sb.renderFooter(st) + sb.renderTopbar(st).src;
  assert.ok(!/<img src=x/.test(all), "裸 <img> 注入串绝不允许出现在任何区块 HTML");
  assert.ok(!/javascript:/.test(all), "非 http(s) 链接一律不进 href");
  assert.ok(all.includes("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"), "对应位置为转义后文本");
  assert.ok(all.includes('href="https://ok.example/x"') && all.includes('target="_blank" rel="noopener"'), "合法 https 外链保留 target=_blank rel=noopener");
});
