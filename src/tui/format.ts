// 纯格式化：额度 / 优惠 → 文案。零 JSX、零 I/O、零 opencode 依赖，可在 node 里直测。
// 倒计时复用 core/rules 的 fmtHMS / fmtShortDur，不另写一份实现。

import { fmtHMS, fmtShortDur } from "../core/rules";
import { formatTs } from "../core/quota/decode";
import type { WindowView } from "../core/types";
import type { QuotaSnapshot, QuotaWindow } from "../core/quota/types";
import type { DiscountSnapshot, TokenPlanStatus } from "../core/status-model";
import type { PeriodUsage } from "../core/usage-history";
import type { UsageSeries } from "../core/usage-series";
import type { TuiContext } from "./context";

type Theme = TuiContext["theme"];

const DASH = "—";

/** fetchedAt 是 ISO/UTC；展示要本机时区，复用 decode 的 formatTs（02 format_ts），不另造时区逻辑。 */
function localStamp(iso: string): string {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? DASH : formatTs(ms).slice(0, 16);
}

/** 面板行首：label 定宽 12 后再加一个空格 —— label 超长时也保证与 value 之间有分隔。 */
export function rowLabelText(label: string): string {
  return `${label.padEnd(12)} `;
}

export interface Row {
  label: string;
  value: string;
  muted?: boolean;
  /** 额度语义等级：只决定取色，不影响文案。 */
  severity?: QuotaSeverity;
}

export type QuotaSeverity = "success" | "warning" | "error";

/** 已用比例 → 语义色档位：<70 success、70–<90 warning、>=90 error；非法值 null（用默认色）。 */
export function quotaSeverity(usedPercent: number | null | undefined): QuotaSeverity | null {
  if (usedPercent === null || usedPercent === undefined || !Number.isFinite(usedPercent)) return null;
  if (usedPercent >= 90) return "error";
  if (usedPercent >= 70) return "warning";
  return "success";
}

/** 语义色 → 终端命名色：主题 feedback 解析成白色/不可用（与正文色相同）时用它兜底，不硬编码 hex。 */
const NAMED_SEVERITY_FG: Record<QuotaSeverity, string> = { success: "green", warning: "yellow", error: "red" };

/**
 * 颜色归一化：主题解析值可能不是字符串（如 RGBA 对象），直接塞给 `fg` 会让渲染器
 * 对它调 `.trim()` 崩溃。非字符串 / 空串一律回退到调用方给的命名色。
 */
export function colorString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

/** 解析 `#rgb` / `#rrggbb` / `rgb()/rgba()`；命名色、变量等其它格式 → null（直接采用）。 */
function parseRgb(color: string): [number, number, number] | null {
  const value = color.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value);
  if (hex) {
    const raw = hex[1].length === 3 ? hex[1].split("").map((char) => char + char).join("") : hex[1];
    return [parseInt(raw.slice(0, 2), 16), parseInt(raw.slice(2, 4), 16), parseInt(raw.slice(4, 6), 16)];
  }
  const rgb = /^rgba?\(([^)]+)\)$/i.exec(value);
  if (!rgb) return null;
  const parts = rgb[1].split(/[,/\s]+/).filter(Boolean).map((part) => Number.parseFloat(part));
  if (parts.length < 3 || !parts.slice(0, 3).every((n) => Number.isFinite(n))) return null;
  return [parts[0], parts[1], parts[2]];
}

/**
 * 近白/近灰判定：亮度很高（max > 200）且几乎没有色度（max−min < 40）——这种色在终端上
 * 与正文白几乎分不开，语义色等于没上。饱和色（如 #e5c07b、#00ff00）不算。
 */
function isWashedOut(color: string): boolean {
  const rgb = parseRgb(color);
  if (!rgb) return false;
  const max = Math.max(...rgb);
  const min = Math.min(...rgb);
  return max > 200 && max - min < 40;
}

/** 语义等级的取色：主题 feedback 优先；缺失、非字符串、等于正文色或近白/近灰时 → 命名色。 */
export function quotaSeverityFg(theme: Theme, severity: QuotaSeverity | null | undefined): string {
  const feedback = theme.text.feedback;
  const base = colorString(theme.text.base, "white");
  const raw =
    severity === "error"
      ? feedback?.error?.base
      : severity === "warning"
        ? feedback?.warning?.base
        : severity === "success"
          ? feedback?.success?.base
          : undefined;
  const fg = colorString(raw, "");
  if (fg && fg !== base && !isWashedOut(fg)) return fg;
  return severity ? NAMED_SEVERITY_FG[severity] : base;
}

