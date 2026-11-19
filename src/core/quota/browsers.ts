// 浏览器族探测 + Cookie 采集（r4 Δ1/Δ2/Δ4/Δ5）。
// 边界（r4 追加）：Chromium 只用插件自有 profile（browsers/<id>/profile），真实 profile 一律不枚举、不 spawn；
// 真实登录态只能经 Firefox 的明文 cookies.sqlite 只读副本获取。
// 安全边界：本模块是唯一产出 Cookie 字面量的地方，导出签名含 cookie 串，但只允许 credentials.ts import。
// 进程卫生（不变量）：只杀自己 spawn 的 pid；child.exitCode !== null 表示浏览器把参数转交给既有实例后父进程退出
// → 我们没有存活的子进程，只 abort，绝不 kill（禁用任何按镜像名的杀法）。

import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import * as fs from "node:fs";
import * as net from "node:net";
import * as os from "node:os";
import * as path from "node:path";
import type { AdapterId, BrowserCandidate, BrowserFamily, BrowserId, DetectedAdapters } from "./types";
import { resolveDefaultBrowser, type DefaultBrowserResolver } from "./default-browser";
import { PAGE_URL } from "./request";

const CDP_READY_MS = 6000; // Δ4：spawn 后 6s 内 /json/version 必就绪，否则转自有 profile
const POLL_MS = 300;

interface BrowserDef {
  id: BrowserId;
  label: string;
  family: BrowserFamily;
  exe: string[];
  firefoxProfiles?: string[]; // 仅 Firefox：真实 profile 根目录（只读 sqlite，绝不 spawn）
}

function firstExisting(paths: string[]): string | null {
  for (const p of paths) {
    try {
      if (p && fs.existsSync(p)) return p;
    } catch {
      /* 单条路径不可读不算候选失败 */
    }
  }
  return null;
}

function localAppData(): string {
  return process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local");
}
function roamingAppData(): string {
  return process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming");
}

// ───────────────────────── 状态根（r5 Δ1：与 opencode 宿主命名空间解耦） ─────────────────────────
// 旧根在 <LOCALAPPDATA>\opencode\ 之内，宿主升级/清理有权整目录处理 —— 授权因此被重置。
// 可变状态（credential.json / settings.json / browsers）一律落在宿主目录之外；旧根只读、只用于一次性迁移。

function computeStateRoot(): string {
  const override = process.env.ATP_STATE_ROOT?.trim();
  if (override) return path.resolve(override);
  return process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, "alibabatokenplan")
    : path.join(os.homedir(), ".config", "alibabatokenplan");
}

/** r5 之前的状态根（宿主命名空间）：只读回退与迁移来源。 */
export function legacyStateRoot(): string {
  return process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, "opencode", "alibabatokenplan")
    : path.join(os.homedir(), ".config", "opencode", "alibabatokenplan");
}

let migrated = false;

/** 同卷 rename；跨卷/被占用则复制+删除。目标已存在 = 已迁移，绝不覆盖。 */
function moveEntry(src: string, dst: string, recursive: boolean): void {
  if (!fs.existsSync(src) || fs.existsSync(dst)) return;
  try {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.renameSync(src, dst);
  } catch {
    try {
      fs.cpSync(src, dst, { recursive });
      fs.rmSync(src, { recursive, force: true });
    } catch {
      /* 仍失败（被占用/无权限）：保留旧文件，读路径按 新 → 旧 回退 */
    }
  }
}

/** 一次性迁移；失败不抛、进程内只跑一次（幂等）。 */
function ensureMigrated(): void {
  if (migrated) return;
  migrated = true;
  const next = computeStateRoot();
  const prev = legacyStateRoot();
  if (path.resolve(next) === path.resolve(prev)) return; // ATP_STATE_ROOT 指回旧根：无需搬
  moveEntry(path.join(prev, "credential.json"), path.join(next, "credential.json"), false);
  moveEntry(path.join(prev, "settings.json"), path.join(next, "settings.json"), false);
  moveEntry(path.join(prev, "browsers"), path.join(next, "browsers"), true);
}

/** 新状态根：首次访问即完成一次性迁移。 */
export function stateRoot(): string {
  ensureMigrated();
  return computeStateRoot();
}

