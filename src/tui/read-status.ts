// TUI 只读侧数据源：~/.cache/opencode/alibabatokenplan/status.json（30s 轮询+事件去抖在
// index.tsx 做），缺席/损坏/陈旧 → 内嵌 Qoder 快照降级（契约 §2 读写契约）。

import { buildStatus, readStatusFile, type StatusRead } from "../core/status";
import { windowState } from "../core/rules";
import type { StatusFile } from "../core/types";

export interface StatusView {
  status: StatusFile;
  /** true = status.json 不可用/陈旧，当前渲染的是随包内嵌的 Qoder 静态快照 */
  degraded: boolean;
}

/** m4：stale/降级时不把文件里的绝对 nextBoundaryAt 走字——它可能已落在过去（倒计时冻结 00:00:00）。
 * 改为按各窗口 start/end(HH:MM, tz) 用本地 now 重算下一边界；activeNow/boundaryKind 同步刷新。 */
function recomputeWindows(status: StatusFile, now: Date): StatusFile {
  return {
    ...status,
    windows: status.windows.map((w) => {
      const ws = windowState(w, now);
      return { ...w, activeNow: ws.active, boundaryKind: ws.boundaryKind, nextBoundaryAt: ws.nextBoundaryAt };
    }),
  };
}

/** 随包内嵌降级视图：仅 Qoder 快照（目录置空、catalog 记 snapshot），零网络。 */
export function embeddedSnapshotView(now = new Date()): StatusView {
  const status = buildStatus({ source: "snapshot", models: [], fetchedAt: "embedded" }, now);
  return { status, degraded: true };
}

export function loadStatusView(now = new Date()): StatusView {
  const r: StatusRead = readStatusFile(now);
  switch (r.kind) {
    case "live":
      return { status: r.status, degraded: false };
    case "stale":
      // 陈旧：数据仍可比快照更有信息量时保留窗口结构，但徽标必须转灰；m4 重算边界防倒计时冻结
      return { status: recomputeWindows(r.status, now), degraded: true };
    default:
      // status.json 缺席/损坏降级：与 stale 同规则，用本地 now 重算（内嵌视图虽用 now 构建，
      // 但读取时刻可能已跨过边界，统一按窗口边界重算保持一致）
      return { status: recomputeWindows(embeddedSnapshotView(now).status, now), degraded: true };
  }
}
