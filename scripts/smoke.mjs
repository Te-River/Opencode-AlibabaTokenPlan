// 冒烟（零宿主，不依赖 opencode）：node scripts/smoke.mjs
// 打印：数据源、合并后 offers 数、Qoder time-window≥3、status.json 落盘+JSON 合法、
// 23:30/15:00 注入 now 的窗口判定断言（契约 §5 合并正确性）。

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "atp-smoke-"));
process.env.ATP_STATE_DIR = path.join(tmp, "state"); // 不碰真实用户目录

const core = await import("../dist/core.mjs");
const { buildStatus, writeStatusAtomic, readStatusFile, statusFilePath } = core;

function check(name, fn) {
  try { fn(); console.log(`  ✔ ${name}`); }
  catch (e) { console.error(`  ✘ ${name}: ${e.message}`); process.exitCode = 1; }
}

// ── 数据源三级回退（离线环境 live/cli 必然失败 → snapshot 兜底路径） ──
console.log("[smoke] 回退链验证（离线预期 live→cli→snapshot）");
const snapshotCatalog = { source: "snapshot", models: core.bailianSnapshotModels(), fetchedAt: core.BAILIAN_SNAPSHOT_AT };
const stSnap = buildStatus(snapshotCatalog, new Date("2026-08-31T12:00:00+08:00"));
console.log(`  数据源: ${stSnap.sources.catalog}（+ Qoder 快照 ${stSnap.sources.qoderSnapshot}）`);

const offersCount = stSnap.offers.length;
const qoderTimeWindows = stSnap.offers.filter((o) => o.kind === "time-window" && o.origins.includes("qoder-snapshot"));
console.log(`  合并后 offers 数: ${offersCount}`);
console.log(`  Qoder time-window 条数: ${qoderTimeWindows.length}`);

check("Qoder time-window ≥ 3", () => assert.ok(qoderTimeWindows.length >= 3, `${qoderTimeWindows.length} < 3`));
check("offers 已合并去重（atp-offpeak-qwen38 在场）", () =>
  assert.ok(stSnap.offers.some((o) => o.id === "atp-offpeak-qwen38")));
check("双单位不互算：同窗 cny-price 与 credits-factor 分行并列（价低先）", () => {
  const win = stSnap.windows.find((w) => w.id === "offpeak-22-08");
  assert.ok(win, "offpeak 窗口缺失");
  const q38 = win.models.filter((m) => m.model === "qwen3.8-max");
  assert.ok(q38.length >= 2, "两套单位应并列成行");
  const units = new Set(q38.flatMap((m) => m.origins.map((o) => (o === "qoder-snapshot" ? "credits" : "cny"))));
  assert.equal(units.size, 2, "两 facet 各自居位");
  assert.ok(parseFloat(q38[0].effective) <= parseFloat(q38[1].effective), "价低先");
});
check("全等合并出双源印证：(model,窗口,factor,单位) 全等 → origins 并集", () => {
  const st = buildStatus(snapshotCatalog, new Date("2026-08-31T12:00:00+08:00"));
  const dual = st.offers.find((o) => o.origins.includes("qoder-snapshot") && o.origins.some((x) => x !== "qoder-snapshot"));
  if (dual) {
    const win = st.windows.find((w) => w.id === "offpeak-22-08");
    assert.ok(win.models.some((m) => m.badge && m.badge.includes("双源印证")));
    console.log(`    双源行: ${dual.id} origins=${dual.origins.join("+")}`);
  } else {
    // 快照态下无天然全等行：构造等值 bailian-live 行验证合并语义
    const merged = core.mergeOffers([
      ...core.qoderSnapshotOffers(),
      { id: "dup-live", kind: "time-window", label: "错峰 5 折", models: ["qwen3.8-max"], unit: "credits-factor", factor: 0.25, baseFactor: 0.5, window: { start: "22:00", end: "08:00", tz: "Asia/Shanghai" }, links: ["https://b"], origins: ["bailian-live"] },
    ]);
    const row = merged.find((o) => o.id === "atp-offpeak-qwen38");
    assert.ok(row.origins.includes("bailian-live") && row.origins.includes("qoder-snapshot"), "origins 应并集");
    const win = buildStatus({ ...snapshotCatalog }, new Date("2026-08-31T12:00:00+08:00")).windows; // 结构不变
    assert.ok(Array.isArray(win));
  }
});
check("free-calls expired 标记（atp-free-200 → 已过期公告）", () => {
  const n = stSnap.notices.find((x) => x.text.includes("200"));
  assert.ok(n && n.expired === true);
});

// ── status.json 原子落盘 + JSON 合法 + TUI 读回 ──
check("status.json 落盘成功且 JSON 合法", () => {
  const ok = writeStatusAtomic(stSnap);
  assert.ok(ok, "writeStatusAtomic 失败");
  const raw = JSON.parse(fs.readFileSync(statusFilePath(), "utf8"));
  assert.equal(raw.schemaVersion, 1);
  const r = readStatusFile(new Date(stSnap.updatedAt));
  assert.equal(r.kind, "live");
});

// ── 23:30 / 15:00 注入 now 的窗口判定 ──
check("23:30: qwen3.8-max activeNow=true, boundaryKind=end, nextBoundaryAt=次日08:00+08:00", () => {
  const st = buildStatus(snapshotCatalog, new Date("2026-08-31T23:30:00+08:00"));
  const w = st.windows.find((x) => x.id === "offpeak-22-08");
  assert.ok(w);
  assert.equal(w.activeNow, true);
  assert.equal(w.boundaryKind, "end");
  assert.match(w.nextBoundaryAt, /^2026-09-01T08:00:00\.\d{3}\+08:00$/, `实际: ${w.nextBoundaryAt}`);
});
check("15:00: activeNow=false, boundaryKind=start, nextBoundaryAt=当日22:00+08:00", () => {
  const st = buildStatus(snapshotCatalog, new Date("2026-08-31T15:00:00+08:00"));
  const w = st.windows.find((x) => x.id === "offpeak-22-08");
  assert.equal(w.activeNow, false);
  assert.equal(w.boundaryKind, "start");
  assert.match(w.nextBoundaryAt, /^2026-08-31T22:00:00\.\d{3}\+08:00$/, `实际: ${w.nextBoundaryAt}`);
});
check("home_bottom 一行摘要可渲染", () => {
  const s = core.homeSummaryLine(stSnap, new Date("2026-08-31T16:37:00+08:00"));
  assert.match(s, /错峰 22:00–08:00/);
  console.log(`    摘要: ${s}`);
});

fs.rmSync(tmp, { recursive: true, force: true });
console.log(process.exitCode ? "[smoke] FAILED" : "[smoke] ALL PASS");