/** Win 候选表（Δ2）：仅枚举存在性，顺序由 PLATFORM_ORDER 决定。 */
function winDefs(): BrowserDef[] {
  const pf = process.env.ProgramFiles ?? "C:\\Program Files";
  const pf86 = process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)";
  const la = localAppData();
  const ra = roamingAppData();
  return [
    {
      id: "edge",
      label: "Microsoft Edge",
      family: "chromium",
      exe: [
        path.join(pf86, "Microsoft", "Edge", "Application", "msedge.exe"),
        path.join(pf, "Microsoft", "Edge", "Application", "msedge.exe"),
        path.join(la, "Microsoft", "Edge", "Application", "msedge.exe"),
      ],
    },
    {
      id: "chrome",
      label: "Google Chrome",
      family: "chromium",
      exe: [
        path.join(pf, "Google", "Chrome", "Application", "chrome.exe"),
        path.join(pf86, "Google", "Chrome", "Application", "chrome.exe"),
        path.join(la, "Google", "Chrome", "Application", "chrome.exe"),
      ],
    },
    {
      id: "brave",
      label: "Brave",
      family: "chromium",
      exe: [
        path.join(pf, "BraveSoftware", "Brave-Browser", "Application", "brave.exe"),
        path.join(la, "BraveSoftware", "Brave-Browser", "Application", "brave.exe"),
      ],
    },
    {
      id: "chromium",
      label: "Chromium",
      family: "chromium",
      exe: [path.join(la, "Chromium", "Application", "chrome.exe"), path.join(pf, "Chromium", "Application", "chrome.exe")],
    },
    {
      id: "vivaldi",
      label: "Vivaldi",
      family: "chromium",
      exe: [path.join(la, "Vivaldi", "Application", "vivaldi.exe"), path.join(pf, "Vivaldi", "Application", "vivaldi.exe")],
    },
    {
      id: "opera-gx",
      label: "Opera GX",
      family: "chromium",
      exe: [path.join(la, "Programs", "Opera GX", "opera.exe")],
    },
    {
      id: "opera",
      label: "Opera",
      family: "chromium",
      exe: [path.join(la, "Programs", "Opera", "opera.exe")],
    },
    {
      id: "firefox",
      label: "Firefox",
      family: "firefox",
      exe: [path.join(pf, "Mozilla Firefox", "firefox.exe"), path.join(pf86, "Mozilla Firefox", "firefox.exe")],
      firefoxProfiles: [path.join(ra, "Mozilla", "Firefox", "Profiles")],
    },
  ];
}

function nixDefs(platform: "darwin" | "linux"): BrowserDef[] {
  const home = os.homedir();
  if (platform === "darwin") {
    const app = (name: string) => `/Applications/${name}.app/Contents/MacOS/${name}`;
    return [
      { id: "chrome", label: "Google Chrome", family: "chromium", exe: [app("Google Chrome")] },
      { id: "edge", label: "Microsoft Edge", family: "chromium", exe: [app("Microsoft Edge")] },
      { id: "brave", label: "Brave", family: "chromium", exe: [app("Brave Browser")] },
      { id: "chromium", label: "Chromium", family: "chromium", exe: [app("Chromium")] },
      { id: "vivaldi", label: "Vivaldi", family: "chromium", exe: [app("Vivaldi")] },
      { id: "opera", label: "Opera", family: "chromium", exe: [app("Opera")] },
      { id: "firefox", label: "Firefox", family: "firefox", exe: [app("Firefox")], firefoxProfiles: [path.join(home, "Library/Application Support/Firefox/Profiles")] },
    ];
  }
  const bin = (cmd: string) => [`/usr/bin/${cmd}`, `/usr/local/bin/${cmd}`, `/snap/bin/${cmd}`];
  return [
    { id: "chromium", label: "Chromium", family: "chromium", exe: [...bin("chromium"), ...bin("chromium-browser")] },
    { id: "chrome", label: "Google Chrome", family: "chromium", exe: [...bin("google-chrome"), ...bin("google-chrome-stable")] },
    { id: "brave", label: "Brave", family: "chromium", exe: [...bin("brave-browser")] },
    { id: "edge", label: "Microsoft Edge", family: "chromium", exe: [...bin("microsoft-edge"), ...bin("microsoft-edge-stable")] },
    { id: "vivaldi", label: "Vivaldi", family: "chromium", exe: [...bin("vivaldi")] },
    { id: "opera", label: "Opera", family: "chromium", exe: [...bin("opera")] },
    { id: "firefox", label: "Firefox", family: "firefox", exe: [...bin("firefox")], firefoxProfiles: [path.join(home, ".mozilla/firefox")] },
  ];
}

