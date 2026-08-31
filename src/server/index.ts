// server 插件入口 —— 移植 bailian-discount-panel.ts 全部行为（三级回退/缓存迁移/
// 端口粘滞/toast/工具/面板），新增：Qoder 快照并入、status.json 原子写、
// tokenplan_discounts 工具（旧名委托）、config hook 注入 tokenplan 命令、webpanel 默认关。
//
// 模块形态（03-D1 / quota dist/index.js 实证）：default export { id, server }，
// 避免宿主 getLegacyPlugins 兜底路径把命名导出当第二个插件重复装载。

import * as http from "node:http";
import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildStatus, writeStatusAtomic, loadConfig, cacheFilePath,
  portFilePath, legacyCacheFile, legacyPortFile,
  type AtpConfig, type CatalogInput, type QuotaInput,
} from "../core/status";
import { parseGroups, bailianSnapshotModels, BAILIAN_SNAPSHOT_AT, CREDITS_PER_YUAN } from "../core/bailian-snapshot";
import { QODER_SNAPSHOT_DATE, QODER_INSALE_FACTORS } from "../core/qoder-snapshot";
import { windowState, fmtCountdown } from "../core/rules";
import { fmtFactor, strikethrough, showStrike } from "../core/text";
import { isCrossVerified } from "../core/merge";
import { matchProvider, isProviderMatchMode } from "../core/provider";
import type { ModelEntry, OfferRule, StatusFile } from "../core/types";

const PKG_ID = "@te-river/opencode-alibabatokenplan";

// ─────────────────────────── 数据层状态（旧文件语义不变） ───────────────────────────

const state: CatalogInput = { source: "snapshot", fetchedAt: BAILIAN_SNAPSHOT_AT, models: bailianSnapshotModels() };
const quotaState: QuotaInput = { available: false, hint: "实时额度需要控制台授权：执行一次 bl auth login --console --console-site domestic 后自动启用" };

// 源1：百炼公开模型目录（匿名 POST，零登录）
const ZELDA_API = "zeldaHttp.dashscopeModel./zelda/api/v1/modelCenter/listFoundationModels";
const GATEWAY_URL =
  "https://bailian-cs.console.aliyun.com/cli/api.json?action=BroadScopeAspnGateway&product=sfm_bailian&api=" +
  encodeURIComponent(ZELDA_API);

async function fetchCatalogPage(pageNo: number, pageSize: number): Promise<{ total: number; list: any[] }> {
  const params = JSON.stringify({
    Api: ZELDA_API,
    V: "1.0",
    Data: {
      input: {
        pageNo, pageSize, name: "", providers: [], inferenceProviders: [], features: [],
        group: false, capabilities: [], contextWindows: [],
        queryPermissions: false, queryApplyStatus: false, queryActivationStatus: false,
        queryPrice: true, queryQpmInfo: false, supports: { inference: true },
      },
      cornerstoneParam: { protocol: "V2", console: "ONE_CONSOLE", productCode: "p_efm", switchUserType: 3, consoleSite: "BAILIAN_ALIYUN" },
    },
  });
  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "params=" + encodeURIComponent(params) + "&region=cn-beijing",
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`catalog HTTP ${res.status}`);
  const j: any = await res.json();
  const inner = j?.data?.DataV2?.data?.data;
  if (!inner || !Array.isArray(inner.list)) throw new Error("catalog 响应结构异常: " + JSON.stringify(j).slice(0, 160));
  return { total: Number(inner.total) || inner.list.length, list: inner.list };
}

async function fetchCatalogLive(): Promise<ModelEntry[]> {
  const all: any[] = [];
  const pageSize = 50;
  let total = Infinity;
  for (let page = 1; page <= 15 && all.length < total; page++) {
    const r = await fetchCatalogPage(page, pageSize);
    total = r.total;
    if (!r.list.length) break;
    all.push(...r.list);
  }
  if (!all.length) throw new Error("catalog 返回为空");
  return parseGroups(all);
}

