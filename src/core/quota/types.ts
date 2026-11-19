// 额度数据模型 —— 纯类型、零运行时（顶层无 import，构建产物为空）。
// 字段/单位逐条对应 02 §B8（py:156-302）与 03 §3；单位约定：per*Percentage 为 0–1 比例，
// usedPercent/remainingPercent 为已 ×100 并保留 2 位小数的 0–100 数，credits 为整数（非元、不可换算 token）。

export type QuotaWindowKey = "5h" | "week" | "month";

/** 凭证来源（r4 Δ7：浏览器会话 / Firefox / 手动粘贴 / bl 旁路 / 缓存回放）。 */
export type QuotaSource = "browser-session" | "firefox" | "manual" | "bl" | "cache";

/** 错误分类（r3 Δ7 九值，r4 Δ7 沿用不改）。 */
export type QuotaErrorKind =
  | "none"
  | "browser-unavailable"
  | "login-timeout"
  | "unauthorized"
  | "cookie-store-unavailable"
  | "network"
  | "parse"
  | "paste-invalid"
  | "unknown";

export type BrowserId = "edge" | "chrome" | "brave" | "chromium" | "vivaldi" | "opera-gx" | "opera" | "firefox";
export type BrowserFamily = "chromium" | "firefox";
export type AdapterId = "cdp-own-profile" | "firefox-sqlite" | "manual-paste" | "bl";

export interface QuotaWindow {
  window: QuotaWindowKey; // pick_usage_window 命中的键（week > month > 5h）
  usedPercent: number; // 0–100，2 位小数
  remainingPercent: number; // 0–100，2 位小数
  resetTime: string | null; // "YYYY-MM-DD HH:MM:SS"（本地时区，02 format_ts）
  resetAtMs: number | null; // TUI 秒级倒计时用；无法解析=null
}

export interface QuotaPlan {
  status: string | null; // status 原文（subStatus 仅作缺省回退）
  specCode: string | null; // "sfm_tokenplansolo_public_cn" 等
  remainingDays: number | null;
  endTime: string | null; // 格式化串；套餐无剩余绝对额度，只有百分比
  endAtMs: number | null;
}

export interface QuotaAddon {
  totalCredits: number | null;
  remainingCredits: number | null;
  activeCount: number | null;
  usedPercent: number | null; // 0–100
}

export interface QuotaError {
  kind: QuotaErrorKind;
  message: string; // 已过 redact()，≤120 字
}

export interface QuotaSnapshot {
  ok: boolean;
  source: QuotaSource | null; // 无凭证 = null
  fetchedAt: string; // ISO
  plan: QuotaPlan | null; // 子调用失败 → null（非致命）
  window: QuotaWindow | null; // 三窗口皆无 → null
  addon: QuotaAddon | { error: string } | null;
  qwenwork: { credits: number | null } | { error: string } | null;
  error: QuotaError | null; // ok=false 时非空
}

/** 探测结果：路径表 + 本机可行适配器 + 用户固定首选（r4 Δ3）。 */
export interface BrowserCandidate {
  id: BrowserId;
  label: string; // "Microsoft Edge"
  exe: string; // 已存在的绝对路径
  userDataDir: string | null; // firefox=第一个 profile 目录；chromium 恒 null（真实 profile 从不枚举）
  family: BrowserFamily;
}

export interface DetectedAdapters {
  browsers: BrowserCandidate[]; // 系统默认浏览器置顶，其余按平台顺序，仅"存在"者
  adapters: AdapterId[]; // 本机可行适配器，首选置顶
  preferred: AdapterId | null; // 首选（推荐）适配器；无浏览器时可仍是 manual-paste
  canUseSqlite: boolean; // bun:sqlite / node:sqlite 是否可用
}
