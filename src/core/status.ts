// buildStatus —— 纯函数（03-D1：`buildStatus(catalog, now)`），输出即 status.json payload。

import type { CatalogSource, DiscountEntry, ModelEntry, OfferOrigin, OfferRule, OfferUnit, StatusFile, WindowView } from "./types";
import { CREDITS_PER_YUAN, TOKEN_PLAN_TEXT_MODELS, BAILIAN_WINDOW_RULES, BAILIAN_SNAPSHOT_AT } from "./bailian-snapshot";
import { qoderSnapshotOffers, QODER_SNAPSHOT_DATE, QODER_INSALE_FACTORS } from "./qoder-snapshot";
import { catalogToOffers, mergeOffers, isCrossVerified } from "./merge";
import { windowState, fmtCountdown } from "./rules";
import { fmtFactor } from "./text";
import { isProviderMatchMode, type ProviderMatchMode } from "./provider";

export const WRITTEN_BY = "@te-river/opencode-alibabatokenplan/server@0.1.3";
export const STALE_AFTER_SEC = 600;

export interface CatalogInput {
  source: CatalogSource; // live | cli | snapshot
  models: ModelEntry[];
  fetchedAt?: string;
  error?: string;
}

export interface QuotaInput {
  available: boolean;
  checkedAt?: string;
  data?: unknown;
  hint?: string;
}

const CATALOG_ORIGIN: Record<CatalogSource, OfferOrigin> = {
  live: "bailian-live",
  cli: "bailian-cli",
  snapshot: "bailian-snapshot",
};

/** m5：id 保留 HHMM（去冒号），同小时不同分钟不再碰撞；offpeak 主窗沿用契约 §2 命名。 */
export function windowId(start: string, end: string): string {
  if (start === "22:00" && end === "08:00") return "offpeak-22-08"; // 契约 §2 示例命名
  return `win-${start.replace(":", "")}-${end.replace(":", "")}`;
}

/** 全部 OfferRule：Qoder 快照 ∪ 百炼文档窗口规则 ∪ 目录派生（合并去重+排序）。 */
export function buildOffers(catalog: CatalogInput): OfferRule[] {
  const origin = CATALOG_ORIGIN[catalog.source] ?? "bailian-snapshot";
  // m9：BAILIAN_WINDOW_RULES 是文档快照常量，来源恒标 bailian-snapshot——不随目录源
  // （live/cli）抬升 originRank/双源判定；与目录同键行仍由 mergeOffers 做 origins 并集。
  const legacy: OfferRule[] = BAILIAN_WINDOW_RULES.map((r) => ({
    id: r.id,
    kind: "time-window" as const,
    label: r.label,
    models: [...r.models],
    unit: "cny-price" as const,
    factor: r.factor,
    window: { start: r.start, end: r.end, tz: "Asia/Shanghai" },
    note: r.source,
    links: [],
    origins: ["bailian-snapshot" as const],
    snapshotDate: BAILIAN_SNAPSHOT_AT,
  }));
  return mergeOffers([...qoderSnapshotOffers(), ...legacy, ...catalogToOffers(catalog.models, origin, catalog.fetchedAt?.slice(0, 10))]);
}

function buildWindows(offers: OfferRule[], now: Date): WindowView[] {
  const byWindow = new Map<string, { start: string; end: string; tz: string; rules: OfferRule[] }>();
  for (const r of offers) {
    if (r.kind !== "time-window" || !r.window) continue;
    const key = `${r.window.start}-${r.window.end}@${r.window.tz}`;
    let g = byWindow.get(key);
    if (!g) { g = { ...r.window, rules: [] }; byWindow.set(key, g); }
    g.rules.push(r);
  }
  const out: WindowView[] = [];
  for (const g of byWindow.values()) {
    const w = windowState(g, now);
    const models: WindowView["models"] = [];
    for (const r of g.rules) {
      const cross = isCrossVerified(r);
      for (const m of r.models) {
        models.push({
          model: m,
          regular: fmtFactor(r.baseFactor),
          effective: fmtFactor(r.factor),
          badge: r.label + (cross ? " · 双源印证" : ""),
          origins: r.origins,
          links: r.links,
        });
      }
    }
    models.sort((a, b) => {
      const fa = parseFloat(a.effective ?? "1"), fb = parseFloat(b.effective ?? "1");
      if (fa !== fb) return fa - fb; // 价低先（D2c）
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
      models,
    });
  }
  // offpeak 主窗排前
  out.sort((a, b) => Number(b.id.startsWith("offpeak")) - Number(a.id.startsWith("offpeak")) || a.start.localeCompare(b.start));
  return out;
}