/** Δ2 默认尝试顺序（按平台；detect() 输出顺序即此顺序）。 */
function browserDefs(): BrowserDef[] {
  if (process.platform === "win32") return winDefs();
  const table = process.platform === "darwin" ? nixDefs("darwin") : nixDefs("linux");
  const order: BrowserId[] = ["chromium", "chrome", "brave", "edge", "vivaldi", "opera", "firefox"];
  const byId = new Map(table.map((d) => [d.id, d]));
  return order.map((id) => byId.get(id)).filter((d): d is BrowserDef => !!d);
}

/** Firefox：取第一个含 cookies.sqlite 的 profile 目录（没有则退回第一个目录）。 */
function firstFirefoxProfile(dirs: string[]): string | null {
  for (const root of dirs) {
    let entries: string[];
    try {
      entries = fs.readdirSync(root);
    } catch {
      continue;
    }
    const withCookies = entries.map((e) => path.join(root, e)).find((p) => {
      try {
        return fs.statSync(p).isDirectory() && fs.existsSync(path.join(p, "cookies.sqlite"));
      } catch {
        return false;
      }
    });
    if (withCookies) return withCookies;
    const anyDir = entries.map((e) => path.join(root, e)).find((p) => {
      try {
        return fs.statSync(p).isDirectory();
      } catch {
        return false;
      }
    });
    if (anyDir) return anyDir;
  }
  return null;
}

// ───────────────────────── 运行时能力探针 ─────────────────────────

let sqliteCapability: boolean | null = null;

function sqliteSpecifier(host: "bun" | "node"): string {
  // 用拼接构造说明符：打包器不会静态解析，宿主没装该内置时只会抛，不会在构建期失败。
  return [host, "sqlite"].join(":");
}

async function openSqlite(file: string): Promise<any | null> {
  try {
    const bun: any = await import(sqliteSpecifier("bun"));
    if (bun?.Database) return new bun.Database(file, { readonly: true });
  } catch {
    /* 非 Bun 宿主 */
  }
  try {
    const node: any = await import(sqliteSpecifier("node"));
    if (node?.DatabaseSync) return new node.DatabaseSync(file, { readOnly: true });
  } catch {
    /* 无 node:sqlite（<22.5） */
  }
  return null;
}

/** bun:sqlite / node:sqlite 至少一个可用（Δ5：都没有 → Firefox 适配器不进 adapters，不算失败）。 */
export async function canUseSqlite(): Promise<boolean> {
  if (sqliteCapability !== null) return sqliteCapability;
  const db = await openSqlite(":memory:");
  if (db) {
    try {
      db.close?.();
    } catch {
      /* 关闭失败不影响能力判定 */
    }
    sqliteCapability = true;
  } else {
    sqliteCapability = false;
  }
  return sqliteCapability;
}

// ───────────────────────── detect()（纯 fs，<50ms，进程内缓存） ─────────────────────────

let cached: DetectedAdapters | null = null;

export function blConfigPath(): string {
  return path.join(os.homedir(), ".bailian", "config.json");
}

/** 用户固定首选（Δ3 ②）：<状态根>\settings.json。 */
function settingsPath(): string {
  return path.join(stateRoot(), "settings.json");
}

function readSettings(): { browser?: string; adapter?: string } {
  for (const file of [settingsPath(), path.join(legacyStateRoot(), "settings.json")]) {
    try {
      const raw = JSON.parse(fs.readFileSync(file, "utf8")) as any;
      return { browser: typeof raw?.browser === "string" ? raw.browser : undefined, adapter: typeof raw?.adapter === "string" ? raw.adapter : undefined };
    } catch {
      /* 该位置缺失/坏 JSON：试下一个位置 */
    }
  }
  return {}; // 都不可用 = 全默认，绝不抛
}

const ADAPTER_IDS: AdapterId[] = ["cdp-own-profile", "firefox-sqlite", "manual-paste", "bl"];

function adapterForFamily(family: BrowserFamily): AdapterId {
  return family === "firefox" ? "firefox-sqlite" : "cdp-own-profile";
}

/** 首选：settings.adapter > settings.browser > 系统默认浏览器 > 第一条可行适配器（都不行就落到手动粘贴）。 */
function pickPreferred(adapters: AdapterId[], browsers: BrowserCandidate[], def: BrowserId | null): AdapterId | null {
  const s = readSettings();
  if (s.adapter && (ADAPTER_IDS as string[]).includes(s.adapter) && adapters.includes(s.adapter as AdapterId)) return s.adapter as AdapterId;
  const wanted = browsers.find((b) => b.id === s.browser) ?? browsers.find((b) => b.id === def);
  if (wanted) {
    const a = adapterForFamily(wanted.family);
    if (adapters.includes(a)) return a;
  }
  return adapters[0] ?? null;
}

