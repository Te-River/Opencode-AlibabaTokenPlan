// 凭证模块 —— 全库唯一持有秘密材料的地方（r3 Δ1，r4 Δ1 合并 7 个文件）。
// 硬规则：Cookie / access_token 只在本文件的内存变量里存活；不出现在返回值、错误串、日志、缓存、
// 状态文件、toast 里（出界消息一律过 redact()）。落盘仅 credential.json，且内容只有 DPAPI 密文。

import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { classifyError, GatewayError, unwrap } from "./decode";
import { API, COMMODITY, baseHeaders, buildGatewayUrl, buildRequestBody } from "./request";
import { redact } from "./redact";
import {
  closeChromium,
  detect,
  launchChromium,
  legacyStateRoot,
  ownProfilesRoot,
  readChromiumCookies,
  readFirefoxCookies,
  sleepOrAbort,
  blConfigPath,
  stateRoot,
  type ChromiumHandle,
} from "./browsers";
import type { DefaultBrowserResolver } from "./default-browser";
import type { AdapterId, BrowserCandidate, QuotaError, QuotaErrorKind, QuotaSource } from "./types";

export type Cred = { kind: "cookie"; jar: string; source: QuotaSource } | { kind: "bearer"; token: string; source: QuotaSource };

export type CredentialState = "authorized" | "awaiting-login" | "manual-needed" | "expired" | "none";
/** storage：本次授权是否真的落盘（dpapi=重启可恢复；session=只在内存，重启即丢）。 */
export type LoginResult = { ok: true; storage?: "dpapi" | "session" } | { ok: false; kind: QuotaErrorKind; message: string };
/** 落盘可用性（可观测状态，不含任何秘密）：none=尚无落盘凭证。 */
export type CredentialStorage = "dpapi" | "session" | "none";

const TARGET_WINDOW_MS = 180_000; // Δ2-8：等待用户在浏览器里登录的上限
const HTTP_TIMEOUT_MS = 30_000; // R2 B9
const COOKIE_POLL_MS = 2000;

let cred: Cred | null = null;
let state: CredentialState = "none";
let storage: CredentialStorage = "none";

const fail = (kind: QuotaErrorKind, message: string): LoginResult => ({ ok: false, kind, message: redact(message).slice(0, 120) });

// ───────────────────────── 落盘（Δ5 / r5 Δ1） ─────────────────────────

/** 插件自有状态根（宿主命名空间之外，见 browsers.stateRoot）；ATP_STATE_ROOT 仅测试/隔离用。 */
function credentialRoot(): string {
  return stateRoot();
}

function credentialFilePath(): string {
  return path.join(credentialRoot(), "credential.json");
}

/** 迁移失败时仍可读的旧位置（宿主命名空间，只读）。 */
function legacyCredentialFilePath(): string {
  return path.join(legacyStateRoot(), "credential.json");
}

const PS_PROTECT =
  "Add-Type -AssemblyName System.Security; " +
  "[Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Protect([Text.Encoding]::UTF8.GetBytes($env:ATP_SECRET),$null,'CurrentUser'))";
const PS_UNPROTECT =
  "Add-Type -AssemblyName System.Security; " +
  "[Text.Encoding]::UTF8.GetString([Security.Cryptography.ProtectedData]::Unprotect([Convert]::FromBase64String($env:ATP_SECRET),$null,'CurrentUser'))";

/** PowerShell 绝对路径：不依赖 PATH（宿主环境的 PATH 不可信）；不存在才退回裸名。 */
function powershellExe(): string {
  const root = process.env.SystemRoot ?? process.env.windir;
  const abs = root ? path.join(root, "System32", "WindowsPowerShell", "v1.0", "powershell.exe") : "";
  return abs && fs.existsSync(abs) ? abs : "powershell.exe";
}

/** 秘密只走环境变量（不进 argv）；spawn 失败/超时/空输出 → null（回退内存态，不落盘）。 */
function runPowerShell(script: string, secret: string): Promise<string | null> {
  return new Promise((resolve) => {
    const child = spawn(powershellExe(), ["-NoProfile", "-NonInteractive", "-Command", script], {
      env: { ...process.env, ATP_SECRET: secret },
      stdio: ["ignore", "pipe", "ignore"],
      windowsHide: true,
    });
    let out = "";
    const timer = setTimeout(() => {
      child.kill();
      resolve(null);
    }, 8000);
    child.stdout?.on("data", (d) => (out += String(d)));
    child.once("error", () => {
      clearTimeout(timer);
      resolve(null);
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      const text = out.trim();
      resolve(code === 0 && text ? text : null);
    });
  });
}

