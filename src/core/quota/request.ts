// 网关请求构造 —— 纯函数，不含任何凭证（凭证头由 credentials.ts 拼装）。
// 契约来源：02 §B5/B6（py:47,104-153）与 r3 Δ3；Cookie 通道打 /data/api.json，Bearer 通道打 /cli/api.json。

import { randomBytes, randomUUID } from "node:crypto";

export const PAGE_URL = "https://bailian.console.aliyun.com/cn-beijing/subscription/token-plan/personal";
const GATEWAY_ORIGIN = "https://bailian.console.aliyun.com";
const REGION = "cn-beijing";

/** 两条通道（同一网关、不同路径）：Cookie → data，Bearer → cli。 */
const DATA_URL = "https://bailian-cs.console.aliyun.com/data/api.json";
const CLI_URL = "https://bailian-cs.console.aliyun.com/cli/api.json";

export const API = {
  subscription: "zeldaHttp.apikeyMgr./tokenplan/personal/api/v2/subscription",
  usage: "zeldaHttp.apikeyMgr./tokenplan/personal/api/v2/usage",
  addon: "zeldaHttp.apikeyMgr./tokenplan/personal/api/v2/addon/summary",
  qwenwork: "zeldaHttp.apikeyMgr./qwenwork/tokenplan/personal/api/v1/qwenwork_details",
  /** 服务端遥测小时序列（近 7 天 / 近 5h token 用量的唯一来源）。 */
  modelMonitor: "zeldaEasy.bailian-telemetry.platform-model.getModelMonitorDataWithOss",
} as const;

/** 商品码（md:480-483）：个人 CN 用 _public_cn 后缀。 */
export const COMMODITY = {
  solo: "sfm_tokenplansolo_public_cn",
  addon: "sfm_tokenplansoloaddon_public_cn",
} as const;

/** cornerstoneParam 整块必填（py:62-77）；每次调用新生成 feTraceId / X-Anonymous-Id。 */
export function buildCornerstone(): Record<string, unknown> {
  return {
    feTraceId: randomUUID(),
    feURL: PAGE_URL,
    protocol: "V2",
    console: "ONE_CONSOLE",
    productCode: "p_efm",
    switchUserType: 3, // 数字，不是字符串
    domain: "bailian.console.aliyun.com",
    consoleSite: "BAILIAN_ALIYUN",
    xsp_lang: "zh-CN",
    "X-Anonymous-Id": randomBytes(18).toString("base64").replace(/[^A-Za-z0-9]/g, "").slice(0, 24).padEnd(24, "0"),
  };
}

export function buildGatewayUrl(api: string, channel: "data" | "cli" = "data"): string {
  const q = new URLSearchParams({ action: "BroadScopeAspnGateway", product: "sfm_bailian", api, _v: "" });
  return `${channel === "cli" ? CLI_URL : DATA_URL}?${q.toString()}`;
}

/**
 * form body：params=<JSON> + region（py:110-126，urlencode 同 URLSearchParams）。
 * secToken 由调用方从环境读出后传入（本模块不读 env）；缺省时整个 sec_token 字段不带（py:114-116）。
 */
export function buildRequestBody(api: string, data: Record<string, unknown>, secToken?: string): string {
  const params = { Api: api, V: "1.0", Data: { ...data, cornerstoneParam: buildCornerstone() } };
  const form: Record<string, string> = { params: JSON.stringify(params), region: REGION };
  if (secToken) form.sec_token = secToken;
  return new URLSearchParams(form).toString();
}

/** 两条通道共用的非凭证头（Cookie / Authorization 由 credentials.ts 追加）。 */
export function baseHeaders(): Record<string, string> {
  return {
    Origin: GATEWAY_ORIGIN,
    Referer: PAGE_URL,
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "application/json",
    "User-Agent": "token-plan-quota/1.0",
  };
}