/** 默认浏览器探测失败/抛错 = 无偏好：静默退回平台顺序，绝不报错。 */
function safeDefault(resolve: DefaultBrowserResolver): BrowserId | null {
  try {
    return resolve();
  } catch {
    return null;
  }
}

/** Δ3：只做 existsSync/readdirSync，不 spawn、不建连；结果按进程缓存，refresh=true 重扫。 */
export async function detect(refresh = false, resolveDefault: DefaultBrowserResolver = resolveDefaultBrowser): Promise<DetectedAdapters> {
  if (!refresh && cached) return cached;
  const found: BrowserCandidate[] = [];
  for (const def of browserDefs()) {
    const exe = firstExisting(def.exe);
    if (!exe) continue;
    const userDataDir = def.firefoxProfiles ? firstFirefoxProfile(def.firefoxProfiles) : null;
    found.push({ id: def.id, label: def.label, exe, userDataDir, family: def.family });
  }
  // 系统默认浏览器置顶（settings.browser/adapter 只影响 preferred，不改列表顺序）
  const def = safeDefault(resolveDefault);
  const browsers = def ? [...found.filter((b) => b.id === def), ...found.filter((b) => b.id !== def)] : found;
  const canSqlite = await canUseSqlite();
  const hasWebSocket = typeof (globalThis as any).WebSocket === "function";
  const adapters: AdapterId[] = [];
  if (hasWebSocket && browsers.some((b) => b.family === "chromium")) adapters.push("cdp-own-profile");
  if (canSqlite && browsers.some((b) => b.family === "firefox" && b.userDataDir)) adapters.push("firefox-sqlite");
  adapters.push("manual-paste"); // 永不死路
  try {
    if (fs.existsSync(blConfigPath())) adapters.push("bl");
  } catch {
    /* 读不到 = 无 bl */
  }
  const preferred = pickPreferred(adapters, browsers, def);
  cached = { browsers, adapters: preferred ? [preferred, ...adapters.filter((a) => a !== preferred)] : adapters, preferred, canUseSqlite: canSqlite };
  return cached;
}

// ───────────────────────── Chromium：起调试端口 + 读 cookie ─────────────────────────

export interface ChromiumHandle {
  browserId: BrowserId;
  pid: number;
  port: number;
  child: ChildProcess;
}

export function sleepOrAbort(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(new Error("aborted"));
    };
    if (signal.aborted) {
      clearTimeout(t);
      reject(new Error("aborted"));
      return;
    }
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      srv.close(() => (port ? resolve(port) : reject(new Error("no free port"))));
    });
  });
}

/** 插件自有 profile 根目录：**只**放本插件的实例；forgetCredential 清理时也只删这里。 */
export function ownProfilesRoot(): string {
  return path.join(stateRoot(), "browsers");
}

/** 自有 profile 目录（Δ4）：本插件独占，既是隔离手段也是"这个实例是我们的"的凭据。 */
function ownProfileDir(browserId: BrowserId): string {
  return path.join(ownProfilesRoot(), browserId, "profile");
}

async function versionEndpoint(port: number, timeoutMs = 1000): Promise<any | null> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    return (await res.json()) as any;
  } catch {
    return null;
  }
}

/** Δ4：/json/version 的调试端口必须等于我们的端口，否则是他人实例 → 放弃。 */
async function cdpReady(port: number): Promise<boolean> {
  const v = await versionEndpoint(port);
  const ws = typeof v?.webSocketDebuggerUrl === "string" ? v.webSocketDebuggerUrl : "";
  if (!ws) return false;
  try {
    return new URL(ws).port === String(port);
  } catch {
    return false;
  }
}

/** 起一个带 --remote-debugging-port 的自有 profile 实例；6s 内不就绪 → 清理自己的进程并抛错（调用方可换下一条路）。 */
export async function launchChromium(browser: BrowserCandidate, signal: AbortSignal): Promise<ChromiumHandle> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const port = await freePort();
    const profile = ownProfileDir(browser.id);
    const child = spawn(
      browser.exe,
      [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check", PAGE_URL],
      { detached: false, stdio: "ignore", windowsHide: false },
    );
    const handle: ChromiumHandle = { browserId: browser.id, pid: child.pid ?? -1, port, child };
    const deadline = Date.now() + CDP_READY_MS;
    while (Date.now() < deadline) {
      if (child.exitCode !== null) break; // 转交给既有实例后父进程退出 → 我们没有自己的进程
      if (await cdpReady(port)) return handle;
      try {
        await sleepOrAbort(POLL_MS, signal);
      } catch {
        await closeChromium(handle); // 用户取消（Esc/关窗/超时）
        throw new Error("aborted");
      }
    }
    await closeChromium(handle);
    if (signal.aborted) throw new Error("aborted");
  }
  throw new Error("cdp-launch-failed");
}