/** 落盘：Windows DPAPI(CurrentUser) 可用 → 写密文；否则只在内存（重启需重新授权）。结果记录到 storage。 */
async function persist(): Promise<"dpapi" | "session"> {
  if (!cred || process.platform !== "win32") {
    storage = "session";
    return storage;
  }
  const blob = await runPowerShell(PS_PROTECT, JSON.stringify({ v: 1, ...cred }));
  if (!blob) {
    storage = "session"; // spawn 失败/超时/空输出：本次授权重启即丢，但状态可查
    return storage;
  }
  try {
    const file = credentialFilePath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ schemaVersion: 1, prot: "dpapi", savedAt: new Date().toISOString(), data: blob }));
    storage = "dpapi";
    return storage;
  } catch {
    storage = "session";
    return storage;
  }
}

/** 可观测的落盘可用性：绝不包含密文/明文/凭据。 */
export function credentialStorage(): CredentialStorage {
  return storage;
}

async function restoreFromDisk(): Promise<Cred | null> {
  if (process.platform !== "win32") return null;
  let blob: string | null = null;
  for (const file of [credentialFilePath(), legacyCredentialFilePath()]) {
    try {
      const raw = JSON.parse(fs.readFileSync(file, "utf8")) as any;
      if (raw?.schemaVersion !== 1 || raw?.prot !== "dpapi" || typeof raw?.data !== "string") continue;
      blob = raw.data;
      break;
    } catch {
      /* 该位置缺失/损坏：试下一个位置 */
    }
  }
  if (!blob) return null;
  const plain = await runPowerShell(PS_UNPROTECT, blob);
  if (!plain) return null;
  try {
    const parsed = JSON.parse(plain) as any;
    if (parsed?.kind === "cookie" && typeof parsed.jar === "string" && parsed.jar) {
      storage = "dpapi";
      return { kind: "cookie", jar: parsed.jar, source: parsed.source ?? "browser-session" };
    }
    if (parsed?.kind === "bearer" && typeof parsed.token === "string" && parsed.token) {
      storage = "dpapi";
      return { kind: "bearer", token: parsed.token, source: "bl" };
    }
  } catch {
    return null; // 密文损坏：当作未授权
  }
  return null;
}

/** bl 旁路（R2 A3）：只读 ~/.bailian/config.json 的 access_token，走 Bearer → /cli/api.json。 */
function readBlToken(): Cred | null {
  try {
    const cfg = JSON.parse(fs.readFileSync(blConfigPath(), "utf8")) as any;
    const token = cfg?.console?.access_token ?? cfg?.access_token ?? cfg?.tokens?.console?.access_token;
    return typeof token === "string" && token ? { kind: "bearer", token, source: "bl" } : null;
  } catch {
    return null;
  }
}

// ───────────────────────── 请求通道（r3 Δ3，Cookie/Bearer 对上层透明） ─────────────────────────

function linkAbort(signal: AbortSignal, ms: number): { signal: AbortSignal; done: () => void } {
  const ctrl = new AbortController();
  // 超时必须带 TimeoutError 名：classifyError 靠它把超时归到 network（端口契约），不是 unknown
  const timer = setTimeout(() => ctrl.abort(new DOMException("timeout", "TimeoutError")), ms);
  const onAbort = () => ctrl.abort(signal.reason);
  if (signal.aborted) ctrl.abort(signal.reason);
  else signal.addEventListener("abort", onAbort, { once: true });
  return {
    signal: ctrl.signal,
    done: () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
    },
  };
}

/** 控制台部分接口要求 sec_token（py:114-116）；缺失时整个字段不带。环境读取只发生在本模块。 */
function secToken(): string | undefined {
  const v = process.env.ALIYUN_SEC_TOKEN?.trim();
  return v ? v : undefined;
}

async function postWith(c: Cred, api: string, data: Record<string, unknown>, signal: AbortSignal): Promise<unknown> {
  const headers = baseHeaders();
  if (c.kind === "bearer") headers.Authorization = `Bearer ${c.token}`;
  else headers.Cookie = c.jar;
  const link = linkAbort(signal, HTTP_TIMEOUT_MS);
  try {
    const res = await fetch(buildGatewayUrl(api, c.kind === "bearer" ? "cli" : "data"), {
      method: "POST",
      headers,
      body: buildRequestBody(api, data, secToken()),
      signal: link.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new GatewayError(`HTTP ${res.status}: ${body.slice(0, 500)}`, String(res.status));
    }
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new GatewayError(`not JSON: ${text.slice(0, 200)}`, "not-json");
    }
  } finally {
    link.done();
  }
}