function buildDiscounts(offers: OfferRule[]): DiscountEntry[] {
  const byModel = new Map<string, OfferRule[]>();
  for (const r of offers) {
    if (r.kind === "free-calls" || r.kind === "policy") continue;
    for (const m of r.models) {
      const arr = byModel.get(m) ?? [];
      arr.push(r);
      byModel.set(m, arr);
    }
  }
  const out: DiscountEntry[] = [];
  for (const [model, applies] of byModel) {
    // m3：按 unit 分桶各取数值最小——credits-factor 与 cny-price 跨单位比大小无意义
    const bestFactors: Partial<Record<OfferUnit, number>> = {};
    for (const r of applies) {
      if (r.factor === undefined) continue;
      const cur = bestFactors[r.unit];
      if (cur === undefined || r.factor < cur) bestFactors[r.unit] = r.factor;
    }
    out.push({
      model,
      applies,
      ...(Object.keys(bestFactors).length ? { bestFactors } : {}),
    });
  }
  // 与 offers 合并序一致：价低先（取各 unit 桶最小值中的最小作为展示序）、系列序（qwen→deepseek/glm→其他）沿用旧排序精神
  const lowest = (d: DiscountEntry) => {
    const vs = Object.values(d.bestFactors ?? {});
    return vs.length ? Math.min(...vs) : 1;
  };
  const seriesOrder = (n: string) => (/^qwen/.test(n) ? 0 : /^(deepseek|glm|kimi|minimax)/.test(n) ? 1 : 2);
  out.sort((a, b) => {
    const fa = lowest(a), fb = lowest(b);
    if (fa !== fb) return fa - fb;
    const sd = seriesOrder(a.model) - seriesOrder(b.model);
    if (sd) return sd;
    return a.model.localeCompare(b.model);
  });
  return out;
}

function pickPrice(prices: ModelEntry["prices"], type: string, band?: string) {
  return prices.find((p) => p.type === type && (band ? p.band === band : !p.band || p.band === "standard"));
}

function creditsPerM(price: number): string {
  const v = price * CREDITS_PER_YUAN;
  return Number.isInteger(v) ? v.toLocaleString("en-US") : String(Number(v.toFixed(1)));
}