function cdpCaller(wsUrl: string, signal: AbortSignal, fn: (call: (method: string, params?: unknown) => Promise<any>) => Promise<void>): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const WS = (globalThis as any).WebSocket;
    if (typeof WS !== "function") {
      reject(new Error("WebSocket unavailable"));
      return;
    }
    const ws = new WS(wsUrl);
    const pending = new Map<number, (msg: any) => void>();
    let id = 0;
    let settled = false;
    const finish = (err?: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      try {
        ws.close();
      } catch {
        /* 已关闭 */
      }
      if (err) reject(err);
      else resolve();
    };
    const timer = setTimeout(() => finish(new Error("devtools timeout")), 15000);
    const onAbort = () => finish(new Error("aborted"));
    signal.addEventListener("abort", onAbort, { once: true });
    const call = (method: string, params?: unknown) =>
      new Promise<any>((res, rej) => {
        const msgId = ++id;
        pending.set(msgId, (msg) => (msg?.error ? rej(new Error(String(msg.error?.message ?? "cdp error"))) : res(msg?.result)));
        try {
          ws.send(JSON.stringify({ id: msgId, method, params }));
        } catch (e) {
          pending.delete(msgId);
          rej(e);
        }
      });
    ws.addEventListener("message", (ev: any) => {
      let msg: any;
      try {
        msg = JSON.parse(typeof ev.data === "string" ? ev.data : String(ev.data));
      } catch {
        return;
      }
      const cb = msg?.id != null ? pending.get(msg.id) : undefined;
      if (cb) {
        pending.delete(msg.id);
        cb(msg);
      }
    });
    ws.addEventListener("error", () => finish(new Error("devtools error")));
    ws.addEventListener("close", () => finish(new Error("devtools closed")));
    ws.addEventListener("open", () => {
      fn(call).then(() => finish()).catch(finish);
    });
  });
}

/** Δ6：收集 .aliyun.com / aliyun.com 全部 cookie，拼 Cookie 头；不猜身份票名字。 */
function buildCookieHeader(cookies: any[] | undefined): string | null {
  if (!Array.isArray(cookies)) return null;
  const picked = cookies
    .filter((c) => typeof c?.name === "string" && typeof c?.value === "string")
    .filter((c) => {
      // CDP 给 domain，Firefox 的 moz_cookies 给 host —— 两者同义
      const raw = typeof c?.domain === "string" ? c.domain : typeof c?.host === "string" ? c.host : "";
      const d = raw.replace(/^\./, "").toLowerCase();
      return d === "aliyun.com" || d.endsWith(".aliyun.com");
    });
  if (!picked.length) return null;
  return picked.map((c) => `${c.name}=${c.value}`).join("; ");
}

async function pageTarget(port: number): Promise<any | null> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(1500) });
    if (!res.ok) return null;
    const list = (await res.json()) as any[];
    if (!Array.isArray(list)) return null;
    return list.find((t) => t?.type === "page" && typeof t.url === "string" && t.url.includes("bailian.console.aliyun.com")) ?? null;
  } catch {
    return null;
  }
}

/** 需要新标签页时：新版 CDP 要求 PUT /json/new，405 则退回浏览器级 WS 的 Target.createTarget。 */
async function createPageTarget(port: number, signal: AbortSignal): Promise<any | null> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(PAGE_URL)}`, { method: "PUT", signal: AbortSignal.timeout(1500) });
    if (res.ok) return (await res.json()) as any;
  } catch {
    /* 落到 Target.createTarget */
  }
  const v = await versionEndpoint(port);
  const browserWs = typeof v?.webSocketDebuggerUrl === "string" ? v.webSocketDebuggerUrl : "";
  if (!browserWs) return null;
  let targetId: string | null = null;
  try {
    await cdpCaller(browserWs, signal, async (call) => {
      const r = await call("Target.createTarget", { url: PAGE_URL });
      targetId = typeof r?.targetId === "string" ? r.targetId : null;
    });
  } catch {
    return null;
  }
  return targetId ? { webSocketDebuggerUrl: `ws://127.0.0.1:${port}/devtools/page/${targetId}` } : null;
}

