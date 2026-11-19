// 系统默认浏览器解析（r4 追加）：只读注册表 / LaunchServices / xdg-settings。
// 绝不 spawn 浏览器本身，也不 touch 任何 profile；探测失败一律静默返回 null（调用方退回平台顺序）。

import { spawnSync } from "node:child_process";
import type { BrowserId } from "./types";

/** 单测注入点：返回系统默认浏览器；抛错等同于"无偏好"。 */
export type DefaultBrowserResolver = () => BrowserId | null;

// ProgId（Windows）/ bundle id（macOS）/ .desktop 名（Linux）→ 浏览器。顺序即优先级（operagx 先于 opera）。
const IDENT_RULES: { test: RegExp; id: BrowserId }[] = [
  { test: /operagx/i, id: "opera-gx" },
  { test: /opera/i, id: "opera" },
  { test: /microsoft-?edge|edgemac|msedge/i, id: "edge" },
  { test: /chromium/i, id: "chromium" },
  { test: /chrome/i, id: "chrome" },
  { test: /brave/i, id: "brave" },
  { test: /vivaldi/i, id: "vivaldi" },
  { test: /firefox/i, id: "firefox" },
];

/** 三家平台的标识串统一走一张表：MSEdgeBHTML / com.microsoft.edgemac / microsoft-edge.desktop 都能命中。 */
export function identToBrowser(raw: string): BrowserId | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  for (const r of IDENT_RULES) if (r.test.test(s)) return r.id;
  return null;
}

/** reg query 输出 → ProgId（形如 `ProgId    REG_SZ    MSEdgeBHTML`）。 */
export function parseRegProgId(text: string): string | null {
  const m = /^\s*ProgId\s+REG_SZ\s+(\S+)\s*$/im.exec(String(text ?? ""));
  return m ? m[1] : null;
}

/** 只读探测：2000ms 上限、无 shell、无字符串插值；非 0 退出码算"没探到"。 */
function run(cmd: string, args: string[]): string | null {
  try {
    const r = spawnSync(cmd, args, { encoding: "utf8", timeout: 2000, windowsHide: true });
    return r.status === 0 && typeof r.stdout === "string" ? r.stdout : null;
  } catch {
    return null;
  }
}

const WIN_USER_CHOICE =
  "HKCU\\SOFTWARE\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\https\\UserChoice";

export function resolveDefaultBrowser(): BrowserId | null {
  try {
    if (process.platform === "win32") {
      const out = run("reg", ["query", WIN_USER_CHOICE, "/v", "ProgId"]);
      const progId = out ? parseRegProgId(out) : null;
      return progId ? identToBrowser(progId) : null;
    }
    if (process.platform === "darwin") {
      const out = run("defaults", ["read", "com.apple.LaunchServices/com.apple.launchservices.secure", "LSHandlers"]);
      if (!out) return null;
      // LSHandlers 是字典数组：逐块找 https 那条，再取它声明的应用
      for (const block of out.split("}")) {
        if (!/LSHandlerURLScheme\s*=\s*"?https"?\s*;/i.test(block)) continue;
        const m = /LSHandlerRoleAll\s*=\s*"?([\w.\-]+)"?/i.exec(block);
        if (m) return identToBrowser(m[1]);
      }
      return null;
    }
    const out = run("xdg-settings", ["get", "default-web-browser"]);
    return out && out.trim() ? identToBrowser(out.trim()) : null;
  } catch {
    return null;
  }
}