function buildTextModels(models: ModelEntry[], windows: WindowView[], now: Date): StatusFile["textModels"] {
  return TOKEN_PLAN_TEXT_MODELS.map((name) => {
    const m = models.find((x) => x.model === name) || models.find((x) => x.family === name);
    let badge: StatusFile["textModels"][number]["badge"];
    for (const w of windows) {
      if (w.models.some((x) => x.model === name)) {
        const ws = windowState(w, now);
        badge = {
          label: w.label + (w.models.find((x) => x.model === name)?.badge?.includes("双源") ? " · 双源印证" : ""),
          countdown: ws.active
            ? `${fmtCountdown(ws.minutesToNextBoundary)}后结束（${w.end}）`
            : `${fmtCountdown(ws.minutesToNextBoundary)}后开始（${w.start}）`,
        };
        break;
      }
    }
    const insale = QODER_INSALE_FACTORS[name];
    if (!m) {
      return { model: name, input: "—", cache: "—", output: "—", ...(insale ? { creditsFactor: fmtFactor(insale.factor) } : {}), ...(badge ? { badge } : {}) };
    }
    const peakIn = pickPrice(m.prices, "input_token", "peak");
    const offIn = pickPrice(m.prices, "input_token", "offpeak");
    const stdIn = pickPrice(m.prices, "input_token");
    const stdOut = pickPrice(m.prices, "output_token", "peak") || pickPrice(m.prices, "output_token");
    const offOut = pickPrice(m.prices, "output_token", "offpeak");
    const stdCache = pickPrice(m.prices, "input_token_cache", "peak") || pickPrice(m.prices, "input_token_cache") || pickPrice(m.prices, "input_token_cache_read");
    const offCache = pickPrice(m.prices, "input_token_cache", "offpeak") || pickPrice(m.prices, "input_token_cache_read", "offpeak");
    const dual = !!(peakIn && offIn);
    const pair = (a?: { price: number }, b?: { price: number }) => a ? (b ? `${creditsPerM(a.price)} / ${creditsPerM(b.price)}` : creditsPerM(a.price)) : "—";
    return {
      model: name,
      input: dual ? pair(peakIn, offIn) : pair(stdIn),
      cache: dual ? pair(stdCache, offCache) : pair(stdCache),
      output: dual ? pair(stdOut, offOut) : pair(stdOut),
      ...(dual ? { bands: "峰/谷" as const } : {}),
      ...(insale ? { creditsFactor: fmtFactor(insale.factor) } : {}),
      ...(badge ? { badge } : {}),
    };
  });
}

function buildNotices(offers: OfferRule[], now: Date): StatusFile["notices"] {
  return offers
    .filter((r) => r.kind === "free-calls" || r.kind === "policy")
    .map((r) => ({
      kind: r.kind as "free-calls" | "policy",
      text: `${r.label}${r.note ? " — " + r.note : ""}`,
      source: r.origins.includes("qoder-snapshot") ? `Qoder 快照 ${r.snapshotDate ?? QODER_SNAPSHOT_DATE}` : (r.origins[0] ?? "unknown"),
      expired: r.expiry ? new Date(r.expiry).getTime() < now.getTime() : undefined,
    }));
}

/** 纯函数：目录 + now → status.json payload（schema 见契约 §2）。 */
export function buildStatus(catalog: CatalogInput, now: Date = new Date(), quota?: QuotaInput): StatusFile {
  const offers = buildOffers(catalog);
  const windows = buildWindows(offers, now);
  return {
    schemaVersion: 1,
    writtenBy: WRITTEN_BY,
    updatedAt: now.toISOString(),
    staleAfterSec: STALE_AFTER_SEC,
    timezone: "Asia/Shanghai",
    creditsPerYuan: CREDITS_PER_YUAN,
    creditsRateNote: "据百炼计费示例换算，非官方汇率",
    sources: {
      catalog: CATALOG_ORIGIN[catalog.source] ?? "bailian-snapshot",
      qoderSnapshot: QODER_SNAPSHOT_DATE,
      ...(catalog.error ? { error: catalog.error } : {}),
    },
    windows,
    offers,
    discounts: buildDiscounts(offers),
    textModels: buildTextModels(catalog.models, windows, now),
    quota: quota ?? { available: false, hint: "实时额度需: bl auth login --console --console-site domestic" },
    notices: buildNotices(offers, now),
  };
}

/** status.json 陈旧判定（契约 §2：TUI 侧复用）。 */
export function isStale(st: StatusFile, now = new Date()): boolean {
  const t = new Date(st.updatedAt).getTime();
  if (Number.isNaN(t)) return true;
  return now.getTime() - t > st.staleAfterSec * 1000;
}

// ───────────────────────── 运行时契约（03-D3 / 契约 §2 §4） ─────────────────────────
// 路径、配置与 status.json 原子读写。放本文件（而非新增 core 模块）以贴合 03 包结构树；
// 只用 node 内建，仍满足「core 不 import opencode，可 node 直测」。

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