// 源2：本机 bl CLI
/** 组装 bl 子进程调用参数（独立导出便于单测断言 argv 形态，见 test.mjs M1）。
 * 关键：command 恒为 "bl"、args 传数组——POSIX 下绝不能把整串当 command（shell:false 时
 * execvp 会把 "bl model list" 整串当可执行名查找 → 永久 ENOENT，cli 源静默失效）。
 * win32 下 bl 是 .cmd shim 需经 shell，args 里的参数由 Node 逐个加引号安全拼接。 */
export function blSpawnPlan(args: string[]): { command: string; args: string[]; options: cp.SpawnOptions } {
  return { command: "bl", args: [...args], options: { shell: process.platform === "win32", env: { ...process.env, NO_COLOR: "1" } } };
}

function runBl(args: string[], timeoutMs = 30_000): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const plan = blSpawnPlan(args);
    const child = cp.spawn(plan.command, plan.args, plan.options);
    let stdout = "", stderr = "";
    let done = false;
    const timer = setTimeout(() => {
      if (!done) { done = true; child.kill(); resolve({ code: -1, stdout, stderr: stderr + "\ntimeout" }); }
    }, timeoutMs);
    child.stdout!.on("data", (d: Buffer) => (stdout += d.toString()));
    child.stderr!.on("data", (d: Buffer) => (stderr += d.toString()));
    child.on("error", (e: Error) => { if (!done) { done = true; clearTimeout(timer); resolve({ code: -1, stdout, stderr: String(e) }); } });
    child.on("close", (code: number | null) => { if (!done) { done = true; clearTimeout(timer); resolve({ code: code ?? -1, stdout, stderr }); } });
  });
}

async function fetchCatalogCli(): Promise<ModelEntry[]> {
  const r = await runBl(["model", "list", "--page-size", "50", "--page", "1", "--output", "json"]);
  if (r.code !== 0) throw new Error("bl model list 退出码 " + r.code + " " + r.stderr.slice(0, 120));
  const j = JSON.parse(r.stdout);
  const groups = Array.isArray(j) ? j : (j.items || []);
  const models = parseGroups(groups);
  if (!models.length) throw new Error("bl model list 无数据");
  return models;
}

// 缓存：新命名空间 + 旧路径一次性迁移（03-D7）
function loadCache(): ModelEntry[] | null {
  try {
    const j = JSON.parse(fs.readFileSync(cacheFilePath(), "utf8"));
    if (Array.isArray(j.models) && j.models.length) return j.models;
  } catch {}
  try {
    const j = JSON.parse(fs.readFileSync(legacyCacheFile(), "utf8"));
    if (Array.isArray(j.models) && j.models.length) return j.models; // 调用方 saveCache 落到新目录=迁移
  } catch {}
  return null;
}

function saveCache(models: ModelEntry[]) {
  try {
    fs.mkdirSync(path.dirname(cacheFilePath()), { recursive: true });
    fs.writeFileSync(cacheFilePath(), JSON.stringify({ savedAt: new Date().toISOString(), models }, null, 2));
  } catch {}
}

// 端口粘滞：避免重启后面板地址漂移（.port 迁新目录，旧文件仅作候选）
function lastPort(): number {
  for (const f of [portFilePath(), legacyPortFile()]) {
    try {
      const v = Number(fs.readFileSync(f, "utf8").trim());
      if (Number.isInteger(v) && v >= 1024 && v <= 65535) return v;
    } catch {}
  }
  return 0;
}
function savePort(port: number) {
  try {
    fs.mkdirSync(path.dirname(portFilePath()), { recursive: true });
    fs.writeFileSync(portFilePath(), String(port));
  } catch {}
}