/** 探针：subscription API 通过即"已登录"（Δ2-6，不猜 cookie 名字）。 */
async function probeWith(c: Cred, signal: AbortSignal): Promise<LoginResult> {
  try {
    unwrap(await postWith(c, API.subscription, { queryInstanceInfoRequest: { commodityCode: COMMODITY.solo } }, signal));
    return { ok: true };
  } catch (e) {
    const err: QuotaError = classifyError(e);
    return { ok: false, kind: err.kind, message: err.message };
  }
}

/** 401 后：内存态已 expired，落盘凭证不再声称可用（文件只在 forgetCredential 里删，见 r5 Δ1-3）。 */
function invalidatePersisted(): void {
  storage = "none";
}

/** 单测注入（生产不传）：网络通道、读盘、清盘都可替换，测试不碰真实用户目录。 */
export interface CredentialDeps {
  request?: (api: string, data: Record<string, unknown>, signal: AbortSignal) => Promise<unknown>;
  restore?: () => Promise<Cred | null>;
  invalidate?: () => void;
}

/** 上层唯一取数入口：按已登录的通道打网关；无凭证 throw GatewayError("NO_CREDENTIAL")。 */
export async function consoleRequest(api: string, data: Record<string, unknown>, signal: AbortSignal, deps: CredentialDeps = {}): Promise<unknown> {
  if (!cred) await probeCredential(deps);
  const c = cred;
  if (!c) throw new GatewayError("未授权 · 打开 /tokenplan 授权", "NO_CREDENTIAL");
  try {
    const payload = deps.request ? await deps.request(api, data, signal) : await postWith(c, api, data, signal);
    unwrap(payload); // 登录失效在这里暴露，便于把状态机推到 expired
    return payload;
  } catch (e) {
    if (classifyError(e).kind === "unauthorized") {
      cred = null;
      state = "expired";
      (deps.invalidate ?? invalidatePersisted)(); // 落盘凭证作废（storage=none）；文件本身留到 forgetCredential 再删
    }
    throw e;
  }
}

// ───────────────────────── 状态机（r3 Δ6） ─────────────────────────

/** 只看有无，不返回秘密：内存 → DPAPI 落盘 → bl 旁路；expired 是粘滞态（只有重新授权能解除）。 */
export async function probeCredential(deps: CredentialDeps = {}): Promise<CredentialState> {
  if (cred) {
    state = "authorized";
    return state;
  }
  if (state === "expired") return state; // 401 后不再每 60s 复读死 Cookie（每次都要起一次 PowerShell）
  cred = (await (deps.restore ?? restoreFromDisk)()) ?? readBlToken();
  state = cred ? "authorized" : "none";
  return state;
}

/** 当前通道来源（cache 由调用方自己标）。 */
export function credentialSource(): QuotaSource | null {
  return cred?.source ?? null;
}

export async function forgetCredential(): Promise<void> {
  cred = null;
  state = "none";
  storage = "none";
  // 新根 + 迁移遗漏的旧根都清；除此之外本模块不删任何文件
  for (const file of [credentialFilePath(), legacyCredentialFilePath()]) {
    try {
      fs.rmSync(file, { force: true });
    } catch {
      /* 不存在/被占用：内存已清空，仍是"已退出" */
    }
  }
  // 每次授权都会留在自有 profile 里一份登录态（数十~数百 MB），退出时一并删；只删本插件自己的目录
  for (const dir of [ownProfilesRoot(), path.join(legacyStateRoot(), "browsers")]) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      /* 目录不存在/仍被浏览器占用：内存与密文已清空，仍是"已退出" */
    }
  }
}

/** 转发 detect()（r4 Δ1/Δ7：只露 browsers/adapters/preferred 三项；resolveDefault 仅单测注入）。 */
export async function detectCredentialAdapters(resolveDefault?: DefaultBrowserResolver): Promise<{ browsers: BrowserCandidate[]; adapters: AdapterId[]; preferred: AdapterId | null }> {
  const { browsers, adapters, preferred } = await detect(true, resolveDefault);
  return { browsers, adapters, preferred };
}

export interface LoginOptions {
  signal: AbortSignal;
  onProgress: (p: { phase: "launching" | "waiting-login" | "verifying" | "closing"; secondsLeft: number }) => void;
  adapters?: AdapterId[]; // 对话框里用户选定后传入；省略=detect() 顺序
}

/**
 * 授权：按适配器顺序尝试，全部失败返回分类错误（绝不抛）。
 * CDP 路径的进程清理统一走 finally（成功/超时/取消/异常），只关自己 spawn 的实例。
 */
