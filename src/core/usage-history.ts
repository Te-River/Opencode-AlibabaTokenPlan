// 本地用量采样 —— 服务端只给月度百分比（无 history/trend 端点），7 天 / 5 小时额度条的差值只能靠本地定时采样差分。
// 边界：与凭证同一状态根（browsers.stateRoot），只落 at/usedPercent/remainingPercent 三个标量，无任何凭证字段。
// 服务端遥测序列只贡献 token 合计文字（usage-series.ts），不参与这里的条。

import * as fs from "node:fs";
import * as path from "node:path";
import { stateRoot } from "./quota/browsers";

export interface UsageSample {
  at: number; // 采样时刻（epoch ms）
  usedPercent: number; // 0–100
  remainingPercent: number; // 0–100
}

/** 一个窗口内的用量增量：最早样本 → 窗口内最新样本。 */
export interface PeriodUsage {
  usedPercent: number; // 窗口内增量，≥0
  since: number | null; // 窗口内最早样本时刻；无样本 = null
  samples: number; // 窗口内样本数
}

const SCHEMA_VERSION = 1;
const KEEP_MS = 8 * 24 * 60 * 60 * 1000; // 保留 8 天：7 天窗口之外再留 1 天余量
const MAX_SAMPLES = 2000;

export function usageHistoryPath(): string {
  return path.join(stateRoot(), "usage-history.json");
}

function isSample(value: unknown): value is UsageSample {
  if (!value || typeof value !== "object") return false;
  const s = value as Record<string, unknown>;
  return (
    typeof s.at === "number" && Number.isFinite(s.at) &&
    typeof s.usedPercent === "number" && Number.isFinite(s.usedPercent) &&
    typeof s.remainingPercent === "number" && Number.isFinite(s.remainingPercent)
  );
}

/** 读历史：文件缺失 / 坏 JSON / 形状不符 → []（历史不是关键路径，绝不抛）。 */
export function readUsageHistory(): UsageSample[] {
  try {
    const parsed = JSON.parse(fs.readFileSync(usageHistoryPath(), "utf8"));
    if (!parsed || parsed.schemaVersion !== SCHEMA_VERSION || !Array.isArray(parsed.samples)) return [];
    return parsed.samples
      .filter(isSample)
      .map((s) => ({ at: s.at, usedPercent: s.usedPercent, remainingPercent: s.remainingPercent }))
      .sort((a, b) => a.at - b.at);
  } catch {
    return [];
  }
}

/** 落一条采样：同 ms 覆盖、按 at 排序、裁剪 8 天与 2000 条上限；写失败静默（下一轮再试）。 */
export function recordUsageSample(sample: UsageSample): void {
  const entry = { at: sample.at, usedPercent: sample.usedPercent, remainingPercent: sample.remainingPercent };
  if (!isSample(entry)) return;
  try {
    const cutoff = entry.at - KEEP_MS;
    const samples = readUsageHistory()
      .filter((s) => s.at >= cutoff && s.at !== entry.at)
      .concat(entry)
      .sort((a, b) => a.at - b.at)
      .slice(-MAX_SAMPLES);
    const file = usageHistoryPath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ schemaVersion: SCHEMA_VERSION, samples }));
    fs.renameSync(tmp, file); // 同卷 rename = 原子替换
  } catch {
    // 历史只是加成不是依赖：写不了就静默
  }
}

/**
 * 窗口内增量：取窗口内最早与最新样本，delta = max(0, 最新 − 最早)。
 * 最新样本即刚写入的当前值；无样本 → 0（调用方据此显示「数据采集中」）。
 */
export function periodUsage(history: UsageSample[], nowMs: number, windowMs: number): PeriodUsage {
  const sinceMs = nowMs - windowMs;
  const inWindow = history.filter((s) => s.at >= sinceMs && s.at <= nowMs);
  if (inWindow.length === 0) return { usedPercent: 0, since: null, samples: 0 };
  let first = inWindow[0];
  let last = inWindow[0];
  for (const s of inWindow) {
    if (s.at < first.at) first = s;
    if (s.at >= last.at) last = s;
  }
  const delta = Math.round(Math.max(0, last.usedPercent - first.usedPercent) * 100) / 100; // 与 usedPercent 同为 2 位小数
  return { usedPercent: delta, since: first.at, samples: inWindow.length };
}