export const STATUS_SIZE_CAP = 256 * 1024; // 目标 ≤256KB（超限 server 截断）

export function stateDir(): string {
  return process.env.ATP_STATE_DIR || path.join(os.homedir(), ".cache", "opencode", "alibabatokenplan");
}
export function statusFilePath(): string {
  return path.join(stateDir(), "status.json");
}
export function cacheFilePath(): string {
  return path.join(stateDir(), "cache.json");
}
export function portFilePath(): string {
  return path.join(stateDir(), ".port");
}
/** 旧缓存路径（一次性迁移读源）。 */
export function legacyCacheFile(): string {
  return path.join(os.homedir(), ".cache", "opencode", "bailian-discount-cache.json");
}
export function legacyPortFile(): string {
  return path.join(os.homedir(), ".cache", "opencode", "bailian-discount-panel.port");
}
export function configFilePath(): string {
  return process.env.ATP_CONFIG_DIR
    ? path.join(process.env.ATP_CONFIG_DIR, "config.jsonc")
    : path.join(os.homedir(), ".config", "opencode", "alibabatokenplan", "config.jsonc");
}

/** 最小 JSONC 解析（扫描器实现，字符串内的 // 与 , 不受影响）。 */
export function parseJsonc(text: string): unknown {
  // pass 1: 去注释（跟踪字符串态）
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
    if (c === '"') { inStr = true; out += c; i++; continue; }
    if (c === "/" && n === "/") { while (i < text.length && text[i] !== "\n") i++; continue; }
    if (c === "/" && n === "*") {
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    out += c;
    i++;
  }
  // pass 2: 去尾逗号（扫描逗号后仅空白即为 }/] 的情况，同样跟踪字符串态）
  let res = "";
  inStr = false; esc = false; i = 0;
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
    if (c === '"') { inStr = true; res += c; i++; continue; }
    if (c === ",") {
      let j = i + 1;
      while (j < out.length && /\s/.test(out[j])) j++;
      if (out[j] === "}" || out[j] === "]") { i++; continue; } // 丢弃尾逗号
    }
    res += c;
    i++;
  }
  return JSON.parse(res);
}

export interface AtpConfig {
  webpanel: { enabled: boolean; port: number };
  sidebar: { order: number; showNonTokenPlan: boolean };
  toast: boolean;
  refresh: { catalogMin: number; quotaMin: number };
  /** R2：TUI 侧栏/home 门控模式。family=阿里系全家族（默认，alibaba-cn 会话也显示）；strict=0.1.0 的 token-plan 专属正则。 */
  providerMatch: ProviderMatchMode;
  /** C1（0.1.3 去中断化）：桌面版任何新消息都会中断进行中的回合（宿主固有行为），
   *  /tokenplan 转录注入对开发流有破坏性 → 默认 false：config hook 不注入命令，斜杠菜单彻底消失。 */
  slash: boolean;
  /** C2：server 启动 5s 后的一次性摘要 toast（受 toast 总开关叠加控制）。默认 true。 */
  toastOnBoot: boolean;
  /** C1（0.1.3 仪表盘优先）：true 时 bootProcess 探测本机 msedge/edge 以 --app=<url>
   *  无边框小窗打开仪表盘；探测失败/启动失败静默，绝不回退默认浏览器裸开。默认 false。 */
  dashboard: { autoOpen: boolean };
}

export const DEFAULT_CONFIG: AtpConfig = {
  // 0.1.3：仪表盘是主界面（桌面实证：无 TUI 渲染层，web 面板是唯一持久信息面）→ 默认开
  webpanel: { enabled: true, port: 7777 },
  sidebar: { order: 160, showNonTokenPlan: false },
  toast: true,
  refresh: { catalogMin: 10, quotaMin: 5 },
  providerMatch: "family",
  slash: false,
  toastOnBoot: true,
  dashboard: { autoOpen: false },
};