/**
 * 周期叠加段（▓）的强调色：近7天=黄、近5h=青，两条不能同色。
 * 主题 feedback 优先（warning / info），缺失/非字符串/等于正文色时退回命名色。
 */
export function overlayFg(theme: Theme, period: "week" | "fiveHour"): string {
  const feedback = theme.text.feedback;
  const base = colorString(theme.text.base, "white");
  const preferred = colorString(period === "fiveHour" ? feedback?.info?.base : feedback?.warning?.base, "");
  if (preferred && preferred !== base) return preferred;
  return period === "fiveHour" ? "cyan" : "yellow";
}

// 额度句里的「长条 + 百分比」段：条由 █/▒/░ 组成，百分比是一位小数（84.0%），整数写法（84%）也兼容。
const METER = /^(.*?)([█▒░]{16} \d+(?:\.\d+)?%)(.*)$/;

/** 把额度句切成 [前缀, 长条+百分比, 后缀]；不是额度句 → null（视图据此决定是否上语义色）。 */
export function splitMeter(line: string): [string, string, string] | null {
  const parts = METER.exec(line);
  return parts ? [parts[1], parts[2], parts[3]] : null;
}

/** 月额度值行识别（按内容，不按行号）：`bar16 + 84.0%` 形状；周期行带 `-N.N%`，不会命中。 */
export function isQuotaMeterLine(line: string): boolean {
  return splitMeter(line) !== null;
}

/** 百分比固定一位小数（83 → "83.0%"），四舍五入到 0.1；分档判定仍用原始数值，不经此函数。 */
export function percent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return DASH;
  return `${value.toFixed(1)}%`;
}

/**
 * 剩余百分比一律由已用推导：round1(100 − used)。
 * 服务端两个字段各自四舍五入，直接用会出现「已用 84.0% + 剩 15.9% = 99.9」。
 */
export function remainingOf(usedPercent: number): number {
  return Math.round((100 - usedPercent) * 10) / 10;
}

/** 月额度条：`█` 未用（实心亮色）在左，`░` 已用（虚、灰）在右。 */
export function usageBar(usedPercent: number | null | undefined, width = 16): string {
  if (usedPercent === null || usedPercent === undefined || !Number.isFinite(usedPercent)) return "";
  const clamped = Math.max(0, Math.min(100, usedPercent));
  const used = Math.round(clamped / 100 * width);
  return "█".repeat(width - used) + "░".repeat(used);
}

/** 消耗量百分比：带负号表示已消耗，一位小数，零也带符号（`-0.0%`）。 */
export function consumedPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return DASH;
  return `-${Math.abs(value).toFixed(1)}%`;
}

export type BarSegmentKind = "unused" | "period" | "used";

export interface BarSegment {
  kind: BarSegmentKind;
  text: string;
}

/**
 * 叠加条按颜色切段：`█` 未用（实心亮色）/ `▒` 该周期消耗（彩色）/ `░` 已用（虚、灰）。
 * 视图据此逐段上色，整行不能用单色。
 */
export function barSegments(bar: string): BarSegment[] {
  const segments: BarSegment[] = [];
  for (const char of bar) {
    const kind: BarSegmentKind = char === "█" ? "unused" : char === "▒" ? "period" : "used";
    const last = segments[segments.length - 1];
    if (last && last.kind === kind) last.text += char;
    else segments.push({ kind, text: char });
  }
  return segments;
}

/**
 * 叠加条的纯条部分（不含百分比），从左到右：
 * 未用 █（长度 round(remaining% × width)，实心亮）→ 周期消耗 ▒（紧贴其右，period>0 时至少 1 格）
 * → 已用 ░（虚、灰，占剩余格数）。总宽固定 width。
 */
export function segmentedBar(
  monthUsedPercent: number | null | undefined,
  periodUsedPercent: number | null | undefined,
  width = 16,
): string {
  if (monthUsedPercent === null || monthUsedPercent === undefined || !Number.isFinite(monthUsedPercent)) return "";
  const used = Math.max(0, Math.min(100, monthUsedPercent));
  const unused = Math.round((100 - used) / 100 * width);
  const period = periodUsedPercent === null || periodUsedPercent === undefined || !Number.isFinite(periodUsedPercent)
    ? 0
    : Math.max(0, Math.min(100, periodUsedPercent));
  const wanted = period > 0 ? Math.max(1, Math.round(period / 100 * width)) : 0;
  const span = Math.min(width - unused, wanted);
  return "█".repeat(unused) + "▒".repeat(span) + "░".repeat(width - unused - span);
}

