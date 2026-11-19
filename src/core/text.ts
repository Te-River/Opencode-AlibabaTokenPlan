// 展示层格式化工具。纯函数，可 node 直测。
// 0.1.4：移除 Qoder 快照引用，优惠数据仅来自阿里云百炼 Token Plan。

import type { StatusFile } from "./types";
import { fmtCountdown, fmtShortDur, windowState } from "./rules";

/** 倍率串：f.toFixed(2) 去尾 0 + "x"。 */
export function fmtFactor(f?: number): string | undefined {
  if (f === undefined || !Number.isFinite(f)) return undefined;
  let s = f.toFixed(2);
  s = s.replace(/0+$/, "").replace(/\.$/, ".0");
  return s + "x";
}

/** 划线价仅当 base 与 cur 字符串不等才划线。 */
export function showStrike(base?: number, cur?: number): boolean {
  const b = fmtFactor(base), c = fmtFactor(cur);
  return !!b && !!c && b !== c;
}

/** 用组合删除线字符模拟终端删除线（03-D4「删除线文本模拟」）。 */
export function strikethrough(s: string): string {
  return s.replace(/[^\u0300-\u036f]/g, (c) => c + "\u0336");
}

/** 「N 后开始（22:00）」/「N 后结束（08:00）」。 */
export function windowCountdownText(start: string, end: string, now = new Date()): string {
  const w = windowState({ start, end }, now);
  return w.active
    ? `${fmtCountdown(w.minutesToNextBoundary)}后结束（${end}）`
    : `${fmtCountdown(w.minutesToNextBoundary)}后开始（${start}）`;
}

/** 来源徽标行（sidebar 首行 / 工具头部）。 */
export function sourceBadgeLine(st: StatusFile): string {
  const cat = st.sources.catalog;
  const catLabel = cat === "bailian-live" ? "实时" : cat === "bailian-cli" ? "CLI" : "快照";
  const t = st.updatedAt ? new Date(st.updatedAt) : undefined;
  const hhmm = t && !Number.isNaN(t.getTime())
    ? t.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Shanghai" })
    : "";
  return `源:${catLabel}${hhmm ? " " + hhmm : ""}`;
}

/**
 * home_bottom 一行摘要：
 * `错峰 22:00–08:00 · qwen3.8-max×0.5 · 距开始 5h23m · 源:实时`
 */
export function homeSummaryLine(st: StatusFile, now = new Date()): string {
  const w = st.windows.find((x) => x.id.startsWith("offpeak")) ?? st.windows[0];
  if (!w) return "Token Plan 暂无已知优惠";
  const starModel =
    w.models.find((m) => m.model === "qwen3.8-max") ??
    w.models.find((m) => m.model.startsWith("qwen")) ??
    w.models[0];
  const parts: string[] = [`错峰 ${w.start}–${w.end}`];
  if (starModel) {
    const seg = starModel.regular && starModel.effective && starModel.regular !== starModel.effective
      ? `${starModel.model}×${starModel.regular.replace("x", "")}/×${starModel.effective.replace("x", "")}`
      : `${starModel.model}×${(starModel.effective ?? starModel.regular ?? "").replace("x", "")}`;
    parts.push(seg);
  }
  // m4：本地按 start/end(HH:MM, tz) 重算下一边界——stale 文件里的绝对 nextBoundaryAt
  // 已冻结（旧值），重算保证 home 摘要倒计时持续走字；active 判定同步重算。
  const ws = windowState(w, now);
  parts.push(`${ws.active ? "距结束" : "距开始"} ${fmtShortDur(ws.nextBoundaryAtMs - now.getTime())}`);
  parts.push(sourceBadgeLine(st));
  return parts.join(" · ");
}
