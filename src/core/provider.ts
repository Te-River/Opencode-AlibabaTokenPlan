// R2 provider 门控判定（0.1.1）——纯函数，core 层零 opencode 依赖，node 直测。
// family（默认）：阿里系全家族——用户最常用形态是 provider=alibaba-cn（Token Plan 模型挂在其下），
//   严格 token-plan 正则会把这类会话挡在门外，故放宽为 providerID 前缀族 ∪ token-plan/coding 主机 ∪
//   maas.aliyuncs.com / dashscope 域。
// strict：0.1.0 原语义——仅 token-plan 专属 providerID / 专属主机。

export type ProviderMatchMode = "family" | "strict";

const FAMILY_ID_RE = /^alibaba(?:-.*)?$/i; // alibaba / alibaba-cn / alibaba-token-plan-cn / …
const STRICT_ID_RE = /^alibaba-token-plan(?:-[a-z]+)*$/i; // 0.1.0 原正则（含未来区域）
const STRICT_HOST_RE = /^token-plan(?:\.[a-z0-9-]+)*\.maas\.aliyuncs\.com$/i;
const FAMILY_HOST_PREFIX_RE = /^(token-plan|coding)\./i; // token-plan.* / coding.*（maas 端点族）

/** baseURL → host（解析失败按空处理——自定义 provider 可能不带 options.baseURL）。 */
function hostOf(baseURL?: string | null): string {
  if (!baseURL) return "";
  try {
    return new URL(String(baseURL)).host.toLowerCase();
  } catch {
    return "";
  }
}

/** 双判定统一入口：providerID 或 baseURL host 任一命中即 true（两路证据并列，02 报告检测表）。 */
export function matchProvider(
  providerID: string | undefined | null,
  baseURL: string | undefined | null,
  mode: ProviderMatchMode = "family",
): boolean {
  const id = typeof providerID === "string" ? providerID.trim() : "";
  const host = hostOf(baseURL);
  if (mode === "strict") {
    if (STRICT_ID_RE.test(id)) return true;
    return !!host && STRICT_HOST_RE.test(host);
  }
  if (FAMILY_ID_RE.test(id)) return true;
  if (!host) return false;
  return FAMILY_HOST_PREFIX_RE.test(host) || /(?:^|\.)maas\.aliyuncs\.com$/i.test(host) || /dashscope/i.test(host);
}

export function isProviderMatchMode(v: unknown): v is ProviderMatchMode {
  return v === "family" || v === "strict";
}