/** 叠加条 + 负号百分比（面板/旧调用点用整串；侧栏值行用 `segmentedBar` 以便分段上色）。 */
export function segmentedUsageBar(
  monthUsedPercent: number | null | undefined,
  periodUsedPercent: number | null | undefined,
  width = 16,
): string {
  const bar = segmentedBar(monthUsedPercent, periodUsedPercent, width);
  return bar ? `${bar} ${consumedPercent(periodUsedPercent)}` : "";
}

/** token 数量文字：<1e3 → 整数，其余 K/M/B 两位小数（整数也保留 .00），单位用全称 Token。非法值 → ""。 */
export function tokenTotal(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "";
  const n = Math.max(0, value);
  if (n < 1e3) return `${Math.round(n)} Token`;
  if (n < 1e6) return `${(n / 1e3).toFixed(2)}K Token`;
  if (n < 1e9) return `${(n / 1e6).toFixed(2)}M Token`;
  return `${(n / 1e9).toFixed(2)}B Token`;
}

export function credits(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return DASH;
  return Math.round(value).toLocaleString("zh-CN");
}

export function windowLabel(key: QuotaWindow["window"]): string {
  if (key === "5h") return "5 小时";
  return key === "week" ? "周" : "月";
}

/** 窗口倒计时："02:13:07 后结束" / 紧凑 "2h13m 后开始"。 */
export function windowCountdown(view: WindowView, nowMs: number, compact = false): string {
  const at = Date.parse(view.nextBoundaryAt);
  if (Number.isNaN(at)) return view.activeNow ? "进行中" : "即将开始";
  const left = at - nowMs;
  const span = compact ? fmtShortDur(left) : fmtHMS(left);
  return view.activeNow ? `${span} 后结束` : `${span} 后开始`;
}

/** 最近一个窗口：进行中的优先，其次按下一边界时间。 */
export function nearestWindow(discount: DiscountSnapshot, nowMs: number): WindowView | null {
  let best: { view: WindowView; rank: number; at: number } | null = null;
  for (const view of discount.windows) {
    const parsed = Date.parse(view.nextBoundaryAt);
    const at = Number.isNaN(parsed) ? nowMs + Number.MAX_SAFE_INTEGER : parsed;
    const rank = view.activeNow ? 0 : 1;
    if (!best || rank < best.rank || (rank === best.rank && at < best.at)) best = { view, rank, at };
  }
  return best?.view ?? null;
}

/** 月额度的标签行文案（视图据此用正文色，其余行灰色）。 */
export const MONTH_LABEL = "月额度";

/**
 * 月额度两行：标签行 `月额度 · 10d2h 后重置` + 值行 `bar16 84.0% 860.92M Token`。
 * 没有月度窗口时退回单行「套餐 X」；月合计不可用时省略该段。
 */
export function quotaLines(quota: QuotaSnapshot, nowMs: number, series?: UsageSeries): string[] {
  if (!quota.ok) return [];
  const view = quota.window;
  if (!view) return quota.plan?.status ? [`套餐 ${quota.plan.status}`] : [];
  const left = view.resetAtMs === null ? null : view.resetAtMs - nowMs;
  const reset = left !== null && left > 0
    ? `${fmtShortDur(left)} 后重置`
    : view.resetTime
      ? `重置 ${view.resetTime}`
      : "";
  const total = tokenTotal(series?.tokensMonth);
  const value = [usageBar(view.usedPercent), percent(view.usedPercent), total].filter(Boolean).join(" ");
  return [reset ? `${MONTH_LABEL} · ${reset}` : MONTH_LABEL, value];
}

/** effective "0.4x" → 4（折）；无法解析返回 null。 */
function tierOf(model: WindowView["models"][number]): number | null {
  const raw = model.effective ?? model.regular;
  if (!raw) return null;
  const factor = Number.parseFloat(raw);
  if (!Number.isFinite(factor) || factor <= 0 || factor > 1) return null;
  return Math.round(factor * 100) / 10; // 0.08 → 0.8，0.4 → 4
}

function fmtTier(value: number): string {
  return String(Number(value.toFixed(1)));
}

