// 额度编排：凭证状态 → 4 个 API → 非致命子调用降级 → 错误分类（03 §4，r3 Δ6）。
// 契约：任何分支都返回 QuotaSnapshot，绝不抛异常（TUI 每 60s 调一次，抛错就成定时炸弹）。

import { classifyError, normalizeAddon, normalizePlan, normalizeQwenwork, pickUsageWindow, unwrap } from "./decode";
import { consoleRequest, credentialSource, probeCredential, type CredentialState } from "./credentials";
import { API, COMMODITY } from "./request";
import type { QuotaError, QuotaErrorKind, QuotaSnapshot, QuotaSource } from "./types";

export interface QuotaFetchDeps {
  request?: (api: string, data: Record<string, unknown>, signal: AbortSignal) => Promise<unknown>;
  credentialState?: () => Promise<CredentialState>;
  source?: () => QuotaSource | null;
  now?: () => Date;
}

/** Δ6 无凭证态文案（TUI 原文，≤120 字）。 */
const NO_CRED_MESSAGE: Partial<Record<QuotaErrorKind, string>> = {
  none: "未授权 · 打开 /tokenplan → 授权（浏览器登一次即完成）",
  "browser-unavailable": "无法自动读取登录态 · 请在 /tokenplan 粘贴 Cookie",
  unauthorized: "登录已过期 · 在 /tokenplan 重新授权",
};

function failed(fetchedAt: string, error: QuotaError): QuotaSnapshot {
  return { ok: false, source: null, fetchedAt, plan: null, window: null, addon: null, qwenwork: null, error };
}

/**
 * 非致命行：解包也必须落在降级边界内 —— HTTP 200 + data.success=false（如
 * Forbidden.AuthorityPolicies.NoPermission）只让这一行变 error，不许把整次快照打成 ok:false
 * （py:269-270 / 285-286 同构：unwrap 在 call_api 内部，异常只降级当次调用）。
 */
function degrade<T>(res: PromiseSettledResult<unknown>, normalize: (raw: unknown) => T): T | { error: string } {
  if (res.status === "rejected") return { error: classifyError(res.reason).message };
  try {
    return normalize(unwrap(res.value));
  } catch (e) {
    return { error: classifyError(e).message };
  }
}

/**
 * 拉一次额度。deps 仅用于单测注入（零网络），生产调用只传 signal。
 * 额度主体（subscription/usage）失败 = 整次失败；addon/qwenwork 失败只降级该行（R2 B9）。
 */
export async function fetchQuota(opts: { signal?: AbortSignal; deps?: QuotaFetchDeps } = {}): Promise<QuotaSnapshot> {
  const deps = opts.deps ?? {};
  const signal = opts.signal ?? new AbortController().signal;
  const fetchedAt = (deps.now ?? (() => new Date()))().toISOString();
  const request = deps.request ?? consoleRequest;

  let state: CredentialState;
  try {
    state = await (deps.credentialState ?? probeCredential)();
  } catch {
    state = "none";
  }
  if (state !== "authorized") {
    const kind: QuotaErrorKind = state === "manual-needed" ? "browser-unavailable" : state === "expired" ? "unauthorized" : "none";
    return failed(fetchedAt, { kind, message: NO_CRED_MESSAGE[kind] ?? NO_CRED_MESSAGE.none! });
  }

  const source = (): QuotaSource | null => deps.source?.() ?? credentialSource();
  try {
    const plan = normalizePlan(unwrap(await request(API.subscription, { queryInstanceInfoRequest: { commodityCode: COMMODITY.solo } }, signal)));
    const window = pickUsageWindow(unwrap(await request(API.usage, {}, signal)));

    const [addonRes, qwenRes] = await Promise.allSettled([
      request(API.addon, { commodityCode: COMMODITY.addon }, signal),
      request(API.qwenwork, {}, signal),
    ]);
    const addon = degrade(addonRes, normalizeAddon);
    const qwenwork = degrade(qwenRes, normalizeQwenwork);

    return { ok: true, source: source(), fetchedAt, plan, window, addon, qwenwork, error: null };
  } catch (e) {
    return failed(fetchedAt, classifyError(e));
  }
}
