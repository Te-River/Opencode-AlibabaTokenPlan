// 规则引擎（北京时间 UTC+8，无夏令时）—— 移植自 bailian-discount-panel.ts，
// 新增 boundaryAbsolute()：输出 ISO 绝对时刻，供 TUI 秒级本地 tick 免轮询（03-D3）。

export const SH_OFFSET_MIN = 8 * 60;
export const DAY_MIN = 1440;

/** 现在=北京时间的「当日零点 UTC 起算的分钟数」(含秒小数)。不依赖本机时区。 */
export function shanghaiMinutes(now = new Date()): number {
  const shifted = new Date(now.getTime() + (now.getTimezoneOffset() + SH_OFFSET_MIN) * 60_000);
  return shifted.getHours() * 60 + shifted.getMinutes() + shifted.getSeconds() / 60;
}

export function parseHm(s: string): number {
  const [h, min] = s.split(":").map(Number);
  return h * 60 + (min || 0);
}

export interface WindowState {
  active: boolean;
  minutesToNextBoundary: number;
  boundaryKind: "start" | "end";
  /** 下一边界绝对时刻 epoch ms */
  nextBoundaryAtMs: number;
  /** 下一边界 ISO 字符串（+08:00 时区后缀，如 2026-08-31T22:00:00.000+08:00） */
  nextBoundaryAt: string;
}

/**
 * 窗口态 + 绝对边界。start>end 视为跨午夜（如 22:00–08:00）。
 * 旧 ruleWindow() 的 active/minutesToNextBoundary 语义保持 1:1。
 */
export function windowState(rule: { start: string; end: string }, now = new Date()): WindowState {
  const start = parseHm(rule.start);
  const end = parseHm(rule.end);
  const m = shanghaiMinutes(now);
  const wraps = start > end;
  const active = wraps ? m >= start || m < end : m >= start && m < end;
  let toNext: number;
  let kind: "start" | "end";
  if (active) {
    toNext = wraps ? (m >= start ? end + DAY_MIN - m : end - m) : end - m;
    kind = "end";
  } else {
    toNext = m < start ? start - m : start + DAY_MIN - m;
    kind = "start";
  }
  return {
    active,
    minutesToNextBoundary: Math.max(0, Math.round(toNext)),
    boundaryKind: kind,
    nextBoundaryAtMs: now.getTime() + toNext * 60_000,
    nextBoundaryAt: shanghaiISO(now.getTime() + toNext * 60_000),
  };
}

/** epoch ms → 北京时间 ISO 串（带 +08:00 后缀）。 */
export function shanghaiISO(ms: number): string {
  const d = new Date(ms + SH_OFFSET_MIN * 60_000);
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return (
    d.getUTCFullYear() + "-" + p(d.getUTCMonth() + 1) + "-" + p(d.getUTCDate()) +
    "T" + p(d.getUTCHours()) + ":" + p(d.getUTCMinutes()) + ":" + p(d.getUTCSeconds()) +
    "." + p(d.getUTCMilliseconds(), 3) + "+08:00"
  );
}

/** 兼容旧签名：仅窗口激活态与剩余分钟（toast 去重复用）。 */
export function ruleWindow(rule: { start: string; end: string }, now = new Date()) {
  const w = windowState(rule, now);
  return { active: w.active, minutesToNextBoundary: w.minutesToNextBoundary };
}

/** "N 天 N 小时 N 分钟"（旧 fmtCountdown 1:1）。 */
export function fmtCountdown(mins: number): string {
  if (mins <= 0) return "不足 1 分钟";
  const d = Math.floor(mins / DAY_MIN);
  const h = Math.floor((mins % DAY_MIN) / 60);
  const m = mins % 60;
  const parts: string[] = [];
  if (d) parts.push(d + " 天");
  if (h) parts.push(h + " 小时");
  parts.push(m + " 分钟");
  return parts.join(" ");
}

/** HH:MM:SS 秒级倒计时（TUI 本地每秒 tick 用）。ms<=0 → "00:00:00"。 */
export function fmtHMS(msRemaining: number): string {
  const total = Math.max(0, Math.floor(msRemaining / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(h)}:${p(m)}:${p(s)}`;
}

/** 倒计时短横串，如 "5h23m"（home_bottom 一行摘要用）。 */
export function fmtShortDur(msRemaining: number): string {
  const total = Math.max(0, Math.floor(msRemaining / 60_000));
  const d = Math.floor(total / DAY_MIN);
  const h = Math.floor((total % DAY_MIN) / 60);
  const m = total % 60;
  if (d) return `${d}d${h}h`;
  if (h) return `${h}h${m}m`;
  return `${m}m`;
}