export function loadConfig(): AtpConfig {
  const d = structuredClone(DEFAULT_CONFIG);
  try {
    const raw = parseJsonc(fs.readFileSync(configFilePath(), "utf8")) as any;
    if (raw && typeof raw === "object") {
      if (raw.webpanel?.enabled !== undefined) d.webpanel.enabled = !!raw.webpanel.enabled;
      // Nit: 端口须落在可绑定的非特权区间 [1024,65535]，否则回退默认（避免 bind EACCES/无效端口）
      if (Number.isInteger(raw.webpanel?.port) && raw.webpanel.port >= 1024 && raw.webpanel.port <= 65535) d.webpanel.port = raw.webpanel.port;
      if (Number.isInteger(raw.sidebar?.order)) d.sidebar.order = raw.sidebar.order;
      if (raw.sidebar?.showNonTokenPlan !== undefined) d.sidebar.showNonTokenPlan = !!raw.sidebar.showNonTokenPlan;
      if (raw.toast !== undefined) d.toast = !!raw.toast;
      if (Number.isInteger(raw.refresh?.catalogMin) && raw.refresh.catalogMin > 0) d.refresh.catalogMin = raw.refresh.catalogMin;
      if (Number.isInteger(raw.refresh?.quotaMin) && raw.refresh.quotaMin > 0) d.refresh.quotaMin = raw.refresh.quotaMin;
      if (isProviderMatchMode(raw.providerMatch)) d.providerMatch = raw.providerMatch; // 非法值→保持默认 family
      if (raw.slash !== undefined) d.slash = !!raw.slash;
      if (raw.toastOnBoot !== undefined) d.toastOnBoot = !!raw.toastOnBoot;
      if (raw.dashboard?.autoOpen !== undefined) d.dashboard.autoOpen = !!raw.dashboard.autoOpen;
    }
  } catch {
    /* 缺失/坏 JSON = 全默认（契约 §4） */
  }
  return d;
}

/** 原子写：status.json.tmp → renameSync（同卷）；≤256KB，超限截断大数组段；写失败静默。 */
export function writeStatusAtomic(st: StatusFile): boolean {
  try {
    const dir = stateDir();
    fs.mkdirSync(dir, { recursive: true });
    let payload = JSON.stringify(st);
    if (Buffer.byteLength(payload, "utf8") > STATUS_SIZE_CAP) {
      const shrunk: StatusFile = { ...st, textModels: st.textModels.slice(0, 20), discounts: st.discounts.slice(0, 60), offers: st.offers.slice(0, 60), windows: st.windows.slice(0, 8) };
      payload = JSON.stringify(shrunk);
      if (Buffer.byteLength(payload, "utf8") > STATUS_SIZE_CAP) payload = JSON.stringify({ ...shrunk, textModels: [], discounts: [] });
    }
    const tmp = path.join(dir, "status.json.tmp");
    fs.writeFileSync(tmp, payload);
    fs.renameSync(tmp, path.join(dir, "status.json"));
    return true;
  } catch {
    return false; // 静默重试下轮（03-D3）
  }
}

export type StatusRead =
  | { kind: "live"; status: StatusFile }
  | { kind: "missing" }
  | { kind: "stale"; status: StatusFile }
  | { kind: "corrupt"; error: string };

/** TUI 只读侧：ENOENT/坏 JSON/schemaVersion≠1/超 staleAfterSec → 非 live。 */
export function readStatusFile(now = new Date()): StatusRead {
  let text: string;
  try {
    text = fs.readFileSync(statusFilePath(), "utf8");
  } catch {
    return { kind: "missing" };
  }
  try {
    const j = JSON.parse(text) as StatusFile;
    if (!j || j.schemaVersion !== 1 || !Array.isArray(j.windows)) return { kind: "corrupt", error: "schema" };
    return isStale(j, now) ? { kind: "stale", status: j } : { kind: "live", status: j };
  } catch (e: any) {
    return { kind: "corrupt", error: String(e?.message || e) };
  }
}