let refreshing = false;
async function refreshCatalog(cfg: AtpConfig, force = false): Promise<void> {
  if (refreshing) return;
  refreshing = true;
  try {
    let models: ModelEntry[] | null = null;
    let source: CatalogInput["source"] = "snapshot";
    let err = "";
    try { models = await fetchCatalogLive(); source = "live"; } catch (e: any) {
      err = "live: " + String(e?.message || e);
      try { models = await fetchCatalogCli(); source = "cli"; } catch (e2: any) {
        err += " | cli: " + String(e2?.message || e2);
      }
    }
    if (models && models.length) {
      state.source = source;
      state.fetchedAt = new Date().toISOString();
      state.models = models;
      state.error = err || undefined;
      saveCache(models);
    } else {
      // D1：双败（live+cli 均未产出）时降级原因必须落进 state.error → status.sources.error，
      // 不再只在 force 分支写——静默的「源失效」会让面板/工具显示成"正常快照态"。
      state.error = err || state.error;
      if (force) {
        const cached = loadCache();
        if (cached) { state.models = cached; state.fetchedAt = BAILIAN_SNAPSHOT_AT + "（缓存）"; }
      }
    }
    publishStatus();
    if (cfg.toast) void maybeToast(); // 刷新后推进 toast 状态机（保留旧行为）
  } finally {
    refreshing = false;
  }
}

async function refreshQuota(): Promise<void> {
  quotaState.checkedAt = new Date().toISOString();
  const r = await runBl(["usage", "token-plan", "--output", "json"], 45_000);
  const out = (r.stdout || "").trim();
  if (r.code === 0 && out.startsWith("{")) {
    try {
      quotaState.data = JSON.parse(out);
      quotaState.available = true;
      quotaState.hint = undefined;
      publishStatus();
      return;
    } catch {}
  }
  quotaState.data = undefined;
  quotaState.available = false;
  const s = r.stderr + " " + r.stdout;
  quotaState.hint = /console|token|login|auth/i.test(s)
    ? "实时额度需要控制台授权：执行一次 bl auth login --console --console-site domestic 后自动启用"
    : "无法获取实时额度（bl CLI 不可用或查询失败：" + (r.stderr || r.stdout || "").slice(0, 120) + "）";
  publishStatus();
}

function currentStatus(): StatusFile {
  return buildStatus(state, new Date(), { ...quotaState });
}

/** 每次状态变化原子写 status.json（TUI/他器消费的唯一运行时契约）。 */
function publishStatus(): void {
  try { writeStatusAtomic(currentStatus()); } catch {}
}

// ─────────────────────────── toast（边界翻转提醒，双源同窗只弹一次） ───────────────────────────

let client: any = null;
// 去重键=窗口（非 rule.id）：qoder 与百炼两套单位同窗合并后仍是一个物理窗口 → 恰 2 次/日
const lastActive = new Map<string, boolean>();

async function maybeToast(): Promise<void> {
  const st = currentStatus();
  for (const w of st.windows) {
    const ws = windowState(w, new Date());
    const prev = lastActive.get(w.id);
    // m6：判翻转后先落键再 await showToast——并发/重入（tick 定时器与面板刷新同时触发）时，
    // 第二个调用读到的 prev 已是新态 → 不会二次弹同窗 toast（旧顺序留有 await 窗口期竞态）。
    lastActive.set(w.id, ws.active);
    if (cfgNow?.toast !== false && prev !== undefined && prev !== ws.active && client) {
      const models = w.models.map((m) => `${m.model}${m.effective ? "→" + m.effective : ""}`);
      const msg = ws.active
        ? `${w.label}已开始：${models.join("、")}（至 ${w.end}，北京时间）`
        : `${w.label}已结束：${models.join("、")}（下次 ${w.start} 开始）`;
      try {
        await client.tui?.showToast?.({ body: { title: "Token Plan 优惠提醒", message: msg, variant: ws.active ? "success" : "info", duration: 8000 } });
      } catch {}
    }
  }
}

// ─────────────────────────── 可选 web 面板（默认关，03-D5） ───────────────────────────

