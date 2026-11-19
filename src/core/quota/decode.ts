// 信封解包 + 归一化 —— 逐条移植 token_plan_quota.py（02 §B7/B8）。
// 两个「别简化」的点：① code 必须 String() 后比较（数字/字符串混用会漏判）；
// ② per*Percentage 是 0–1 比例，输出百分比已 ×100 并取整到 2 位。

import type { QuotaAddon, QuotaErrorKind, QuotaPlan, QuotaWindow, QuotaWindowKey } from "./types";
import { redact } from "./redact";

/** 网关级错误：code 保留原文（分类要用），message 已脱敏（服务端可能回显 token）。 */
export class GatewayError extends Error {
  readonly code: string;
  constructor(message: unknown, code = "") {
    super(redact(message).slice(0, 120));
    this.name = "GatewayError";
    this.code = code;
  }
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** 失效词判定（r4 Δ6）：ConsoleNeedLogin / NotLogined / NeedLogin 一律按登录失效处理。 */
export function isLoginInvalid(text: unknown): boolean {
  return /NotLogged|NeedLogin|NotLogin|ConsoleNeedLogin/i.test(String(text ?? ""));
}

/** 02 §B7：按序四步，任何一步失败即抛 GatewayError。 */
export function unwrap(payload: unknown): unknown {
  const p = payload as any;
  const rawCode = p?.code;
  const code = rawCode == null ? "" : String(rawCode);
  if (code !== "" && code !== "200" && !p?.successResponse) {
    throw new GatewayError(p?.message ?? p?.errorMsg ?? code, code);
  }
  const data = p?.data;
  if (data && typeof data === "object" && data.success === false) {
    throw new GatewayError(data.errorCode ?? data.errorMsg ?? data.message ?? "request failed", String(data.errorCode ?? code));
  }
  // py:143-150：DataV2.data 只在键存在时返回（值为 null 也照返），绝不回退成整个信封
  if (data && typeof data === "object" && data.DataV2 && typeof data.DataV2 === "object" && "data" in data.DataV2) {
    return data.DataV2.data;
  }
  return data ?? p;
}

/**
 * 嵌套键回退（py:163-190）：按 keys 顺序命中第一个「值为对象」的键即返回，全不命中返回原值。
 * 真实网关在 unwrap 后仍包一层 data（DataV2.data = { msg, code, data:{…}, requestId, success }），
 * 故原键全不命中时再看这一层 data；data 里必须真有本层目标字段才采用，否则仍返回原值
 * （既有形状不受影响）。只下钻一层：不递归、不深搜。
 */
function pickNested(src: unknown, keys: string[], fields: string[]): unknown {
  if (!src || typeof src !== "object" || Array.isArray(src)) return src;
  for (const k of keys) {
    const v = (src as any)[k];
    if (v && typeof v === "object" && !Array.isArray(v)) return v;
  }
  const d = (src as any).data;
  if (d && typeof d === "object" && !Array.isArray(d) && fields.some((f) => (d as any)[f] != null)) return d;
  return src;
}

export const normalizeInstance = (raw: unknown): unknown =>
  pickNested(raw, ["instanceInfo", "instance", "subscription"], ["status", "subStatus", "specCode", "remainingDays", "endTime"]);
export const normalizeUsage = (raw: unknown): unknown =>
  pickNested(raw, ["usage", "usageInfo"], ["per1WeekPercentage", "per1MonthPercentage", "per5HourPercentage"]);
export const normalizeAddonSummary = (raw: unknown): unknown =>
  pickNested(raw, ["summary", "addonSummary"], ["totalCredits", "remainingCredits", "activeCount"]);

/** py:156-160：非 number → null；否则 clamp(v*100,0,100) 取 2 位。 */
export function ratioToPercent(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return round2(Math.min(100, Math.max(0, v * 100)));
}

/** py:212-226：}>1e12 视为毫秒，否则按秒；输出本地时区 "YYYY-MM-DD HH:MM:SS"。 */
export function formatTs(v: unknown): string {
  if (v == null || v === "") return "-";
  if (typeof v !== "number" || !Number.isFinite(v)) return String(v);
  const ms = v > 1e12 ? v : v * 1000;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return String(v);
  const p2 = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
}

/** epoch（秒/毫秒启发式）→ 毫秒；非数字/不可解析 → null（TUI 倒计时退化）。 */
export function toEpochMs(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  const ms = v > 1e12 ? v : v * 1000;
  return Number.isNaN(new Date(ms).getTime()) ? null : ms;
}

const USAGE_KEYS: { key: string; window: QuotaWindowKey }[] = [
  { key: "per1WeekPercentage", window: "week" },
  { key: "per1MonthPercentage", window: "month" },
  { key: "per5HourPercentage", window: "5h" },
];

/** py:193-209：week > month > 5h，取第一个「存在且为数字」的窗口；全无 → null。 */
export function pickUsageWindow(usageRaw: unknown): QuotaWindow | null {
  const u = normalizeUsage(usageRaw) as any;
  if (!u || typeof u !== "object") return null;
  for (const { key, window } of USAGE_KEYS) {
    const used = ratioToPercent(u[key]);
    if (used == null) continue;
    const resetRaw = u[key.replace("Percentage", "ResetTime")];
    return {
      window,
      usedPercent: used,
      remainingPercent: round2(Math.max(0, 100 - used)),
      resetTime: resetRaw == null || resetRaw === "" ? null : formatTs(resetRaw),
      resetAtMs: toEpochMs(resetRaw),
    };
  }
  return null;
}

/** py:296-302：只取 status/specCode/remainingDays/endTime 四个字段；status 优先，subStatus 仅作缺省回退。 */
export function normalizePlan(raw: unknown): QuotaPlan {
  const i = normalizeInstance(raw) as any;
  const status = typeof i?.status === "string" ? i.status : typeof i?.subStatus === "string" ? i.subStatus : null;
  const endRaw = i?.endTime;
  return {
    status,
    specCode: typeof i?.specCode === "string" ? i.specCode : null,
    remainingDays: typeof i?.remainingDays === "number" && Number.isFinite(i.remainingDays) ? i.remainingDays : null,
    endTime: endRaw == null || endRaw === "" ? null : formatTs(endRaw),
    endAtMs: toEpochMs(endRaw),
  };
}

/** py:255-267：total>0 且 remaining 为数字才派生 usedPercent=(total-remaining)/total*100（2 位）。 */
export function normalizeAddon(raw: unknown): QuotaAddon {
  const a = normalizeAddonSummary(raw) as any;
  const total = typeof a?.totalCredits === "number" && Number.isFinite(a.totalCredits) ? a.totalCredits : null;
  const remaining = typeof a?.remainingCredits === "number" && Number.isFinite(a.remainingCredits) ? a.remainingCredits : null;
  let usedPercent: number | null = null;
  if (total != null && total > 0 && remaining != null) {
    const used = Math.min(total, Math.max(0, total - remaining));
    usedPercent = round2((used / total) * 100);
  }
  return {
    totalCredits: total,
    remainingCredits: remaining,
    activeCount: typeof a?.activeCount === "number" && Number.isFinite(a.activeCount) ? a.activeCount : null,
    usedPercent,
  };
}

/** py:279-284：credits = 自身 ?? data.credits ?? data.data.credits（真实信封 unwrap 后仍多包一层 data）。 */
export function normalizeQwenwork(raw: unknown): { credits: number | null } {
  const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const q = raw as any;
  return { credits: num(q?.credits) ?? num(q?.data?.credits) ?? num(q?.data?.data?.credits) };
}

/**
 * 错误分类（r3 Δ6 九值）：401/403 与登录失效词 → unauthorized；有票无权限 → parse（不误导成过期）；
 * 非 200 → network；非 JSON → parse；其余 → unknown。message 已过 redact 且截 120 字。
 */
export function classifyError(e: unknown): { kind: QuotaErrorKind; message: string } {
  const message = redact(e).slice(0, 120);
  if (e instanceof GatewayError || (e as any)?.name === "GatewayError") {
    const code = String((e as GatewayError).code ?? "");
    if (code === "401" || code === "403") return { kind: "unauthorized", message };
    if (isLoginInvalid(code) || isLoginInvalid(message)) return { kind: "unauthorized", message };
    if (code === "not-json") return { kind: "parse", message };
    if (/NoPermission/i.test(code + " " + message)) return { kind: "parse", message };
    if (/^\d{3}$/.test(code)) return { kind: "network", message }; // 非 200（5xx/4xx 其余）
    return { kind: "unknown", message };
  }
  const name = String((e as any)?.name ?? "");
  if (name === "AbortError" || name === "TimeoutError" || e instanceof TypeError) return { kind: "network", message };
  return { kind: "unknown", message };
}
