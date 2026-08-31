// TUI 只读侧数据源：~/.cache/opencode/alibabatokenplan/status.json（30s 轮询+事件去抖在
// index.tsx 做），缺席/损坏/陈旧 → 内嵌 Qoder 快照降级（契约 §2 读写契约）。

import { buildStatus, readStatusFile, type StatusRead } from "../core/status";
import type { StatusFile } from "../core/types";

export interface StatusView {
  status: StatusFile;
  /** true = status.json 不可用/陈旧，当前渲染的是随包内嵌的 Qoder 静态快照 */
  degraded: boolean;
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
      // 陈旧：数据仍可比快照更有信息量时保留窗口结构，但徽标必须转灰
      return { status: r.status, degraded: true };
    default:
      return embeddedSnapshotView(now);
  }
}