function renderHtml(): string {
  // 优先读随包 panel.html：改样式只需保存文件并刷新浏览器
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    for (const p of [path.join(here, "..", "src", "server", "panel.html"), path.join(here, "panel.html")]) {
      if (fs.existsSync(p)) return fs.readFileSync(p, "utf8");
    }
  } catch {}
  // 兜底：最小内置渲染（真实样式以随包 panel.html 为准）
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>Token Plan 优惠雷达</title></head><body><pre id="p">加载中…</pre><script>async function l(){var r=await fetch("/api/status");document.getElementById("p").textContent=JSON.stringify(await r.json(),null,2)}l();setInterval(l,30000);</script></body></html>`;
}

let server: http.Server | null = null;
const REFRESH_THROTTLE_MS = 5_000;
let lastRefreshAt = 0; // /api/refresh 进程内节流戳（M2）

/** M2 同源校验：Origin 缺省（同源 GET/curl 常不带）或 host 与本服务 Host 完全一致才放行；
 * 请求带 Sec-Fetch-Site 时额外闸——必须 same-origin（浏览器发起的跨站请求会被标记拦截）。 */
function isSameOrigin(req: http.IncomingMessage): boolean {
  const origin = req.headers.origin;
  if (origin !== undefined) {
    let oh: string;
    try { oh = new URL(String(origin)).host; } catch { return false; }
    if (oh !== String(req.headers.host ?? "")) return false;
  }
  const sfs = req.headers["sec-fetch-site"];
  if (sfs !== undefined && String(sfs).toLowerCase() !== "same-origin") return false;
  return true;
}

function startPanel(port: number): Promise<string> {
  return new Promise((resolve) => {
    const handler = (req: http.IncomingMessage, res: http.ServerResponse) => {
      const url = (req.url || "/").split("?")[0];
      if (url === "/api/status") {
        // M2：panel 与本服务同源，删除 CORS 通配头（不再允许任意站点跨源读状态）
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify(currentStatus()));
        return;
      }
      if (url === "/api/refresh") {
        if (!isSameOrigin(req)) {
          res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("forbidden");
          return;
        }
        const t0 = Date.now();
        if (t0 - lastRefreshAt < REFRESH_THROTTLE_MS) {
          res.writeHead(429, { "Retry-After": "5", "Content-Type": "text/plain; charset=utf-8" });
          res.end("throttled");
          return;
        }
        lastRefreshAt = t0;
        refreshCatalog(cfgNow ?? loadConfig(), true)
          .then(() => { res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" }); res.end("ok"); })
          .catch(() => { res.writeHead(500); res.end("refresh failed"); });
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(renderHtml());
    };
    const candidates = [...new Set([lastPort(), port, ...Array.from({ length: 20 }, (_, i) => port + 1 + i)])].filter((p) => p >= 1024 && p <= 65535);
    let idx = 0;
    const tryListen = () => {
      const p = candidates[idx];
      const s = http.createServer(handler);
      s.on("error", () => {
        try { s.close(); } catch {} // m8：失败实例显式 close，不留悬挂句柄
        if (++idx >= candidates.length) { resolve(""); return; }
        tryListen();
      });
      // m8：只在 listen 成功回调内赋 server 句柄（旧代码把绑定失败的实例也写进 server，dispose 关错对象）
      s.listen(p, "127.0.0.1", () => { server = s; savePort(p); resolve(`http://127.0.0.1:${p}`); });
    };
    tryListen();
  });
}

// ─────────────────────────── 工具（新名实现 + 旧名委托） ───────────────────────────

async function loadToolHelper(): Promise<any> {
  try {
    const m: any = await import("@opencode-ai/plugin");
    if (m?.tool) return m.tool;
  } catch {}
  const chain: any = function () { return chain; };
  chain.optional = () => chain;
  chain.describe = () => chain;
  const shim: any = (t: any) => t;
  shim.schema = { string: () => chain, number: () => chain, boolean: () => chain };
  return shim;
}

function unitLabel(r: OfferRule): string {
  return r.unit === "credits-factor" ? "Credits 倍率" : "¥价格倍率";
}