type WindowModel = WindowView["models"][number];

function isQwen(model: WindowModel): boolean {
  return model.model.toLowerCase().startsWith("qwen");
}

/** 折数字面值（0.4x → 0.4），用于排序；无法解析排最后。 */
function factorOf(model: WindowModel): number {
  const factor = Number.parseFloat(model.effective ?? model.regular ?? "");
  return Number.isFinite(factor) ? factor : Number.POSITIVE_INFINITY;
}

/** qwen 全在前，其余品牌随后；各组内折数升序、同折按模型名。侧栏与面板共用这一顺序。 */
function orderedModels(models: WindowModel[]): WindowModel[] {
  return [...models].sort(
    (a, b) =>
      Number(isQwen(b)) - Number(isQwen(a)) ||
      factorOf(a) - factorOf(b) ||
      a.model.localeCompare(b.model),
  );
}

/**
 * 侧栏模型优惠行：qwen 优先、每行一个模型、最多三行；qwen 不足三个用其他品牌按折数升序补齐。
 * 倒计时已提到额度下方的独立行，模型行不再拼它。
 */
function sidebarModelLines(view: WindowView): string[] {
  const ranked = orderedModels(view.models)
    .map((model) => ({ model, tier: tierOf(model) }))
    .filter((entry): entry is { model: WindowModel; tier: number } => entry.tier !== null);
  const picked = ranked.filter((entry) => isQwen(entry.model)).slice(0, 3);
  if (picked.length < 3) {
    picked.push(...ranked.filter((entry) => !isQwen(entry.model)).slice(0, 3 - picked.length));
  }
  return picked.map((entry) => `${entry.model.model} ${fmtTier(entry.tier)} 折`);
}

/** 侧栏第 2 行：最近窗口的紧凑倒计时（灰色小字），紧随月额度条。 */
function sidebarCountdownLine(view: WindowView, nowMs: number): string {
  return `夜间 ${windowCountdown(view, nowMs, true)}`;
}

/** 周期用量值行：叠加条 bar16 + 负号百分比 + token 全称（无本地样本写「数据采集中」，无 token 省略该段）。 */
function periodValue(period: PeriodUsage, monthUsedPercent: number, tokens: number | undefined): string {
  const total = tokenTotal(tokens);
  if (period.samples === 0) return `数据采集中${total ? ` · ${total}` : ""}`;
  return [segmentedBar(monthUsedPercent, period.usedPercent), consumedPercent(period.usedPercent), total]
    .filter(Boolean)
    .join(" ");
}

/**
 * 侧栏固定顺序：月额度（标签+值）→ 夜间倒计时 → 至多三行模型优惠 → 空行 → 近7天消耗（标签+值）
 * → 空行 → 近5h消耗（标签+值）→ 加购。除月额度外都由视图统一着灰色，空行用 "" 表示。
 */
export function sidebarLines(status: TokenPlanStatus, nowMs: number): string[] {
  const lines: string[] = [...quotaLines(status.quota, nowMs, status.usageSeries)];
  const near = nearestWindow(status.discount, nowMs);
  if (near) lines.push(sidebarCountdownLine(near, nowMs));
  if (near) lines.push(...sidebarModelLines(near));
  const view = status.quota.window;
  const periods = status.usagePeriods;
  if (view && periods) {
    lines.push("");
    lines.push("近7天消耗");
    lines.push(periodValue(periods.week, view.usedPercent, status.usageSeries?.tokens7d));
    lines.push("");
    lines.push("近5h消耗");
    lines.push(periodValue(periods.fiveHour, view.usedPercent, status.usageSeries?.tokens5h));
  }
  const addon = status.quota.addon;
  if (addon && !("error" in addon) && addon.totalCredits !== null && addon.totalCredits > 0) {
    lines.push(`加购剩余 ${credits(addon.remainingCredits)} credits`);
  }
  return lines;
}

/** 页脚只展示剩余额度；无用量时退回套餐状态，无数据则不占位。 */
export function footerLine(status: TokenPlanStatus): string {
  const quota = status.quota;
  if (!quota.ok) return "";
  if (quota.window) return `额度 ${windowLabel(quota.window.window)} 剩 ${percent(remainingOf(quota.window.usedPercent))}`;
  return quota.plan?.status ? `额度 套餐 ${quota.plan.status}` : "";
}