/** 读一次 cookie 罐（CDP Network.getCookies 含 HttpOnly）；拿不到 → null，由调用方继续轮询。 */
export async function readChromiumCookies(port: number, signal: AbortSignal): Promise<string | null> {
  const target = (await pageTarget(port)) ?? (await createPageTarget(port, signal));
  const wsUrl = typeof target?.webSocketDebuggerUrl === "string" ? target.webSocketDebuggerUrl : "";
  if (!wsUrl) return null;
  let cookies: any[] | undefined;
  try {
    await cdpCaller(wsUrl, signal, async (call) => {
      await call("Network.enable");
      const r = await call("Network.getCookies", { urls: ["https://bailian.console.aliyun.com/", "https://bailian-cs.console.aliyun.com/"] });
      cookies = r?.cookies;
    });
  } catch {
    return null;
  }
  return buildCookieHeader(cookies);
}

function waitExit(child: ChildProcess, ms: number): Promise<boolean> {
  if (child.exitCode !== null) return Promise.resolve(true);
  return new Promise<boolean>((resolve) => {
    const t = setTimeout(() => {
      child.removeListener("exit", onExit);
      resolve(child.exitCode !== null);
    }, ms);
    const onExit = () => {
      clearTimeout(t);
      resolve(true);
    };
    child.once("exit", onExit);
  });
}

/** 退出路径唯一入口：Browser.close → child.kill → taskkill/POSIX SIGKILL；只碰自己 spawn 的 pid。 */
export async function closeChromium(handle: ChromiumHandle | null): Promise<void> {
  if (!handle || handle.pid <= 0) return;
  const { child, pid, port } = handle;
  if (child.exitCode !== null) return; // fork 到既有实例：不是我们的进程，一个都不杀
  try {
    const v = await versionEndpoint(port);
    const ws = typeof v?.webSocketDebuggerUrl === "string" ? v.webSocketDebuggerUrl : "";
    if (ws) {
      await cdpCaller(ws, new AbortController().signal, async (call) => {
        await call("Browser.close");
      }).catch(() => undefined); // 浏览器常在回包前断连，握手错误不是失败
    }
  } catch {
    /* 温柔关闭失败 → 下面的强制路径 */
  }
  if (await waitExit(child, 2000)) return;
  try {
    child.kill();
  } catch {
    /* 已退出 */
  }
  if (await waitExit(child, 2000)) return;
  try {
    if (process.platform === "win32") spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
    else process.kill(pid, "SIGKILL");
  } catch {
    /* 进程已消失 */
  }
}

// ───────────────────────── Firefox：cookies.sqlite 只读副本 ─────────────────────────

/**
 * Δ5：复制 cookies.sqlite（连带 -wal/-shm）到临时目录 → 查询 → 立刻递归删除（finally，异常路径同样删）。
 * Firefox 磁盘上 cookie 值是明文（这是选用它的唯一理由），值只在内存里存活。
 */
export async function readFirefoxCookies(browser: BrowserCandidate): Promise<string | null> {
  const profile = browser.userDataDir;
  if (!profile) return null;
  const src = path.join(profile, "cookies.sqlite");
  let tmpDir = "";
  try {
    if (!fs.existsSync(src)) return null;
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "atp-cookie-"));
    for (const suffix of ["", "-wal", "-shm"]) {
      const from = src + suffix;
      if (fs.existsSync(from)) fs.copyFileSync(from, path.join(tmpDir, `cookies.sqlite${suffix}`));
    }
    const db = await openSqlite(path.join(tmpDir, "cookies.sqlite"));
    if (!db) return null;
    try {
      const stmt = typeof db.prepare === "function" ? db.prepare("SELECT host, name, value FROM moz_cookies WHERE host LIKE '%aliyun.com'") : db.query("SELECT host, name, value FROM moz_cookies WHERE host LIKE '%aliyun.com'");
      const rows = (stmt.all?.() ?? []) as any[];
      return buildCookieHeader(rows);
    } finally {
      try {
        db.close();
      } catch {
        /* 句柄已释放 */
      }
    }
  } catch {
    return null; // 读不到 ≠ 失败：该适配器判不可用，调用方转下一条路
  } finally {
    if (tmpDir) {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        /* 临时目录残留不影响正确性 */
      }
    }
  }
}