function renderToolOutput(filter: string): string {
  const st = currentStatus();
  const lines: string[] = [];
  const srcNote = st.sources.catalog === "bailian-live" ? "实时接口" : st.sources.catalog === "bailian-cli" ? "本机 CLI" : "快照";
  lines.push(`数据源: ${srcNote}（更新于 ${state.fetchedAt}）+ Qoder 快照 ${QODER_SNAPSHOT_DATE}（静态，不调私有端点）；1 元 = ${CREDITS_PER_YUAN} Credits（计费示例换算，非官方汇率）；时区 Asia/Shanghai`);
  for (const w of st.windows) {
    const ws = windowState(w, new Date());
    const cd = ws.active ? `${fmtCountdown(ws.minutesToNextBoundary)}后结束（${w.end}）` : `${fmtCountdown(ws.minutesToNextBoundary)}后开始（${w.start}）`;
    for (const m of w.models) {
      if (filter && m.model !== filter && !m.model.includes(filter)) continue;
      const strike = showStrike(parseFloat(m.regular ?? ""), parseFloat(m.effective ?? ""));
      lines.push(`• [${w.start}–${w.end}] ${m.model}: ${strike ? strikethrough(m.regular!) + " " : ""}${m.effective ?? ""} ${m.badge ?? ""}${isCrossVerified(m) ? "（双源印证）" : ""} → ${w.activeNow ? "优惠中，" : ""}${cd}`);
    }
  }
  const flat = st.offers.filter((r) => r.kind === "flat-cut" && (!filter || r.models.some((x) => x === filter || x.includes(filter))));
  if (flat.length) {
    lines.push("限时优惠（两套单位不互算）：");
    for (const r of flat.slice(0, 30)) {
      const tags = [r.factor !== undefined ? `×${r.factor}` : "", r.batchStack !== undefined ? `Batch叠加×${r.batchStack}` : ""].filter(Boolean).join(" ");
      lines.push(`• ${r.models.join(", ")}（${unitLabel(r)}）: ${tags}${r.note ? " — " + r.note : ""}`);
    }
  }
  const tms = st.textModels.filter((m) => !filter || m.model.includes(filter));
  for (const m of tms) {
    lines.push(`• ${m.model}: 输入 ${m.input} / 缓存 ${m.cache} / 输出 ${m.output} Credits/百万tokens${m.bands ? `（${m.bands}）` : ""}${m.creditsFactor ? ` · Qoder 倍率 ${m.creditsFactor}` : ""}${m.badge ? `（${m.badge.label}，${m.badge.countdown}）` : ""}`);
  }
  const inSale = Object.entries(QODER_INSALE_FACTORS).filter(([k]) => !filter || k === filter);
  if (inSale.length && !filter) lines.push("Qoder 在卖常规倍率（非优惠）：" + inSale.map(([k, v]) => `${k} ${fmtFactor(v.factor)}${v.note ? "(" + v.note + ")" : ""}`).join(" · "));
  for (const n of st.notices) if (!n.expired || filter) lines.push(`• [${n.kind}] ${n.text}${n.expired ? "（已过期）" : ""} 来源:${n.source}`);
  if (!st.quota.available) lines.push(`额度: ${st.quota.hint ?? "不可用"}`);
  else lines.push(`额度: 实时可用（${st.quota.checkedAt}）`);
  if (st.sources.error) lines.push(`数据源降级: ${st.sources.error}`);
  lines.push("口径：消耗/Cost 单位 Credit；runtimeConfig 会变实际消耗；折扣以控制台账单为准。");
  return lines.join("\n");
}

// ─────────────────────────── R1：桌面命令通道（command.execute.before 确定性输出） ───────────────────────────

/** 紧凑优惠摘要——桌面（无 TUI 渲染层）唯一可靠通道是转录文本，这里做确定性渲染。
 *  providerID 仅用于「非阿里系」前缀注明；本函数不做门控（显式调用总是可用，R2 边界）。 */
