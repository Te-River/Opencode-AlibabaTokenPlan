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
const {
  buildStatus, mergeOffers, catalogToOffers, canonicalize, windowState, shanghaiISO,
  fmtFactor, showStrike, parseJsonc, writeStatusAtomic, readStatusFile, isStale,
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
  const dup = mergeOffers([...a, ...a]);
  assert.equal(dup.length, a.length); // 幂等
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

test("目录→offers：offpeak 档成 time-window，discount 成 flat-cut，Batch 叠加", () => {
  const offers = catalogToOffers(bailianSnapshotModels(), "bailian-live");
  const win = offers.find((o) => o.id === "catalog-offpeak");
  assert.ok(win && win.unit === "cny-price" && win.models.includes("deepseek-v4-pro-0813"));
  const b = offers.find((o) => o.id === "limited-qwen3.8-max");
  assert.equal(b.batchStack, 0.5); // 1(无限时) × 0.5(batch)
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
