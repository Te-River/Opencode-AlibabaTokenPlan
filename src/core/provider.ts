// R2 provider 门控判定（0.1.1）——纯函数，core 层零 opencode 依赖，node 直测。
// family（默认）：阿里系全家族——用户最常用形态是 provider=alibaba-cn（Token Plan 模型挂在其下），
//   严格 token-plan 正则会把这类会话挡在门外，故放宽为 providerID 前缀族 ∪ 全域名锚定的
//   *.maas.aliyuncs.com / *.dashscope[-x].aliyuncs.com 域（r3 起不接受裸前缀/子串匹配）。
// strict：0.1.0 原语义——仅 token-plan 专属 providerID / 专属主机。

export type ProviderMatchMode = "family" | "strict";

const FAMILY_ID_RE = /^alibaba(?:-.+)?$/i; // alibaba / alibaba-cn / alibaba-token-plan-cn / …（alibabaxyz、"alibaba-" 不中）
const STRICT_ID_RE = /^alibaba-token-plan(?:-[a-z]+)*$/i; // 0.1.0 原正则（含未来区域）
const STRICT_HOST_RE = /^token-plan(?:\.[a-z0-9-]+)*\.maas\.aliyuncs\.com$/i;
// r3 Major-2：family 主机判定全域名锚定（review 解锁标准）——只认真实阿里域结构：
//   *.maas.aliyuncs.com（token-plan.<region>. / coding.<region>. 专属端点族）∪
//   dashscope[-<suffix>].aliyuncs.com 及其子域（coding.dashscope. / coding-intl.dashscope.）。
// 前缀/子串式匹配会误伤 coding.net、token-plan.evil.io 等无关供应商，故不再单列 ^(token-plan|coding)\. 分支。
const FAMILY_MAAS_HOST_RE = /(?:^|\.)maas\.aliyuncs\.com$/i;
const FAMILY_DASHSCOPE_HOST_RE = /(?:^|\.)dashscope(?:-[a-z]+)?\.aliyuncs\.com$/i;

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
  return FAMILY_MAAS_HOST_RE.test(host) || FAMILY_DASHSCOPE_HOST_RE.test(host);
}

export function isProviderMatchMode(v: unknown): v is ProviderMatchMode {
  return v === "family" || v === "strict";
}