export function renderDesktopSummary(filter = "", providerID?: string): string {
  const st = currentStatus();
  const now = new Date();
  const match = (m: string) => !filter || m === filter || m.includes(filter);
  const lines: string[] = [];
  if (providerID && !matchProvider(providerID, undefined, "family")) {
    lines.push(`⚠ 当前供应商非阿里系（providerID=${providerID}），以下为其共享模型倍率与优惠目录。`);
  }
  const srcNote = st.sources.catalog === "bailian-live" ? "实时接口" : st.sources.catalog === "bailian-cli" ? "本机 CLI" : "快照";
  let clock = "";
  try { clock = now.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false }); } catch { clock = now.toISOString(); }
  lines.push(`Token Plan 优惠摘要 · ${clock} · Asia/Shanghai` + (filter ? ` · 过滤: ${filter}` : ""));
  // 当前窗口状态 + 倒计时（进行中优先，其次按最近边界）
  const wss = st.windows.map((w) => ({ w, s: windowState(w, now) }));
  const ordered = [...wss.filter((x) => x.s.active), ...wss.filter((x) => !x.s.active)]
    .filter((x) => !filter || x.w.models.some((m) => match(m.model)));
  for (const { w, s } of ordered.slice(0, 2)) {
    const cd = s.active
      ? `${fmtCountdown(s.minutesToNextBoundary)}后结束（${w.end}）`
      : `${fmtCountdown(s.minutesToNextBoundary)}后开始（${w.start}）`;
    lines.push(`${s.active ? "▸" : "▹"} ${w.label} ${w.start}–${w.end} ${s.active ? "优惠中" : "未开始"} · ${cd}`);
    for (const m of w.models.filter((x) => match(x.model)).slice(0, 6)) {
      const strike = showStrike(parseFloat(m.regular ?? ""), parseFloat(m.effective ?? ""));
      lines.push(`   ${m.model} ${strike ? strikethrough(m.regular!) + " " : ""}${m.effective ?? ""} ${m.badge ?? ""}${isCrossVerified(m) ? " [双源印证]" : ""}`);
    }
  }
  if (filter && !ordered.length) lines.push(`（当前窗口目录中无「${filter}」相关条目，以下按全量数据过滤）`);
  const inSale = Object.entries(QODER_INSALE_FACTORS).filter(([k]) => match(k));
  if (inSale.length) lines.push("在卖倍率（Qoder Credits，非优惠基准）：" + inSale.map(([k, v]) => `${k} ${fmtFactor(v.factor)}${v.note ? "(" + v.note + ")" : ""}`).join(" · "));
  const flat = st.offers.filter((r) => r.kind === "flat-cut" && r.models.some(match));
  if (flat.length) {
    lines.push(`限时优惠（共 ${flat.length} 条，显示前 ${Math.min(flat.length, 10)} 条；两套单位不互算）：`);
    for (const r of flat.slice(0, 10)) {
      const tags = [r.factor !== undefined ? `×${r.factor}` : "", r.batchStack !== undefined ? `Batch叠加×${r.batchStack}` : ""].filter(Boolean).join(" ");
      lines.push(`• ${r.models.join(", ")}（${unitLabel(r)}）: ${tags}${r.note ? " — " + r.note : ""}`);
    }
  }
  if (filter) {
    for (const m of st.textModels.filter((x) => match(x.model))) {
      lines.push(`• ${m.model}: 输入 ${m.input} / 缓存 ${m.cache} / 输出 ${m.output} Credits/百万tokens${m.bands ? `（${m.bands}）` : ""}${m.badge ? `（${m.badge.label}，${m.badge.countdown}）` : ""}`);
    }
  }
  lines.push(st.quota.available ? `额度: 实时可用（${st.quota.checkedAt}）` : `额度: ${st.quota.hint ?? "不可用"}`);
  lines.push(`来源=百炼公开目录（${srcNote}，更新于 ${state.fetchedAt}）+ Qoder 客户端公开界面快照转录 ${QODER_SNAPSHOT_DATE}（静态截至日，不调用任何私有端点）`);
  lines.push(`口径：时区 Asia/Shanghai；1 元 = ${CREDITS_PER_YUAN} Credits（计费示例换算，非官方汇率）；消耗/Cost 单位 Credit；runtimeConfig 会变实际消耗；折扣以控制台账单为准。`);
  return lines.join("\n");
}

