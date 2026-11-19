// 额度缓存 quota-cache.json —— 结构性无凭证：写入/读回都逐字段重建对象，绝不做对象展开透传。
// 路径沿用 status.ts 的 stateDir()（~/.cache/opencode/alibabatokenplan），schemaVersion=2（03 §3）。

import * as fs from "node:fs";
import * as path from "node:path";
import { stateDir } from "./status";
import type { QuotaSnapshot } from "./quota/types";

export const QUOTA_CACHE_SCHEMA = 2;
export const QUOTA_CACHE_CAP = 64 * 1024; // 额度快照理论 <4KB，上限只防异常膨胀

export function quotaCachePath(): string {
  return path.join(stateDir(), "quota-cache.json");
}

/** 只挑已知字段：任何额外字段（尤其凭证）都进不了落盘对象。 */
function projectQuota(s: QuotaSnapshot): QuotaSnapshot {
  const addon = s.addon && "error" in s.addon ? { error: String(s.addon.error) } : (s.addon ?? null);
  const qwenwork = s.qwenwork && "error" in s.qwenwork ? { error: String(s.qwenwork.error) } : (s.qwenwork ?? null);
  return {
    ok: !!s.ok,
    source: s.source ?? null,
    fetchedAt: String(s.fetchedAt ?? ""),
    plan: s.plan
      ? {
          status: s.plan.status ?? null,
          specCode: s.plan.specCode ?? null,
          remainingDays: s.plan.remainingDays ?? null,
          endTime: s.plan.endTime ?? null,
          endAtMs: s.plan.endAtMs ?? null,
        }
      : null,
    window: s.window
      ? {
          window: s.window.window,
          usedPercent: s.window.usedPercent,
          remainingPercent: s.window.remainingPercent,
          resetTime: s.window.resetTime ?? null,
          resetAtMs: s.window.resetAtMs ?? null,
        }
      : null,
    addon,
    qwenwork,
    error: s.error ? { kind: s.error.kind, message: String(s.error.message) } : null,
  };
}

export async function writeQuotaCache(snap: QuotaSnapshot): Promise<boolean> {
  try {
    const dir = stateDir();
    await fs.promises.mkdir(dir, { recursive: true });
    const payload = JSON.stringify({
      schemaVersion: QUOTA_CACHE_SCHEMA,
      writtenBy: "@te-river/opencode-alibabatokenplan/tui@0.2.0",
      fetchedAt: snap.fetchedAt,
      quota: projectQuota(snap),
    });
    if (Buffer.byteLength(payload, "utf8") > QUOTA_CACHE_CAP) return false;
    const tmp = path.join(dir, "quota-cache.json.tmp");
    await fs.promises.writeFile(tmp, payload);
    await fs.promises.rename(tmp, quotaCachePath()); // 同卷 rename = 原子替换
    return true;
  } catch {
    return false; // 缓存是加成不是依赖：写不了就静默，下轮再试
  }
}

/** 读缓存：schemaVersion≠2 / 坏 JSON / 形状不符 → null（调用方落到"未授权"或骨架页）。 */
export async function readQuotaCache(): Promise<QuotaSnapshot | null> {
  let parsed: any;
  try {
    parsed = JSON.parse(await fs.promises.readFile(quotaCachePath(), "utf8"));
  } catch {
    return null;
  }
  if (!parsed || parsed.schemaVersion !== QUOTA_CACHE_SCHEMA || !parsed.quota || typeof parsed.quota !== "object") return null;
  // 回放数据一律标 cache：UI 绝不可把陈旧快照当成本轮实时结果展示
  return { ...projectQuota(parsed.quota as QuotaSnapshot), source: "cache" };
}
