// 合并状态模型 —— 额度快照 + 优惠快照 → 一个 TokenPlanStatus（03 §3，逐字照此实现）。
// 优惠侧不新造形状：全部取自既有 buildStatus()（status.ts:215）的产物，保证 v1 的窗口/价格/徽标语义不变。

import { BAILIAN_SNAPSHOT_AT, bailianSnapshotModels } from "./bailian-snapshot";
import type { QuotaSnapshot } from "./quota/types";
import type { PersonalPlanOffers } from "./discount-doc";
import { buildStatus } from "./status";
import type { DiscountEntry, OfferRule, StatusFile, WindowView } from "./types";
import type { PeriodUsage } from "./usage-history";
import type { UsageSeries } from "./usage-series";

/** 优惠侧快照：唯一目录源 bailian-snapshot（离线可用），形状全部复用 types.ts。 */
export interface DiscountSnapshot {
  catalog: "bailian-snapshot";
  snapshotDate: string;
  windows: WindowView[];
  offers: OfferRule[];
  discounts: DiscountEntry[];
  textModels: StatusFile["textModels"];
  notices: StatusFile["notices"];
}

export interface TokenPlanStatus {
  schemaVersion: 2;
  updatedAt: string;
  quota: QuotaSnapshot;
  discount: DiscountSnapshot;
  /** 本地采样差分出的周期用量（近 7 天 / 近 5 小时）：额度条用；没有月度窗口时为 undefined（不占行）。 */
  usagePeriods?: { week: PeriodUsage; fiveHour: PeriodUsage };
  /** 服务端 token 合计（月 / 近 7 天 / 近 5h）：只做行尾文字；取数失败时为 undefined（不显示合计）。 */
  usageSeries?: UsageSeries;
}

/**
 * 优惠侧快照（纯函数）。
 * 说明：03 §3 示例写 `models: []`，但空目录会连带清空 textModels（价格/折扣徽标表是「优惠雷达」的主体），
 * 故这里传随包内嵌目录 bailianSnapshotModels()，与 v1 snapshot 源完全一致（03 §12 High 假设）。
 */
export function buildDiscountSnapshot(now: Date = new Date(), document?: PersonalPlanOffers): DiscountSnapshot {
  const st = buildStatus(
    { source: "snapshot", models: bailianSnapshotModels(), fetchedAt: BAILIAN_SNAPSHOT_AT },
    now,
    undefined,
    document?.offers ?? [],
  );
  return {
    catalog: "bailian-snapshot",
    snapshotDate: document?.fetchedAt.slice(0, 10) ?? BAILIAN_SNAPSHOT_AT,
    windows: st.windows,
    offers: st.offers,
    discounts: st.discounts,
    textModels: st.textModels,
    notices: st.notices,
  };
}

export function buildMergedStatus(
  quota: QuotaSnapshot,
  now: Date = new Date(),
  document?: PersonalPlanOffers,
  periods?: TokenPlanStatus["usagePeriods"],
  series?: UsageSeries | null,
): TokenPlanStatus {
  const status: TokenPlanStatus = {
    schemaVersion: 2,
    updatedAt: now.toISOString(),
    quota,
    discount: buildDiscountSnapshot(now, document),
  };
  if (periods) status.usagePeriods = periods;
  if (series) status.usageSeries = series;
  return status;
}
