// 出界字符串脱敏 —— 所有离开 credentials.ts 的错误串、以及所有进入 QuotaError.message 的
// 服务端消息都必须先过这里（02 §4-5：unwrap 的 message 可能回显 access_token/Cookie）。

const PATTERNS: [RegExp, string][] = [
  [/Bearer\s+[A-Za-z0-9._~+/=-]{6,}/gi, "Bearer ***"],
  // JWT（access_token 常见形态）
  [/eyJ[A-Za-z0-9_-]{7,}\.[A-Za-z0-9_-]{7,}\.[A-Za-z0-9_-]{4,}/g, "***"],
  // key=value / key: value 形式的 token 类键
  [/(("|')?(?:access_token|accessToken|innertoken|innerToken|sessionid|sessionId|ticket|cookie|Cookie|authorization)(?:"|')?\s*[:=]\s*("|')?)([^"'\s,;&}]{6,})/g, "$1***"],
  // Cookie 整串：name=<长值>
  [/([A-Za-z0-9_][A-Za-z0-9_.-]{1,}=)([^;\s"']{12,})/g, "$1***"],
];

/** 抹掉已知凭证形态；非字符串先 String()。不截断（截断由调用方按 120 字处理）。 */
export function redact(value: unknown): string {
  let s: string;
  if (typeof value === "string") s = value;
  else if (value instanceof Error) s = value.message;
  else {
    try {
      s = typeof value === "object" ? JSON.stringify(value) : String(value);
    } catch {
      s = "unserializable error";
    }
  }
  for (const [re, rep] of PATTERNS) s = s.replace(re, rep);
  return s;
}