/** 面板「额度」段；传入 periods 时在月用量行后插入近 7 天 / 近 5h 两行（灰色），series 只补 token 合计文字。 */
export function quotaRows(quota: QuotaSnapshot, nowMs: number, periods?: TokenPlanStatus["usagePeriods"], series?: UsageSeries): Row[] {
  if (!quota.ok) return [{ label: "状态", value: quota.error?.message ?? "未授权 · 打开 /tokenplan 授权" }];
  const rows: Row[] = [];
  const plan = quota.plan;
  if (plan) {
    rows.push({ label: "套餐", value: [plan.status ?? DASH, plan.specCode ?? ""].filter(Boolean).join(" · ") });
    if (plan.remainingDays !== null) {
      rows.push({ label: "剩余", value: `${plan.remainingDays} 天${plan.endTime ? ` · 到期 ${plan.endTime}` : ""}` });
    } else if (plan.endTime) {
      rows.push({ label: "到期", value: plan.endTime });
    }
  }
  const view = quota.window;
  if (view) {
    const left = view.resetAtMs === null ? null : view.resetAtMs - nowMs;
    const reset = left !== null && left > 0
      ? `${fmtShortDur(left)} 后重置`
      : view.resetTime
        ? `重置 ${view.resetTime}`
        : "";
    const monthTotal = tokenTotal(series?.tokensMonth);
    // 面板行宽有限：bar 收到 10 格，百分比紧跟其后（`84.0% 已用`），再用 ` · ` 分段；
    // 超预算时先丢「剩 …%」，保住百分比与合计。
    const head = [usageBar(view.usedPercent, 10), `${percent(view.usedPercent)} 已用`].filter(Boolean).join(" ");
    const rest = [`剩 ${percent(remainingOf(view.usedPercent))}`, reset, monthTotal ? `合计 ${monthTotal}` : ""].filter(Boolean);
    const PANEL_ROW_BUDGET = 64;
    const value = [head, ...rest].join(" · ");
    rows.push({
      label: `${windowLabel(view.window)}用量`,
      value: value.length > PANEL_ROW_BUDGET && rest.length > 1 ? [head, ...rest.slice(1)].join(" · ") : value,
      severity: quotaSeverity(view.usedPercent) ?? undefined,
    });
    if (periods) {
      rows.push({ label: "近7天消耗", value: periodValue(periods.week, view.usedPercent, series?.tokens7d), muted: true });
      rows.push({ label: "近5h消耗", value: periodValue(periods.fiveHour, view.usedPercent, series?.tokens5h), muted: true });
    }
  }
  const addon = quota.addon;
  if (addon) {
    rows.push({
      label: "加购",
      value: "error" in addon
        ? addon.error
        : [
            `${credits(addon.remainingCredits)} / ${credits(addon.totalCredits)} credits`,
            addon.usedPercent === null ? "" : `已用 ${percent(addon.usedPercent)}`,
            addon.activeCount === null ? "" : `${addon.activeCount} 个在效`,
          ].filter(Boolean).join(" · "),
    });
  }
  const qwenwork = quota.qwenwork;
  if (qwenwork) {
    rows.push({ label: "Qwenwork", value: "error" in qwenwork ? qwenwork.error : `${credits(qwenwork.credits)} credits` });
  }
  rows.push({ label: "数据源", value: `${quota.source ?? DASH} · ${localStamp(quota.fetchedAt)}`, muted: true });
  return rows;
}

/** 面板「优惠窗口」段：最近窗口 + 窗口内全部模型；qwen 全在前，其余品牌随后，各按折数升序。 */
export function discountRows(discount: DiscountSnapshot, nowMs: number): Row[] {
  const view = nearestWindow(discount, nowMs);
  if (!view) return [];
  const rows: Row[] = [
    {
      // 面板行宽有限：label 只留「夜间折扣 … · 文源 日期」，时段与倒计时移到 value，用 ` · ` 分隔。
      label: view.label.replace(/^Token Plan\s+/, ""),
      value: `${view.start}–${view.end} · ${windowCountdown(view, nowMs)}`,
    },
  ];
  for (const model of orderedModels(view.models)) {
    const prices = [model.effective ? `现价 ${model.effective}` : "", model.regular ? `原价 ${model.regular}` : ""]
      .filter(Boolean)
      .join(" / ");
    rows.push({ label: `  ${model.model}`, value: [prices, model.badge ?? ""].filter(Boolean).join(" · ") || DASH, muted: true });
  }
  return rows;
}