/** R1 拦截实现（机制依据桌面 app.asar 实证，详见 11 号报告）：
 *  宿主在 trigger("command.execute.before", input, {parts}) 之后**无条件**用同一 parts 数组调 prompt()，
 *  且模型请求只收 `text && !ignored && text!==""` 的部分 → 原地重写 parts 为
 *  [ignored 全表（用户可见/模型不可见） + synthetic 极简指令（模型可见/用户隐藏）]，
 *  模型只剩一句确认的输出，优惠文本 100% 由插件确定性渲染进转录。
 *  quota 实码（plugin.js:911-915→218-220→57-84）只做了另一层：noReply+ignored 独立注入、不触碰
 *  命令自身 parts（其模板仍会过 LLM）——本实现取其注入语义、补上其未做的 parts 重写。
 *  fail-open：无 client / 渲染异常 → 不改 parts，旧「经 LLM 调工具」模板兜底（v0.1.0 行为）。 */
export async function handleTokenplanCommand(input: any, output: any): Promise<void> {
  if (input?.command !== "tokenplan") return;
  const parts = output?.parts;
  if (!client || !Array.isArray(parts)) return;
  let text: string;
  try {
    let providerID: string | undefined;
    try {
      // v1 类型未声明 Session.model，运行时存在（quota plugin.js:470-473 同款读法；失败=不加前缀）
      const r: any = await client.session?.get?.({ path: { id: String(input.sessionID ?? "") } });
      const pid = r?.data?.model?.providerID ?? r?.model?.providerID;
      if (typeof pid === "string" && pid) providerID = pid;
    } catch {}
    text = renderDesktopSummary(String(input.arguments ?? "").trim(), providerID);
  } catch {
    return; // fail-open：保持宿主默认命令流转
  }
  parts.length = 0;
  parts.push({ type: "text", text, ignored: true });
  parts.push({
    type: "text",
    text: `插件已把 Token Plan 优惠摘要直接写入本条消息（ignored 部分不进入你的上下文）。请仅回复一句「✅ 优惠摘要已展示（数据截至 ${QODER_SNAPSHOT_DATE}）」，不要复述摘要内容、不要调用任何工具。`,
    synthetic: true,
  });
}

// ─────────────────────────── 插件入口 ───────────────────────────

let cfgNow: AtpConfig | null = null;