export async function login(opts: LoginOptions): Promise<LoginResult> {
  const { signal, onProgress: progress } = opts;
  const detected = await detect(true);
  const order = opts.adapters?.length ? opts.adapters.filter((a) => detected.adapters.includes(a)) : detected.adapters;
  const chromium = detected.browsers.filter((b) => b.family === "chromium");
  state = "awaiting-login";

  for (const adapter of order) {
    if (signal.aborted) return fail("none", "已取消授权");
    if (adapter === "bl") {
      const c = readBlToken();
      if (!c) continue;
      const r = await probeWith(c, signal);
      if (r.ok) {
        cred = c;
        state = "authorized";
        return { ok: true, storage: await persist() };
      }
      continue;
    }
    if (adapter === "firefox-sqlite") {
      for (const b of detected.browsers.filter((x) => x.family === "firefox")) {
        progress({ phase: "verifying", secondsLeft: 0 });
        const jar = await readFirefoxCookies(b);
        if (!jar) continue;
        const c: Cred = { kind: "cookie", jar, source: "firefox" };
        if ((await probeWith(c, signal)).ok) {
          cred = c;
          state = "authorized";
          return { ok: true, storage: await persist() };
        }
      }
      continue;
    }
    if (adapter === "manual-paste") {
      state = "manual-needed";
      return fail("browser-unavailable", "无法自动读取登录态 · 请在 /tokenplan 粘贴 Cookie");
    }
    // cdp-own-profile（仅插件自有 profile；真实 profile 从不 spawn）
    for (const browser of chromium) {
      if (signal.aborted) return fail("none", "已取消授权");
      progress({ phase: "launching", secondsLeft: Math.round(TARGET_WINDOW_MS / 1000) });
      let handle: ChromiumHandle | null = null;
      try {
        handle = await launchChromium(browser, signal);
        progress({ phase: "waiting-login", secondsLeft: Math.round(TARGET_WINDOW_MS / 1000) });
        const result = await waitForLogin(handle, signal, progress);
        if (result) {
          cred = result;
          state = "authorized";
          return { ok: true, storage: await persist() };
        }
        // 窗口耗尽：这条适配器即失败，继续下一条
      } catch {
        if (signal.aborted) return fail("none", "已取消授权");
        // 起不来/被转交既有实例：静默换下一条路（Δ4）
      } finally {
        progress({ phase: "closing", secondsLeft: 0 });
        await closeChromium(handle);
      }
    }
  }

  state = "manual-needed";
  return fail("browser-unavailable", "无法自动读取登录态 · 请在 /tokenplan 粘贴 Cookie");
}

/** CDP 轮询：每 2s 读一次 cookie，变化即探针；180s 内无果 → null。 */
async function waitForLogin(
  handle: ChromiumHandle,
  signal: AbortSignal,
  progress: (p: { phase: "launching" | "waiting-login" | "verifying" | "closing"; secondsLeft: number }) => void,
): Promise<Cred | null> {
  const deadline = Date.now() + TARGET_WINDOW_MS;
  let lastJar = "";
  while (Date.now() < deadline) {
    if (signal.aborted) return null;
    progress({ phase: "waiting-login", secondsLeft: Math.ceil((deadline - Date.now()) / 1000) });
    try {
      await sleepOrAbort(COOKIE_POLL_MS, signal);
    } catch {
      return null;
    }
    const jar = await readChromiumCookies(handle.port, signal);
    if (!jar || jar === lastJar) continue;
    lastJar = jar;
    progress({ phase: "verifying", secondsLeft: Math.ceil((deadline - Date.now()) / 1000) });
    const c: Cred = { kind: "cookie", jar, source: "browser-session" };
    if ((await probeWith(c, signal)).ok) return c;
  }
  return null;
}

/** Δ4：手动粘贴——≥2 个 name=value 对、无换行；探针通过才落盘。 */
export async function submitManualCookie(raw: string, signal: AbortSignal): Promise<LoginResult> {
  const jar = normalizeCookieInput(raw);
  if (!jar) return fail("paste-invalid", "Cookie 无效或已过期 · 请重新复制");
  const c: Cred = { kind: "cookie", jar, source: "manual" };
  const r = await probeWith(c, signal);
  if (!r.ok) return fail("paste-invalid", "Cookie 无效或已过期 · 请重新复制");
  cred = c;
  state = "authorized";
  return { ok: true, storage: await persist() };
}

function normalizeCookieInput(raw: string): string | null {
  if (typeof raw !== "string") return null;
  let s = raw.trim();
  if (!s || /[\r\n]/.test(s)) return null;
  s = s.replace(/^cookie\s*:\s*/i, "");
  const pairs = s.match(/[^=;\s]+=[^;]*/g) ?? [];
  const usable = pairs.filter((p) => p.slice(p.indexOf("=") + 1).trim().length > 0);
  return usable.length >= 2 ? usable.map((p) => p.trim()).join("; ") : null;
}