const plugin = async (input: any, options?: any) => {
  client = input?.client ?? null;
  const g = globalThis as any;
  if (g.__atpServerStarted) return { event: async () => {}, dispose: () => {} };
  g.__atpServerStarted = true;

  // 配置：文件优先，宿主若传 tuple options 则叠加（D5：传了就赢，没传不输）
  cfgNow = loadConfig();
  try {
    const extra = typeof options === "string" ? undefined : options;
    if (extra && typeof extra === "object") {
      const merged = JSON.parse(JSON.stringify(cfgNow));
      for (const k of ["webpanel", "sidebar", "toast", "refresh", "providerMatch"]) {
        const v = (extra as any)[k];
        if (v === undefined) continue;
        // m7：toast 等布尔/标量键直接赋值——旧 Object.assign(bool, v) 静默失效/抛错
        // R2：providerMatch 只认 family/strict 两个字面量
        if (k === "providerMatch") { if (isProviderMatchMode(v)) (merged as any)[k] = v; }
        else if (typeof v !== "object" || v === null) (merged as any)[k] = v;
        else Object.assign((merged as any)[k] ?? {}, v);
      }
      cfgNow = merged;
    }
  } catch {}

  const cfg: AtpConfig = cfgNow ?? loadConfig();
  cfgNow = cfg;
  const cached = loadCache();
  if (cached) { state.models = cached; state.fetchedAt = BAILIAN_SNAPSHOT_AT + "（缓存）"; }
  publishStatus(); // 先落盘一份（TUI 冷启动即有数据）
  refreshCatalog(cfg);
  refreshQuota().catch(() => {});

  let panelUrl = "";
  if (cfg.webpanel.enabled) {
    panelUrl = await startPanel(cfg.webpanel.port);
    console.log(`[alibabatokenplan] 面板已启动: ${panelUrl || "启动失败（端口耗尽）"}`);
  }

  const catalogTimer = setInterval(() => { refreshCatalog(cfg).catch(() => {}); }, cfg.refresh.catalogMin * 60_000);
  const quotaTimer = setInterval(() => { refreshQuota().catch(() => {}); }, cfg.refresh.quotaMin * 60_000);
  const tickTimer = setInterval(() => { if (cfg.toast) maybeToast().catch(() => {}); publishStatus(); }, 60_000);
  for (const t of [catalogTimer, quotaTimer, tickTimer]) t.unref?.();

  const toolHelper = await loadToolHelper();
  const S: any = toolHelper.schema;
  const toolDef = (descPrefix: string) => toolHelper({
    description:
      descPrefix +
      "查询百炼 Token Plan 当前优惠策略、优惠时段与开始/结束倒计时（含 Qoder 快照 2026-08-31 静态数据），以及各模型 Credits 消耗倍率。" +
      "可选参数 model 过滤单个模型。无需登录即可使用。",
    args: {
      model: S.string().optional().describe("按模型名过滤，例如 qwen3.8-max"),
    },
    async execute(args: any) {
      return { title: "Token Plan 优惠与倍率", output: renderToolOutput(args?.model ? String(args.model) : "") };
    },
  });

  return {
    event: async () => {},
    // m8：宿主卸载 → 关面板 server + 清全部定时器，不留端口/句柄/后台刷新泄漏
    dispose: () => {
      for (const t of [catalogTimer, quotaTimer, tickTimer]) clearInterval(t);
      try { server?.close(); } catch {}
      server = null;
    },
    config: async (config: any) => {
      // R1 主路径由 command.execute.before 确定性重写；此 template 是 fail-open 兜底
      // （宿主 hook 异常/无 client 时才走 LLM，接受 token 成本并注明）
      config.command = config.command ?? {};
      config.command.tokenplan = {
        description: "显示 Token Plan 优惠/倍率/倒计时：插件确定性直写本会话转录（不耗 token 复述）；可选参数=模型名过滤",
        template:
          "兜底路径（正常时应由插件 command.execute.before 直接写入优惠摘要）：调用 tokenplan_discounts 工具，把输出原样整理给我，不要额外发挥。$ARGUMENTS",
      };
    },
    // R1：桌面（Electron 无 TUI 渲染层）命令通道——拦截 tokenplan，重写 parts 为
    // ignored 全表 + synthetic 极简指令（机制依据桌面 asar 实证，见 handleTokenplanCommand 注释）
    "command.execute.before": handleTokenplanCommand,
    tool: {
      tokenplan_discounts: toolDef(""),
      bailian_discounts: toolDef("(已并入 tokenplan_discounts) "),
    },
  };
};

export default { id: PKG_ID, server: plugin };
// 命名导出仅为可测试性；宿主装载契约是 default 的 { id, server } 模块形态。
export const AliBabaTokenPlanPlugin = plugin;
/** test.mjs 零宿主回归锚点（M1 argv 形态 / M2 同源校验 / m6 toast 竞态序）。
 * 只读/受控注入引用，不改变任何运行时行为。 */
export const __testing = {
  blSpawnPlan,
  isSameOrigin,
  maybeToast,
  lastActive,
  getStatus: currentStatus,
  setClient: (c: any) => { client = c; },
  // R1/R2 回归锚点：命令拦截重写 + 紧凑摘要渲染
  handleTokenplanCommand,
  renderDesktopSummary,
};
