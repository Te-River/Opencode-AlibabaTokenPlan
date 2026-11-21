# 安装指南（用户 / AI Agent 通用）

插件：`@te-river/opencode-alibabatokenplan`
适用：**OpenCode V2 TUI**（Windows / macOS / Linux）
作用：侧栏与 `/tokenplan` 面板显示百炼 Token Plan 的额度、近 7 天 / 近 5 小时消耗与模型折扣。

> 本文里的命令可以直接复制执行。AI Agent 请完整阅读「Agent 专用提示词」一节后再动手。

---

## 一、用户安装（3 步）

### 1. 安装指定版本

```powershell
opencode plugin add "@te-river/opencode-alibabatokenplan@0.2.23"
```

> 如果提示 404 / tarball Not found，是 npm registry 还在同步，等 2–5 分钟重试。

### 2. 检查配置位置（重要）

安装命令可能会把包写进 `opencode.jsonc`，但这是 **TUI-only 插件**，只能注册在 `cli.json`：

```powershell
$cfg = "$env:USERPROFILE\.config\opencode"
Select-String -Path "$cfg\opencode.jsonc" -Pattern "alibabatokenplan"   # 期望：无输出
```

如果 `opencode.jsonc` 里出现了这一行，**删除它**。然后确认 `cli.json`：

```jsonc
// ~/.config/opencode/cli.json
{
  "plugins": ["@te-river/opencode-alibabatokenplan@0.2.23"]
}
```

`tui.json` 的 `plugin[]` 保持为空即可（V2 不以它作为插件注册点）。

### 3. 完全重启 TUI

结束 OpenCode 进程后重新打开（只开新会话不会重新加载插件）。验证：

- `/plugins` → **TUI 段**有该插件，**Server 段没有它**（Server 段出现红色 failed 说明第 2 步没删干净）；
- `/tokenplan` → 标题显示 `Token Plan 额度与优惠 · v0.2.23`；
- 侧栏出现额度条与模型折扣。

首次使用需要在面板里按 `a` 授权一次（外接浏览器登录百炼控制台）。凭证用 DPAPI 加密保存在
`%LOCALAPPDATA%\alibabatokenplan\`，升级/重启不会丢失。

---

## 二、Agent 专用提示词（整段复制给 agent）

```text
你是负责在本机安装 OpenCode 插件 @te-river/opencode-alibabatokenplan 的 AI agent。
目标：让用户在 OpenCode V2 TUI 中看到额度与优惠面板，且不破坏其它插件配置。

环境
- 配置目录：~/.config/opencode/（Windows: %USERPROFILE%\.config\opencode\）
- 插件缓存：~/.cache/opencode/npm/@te-river/

硬规则（违反会导致插件 failed 或不显示）
1. 这是 TUI-only 插件，只能注册在 cli.json 的 plugins[]。
2. 绝对不要写进 opencode.jsonc 的 plugins[]：server 运行时会加载它并标记 failed。
3. tui.json 的 plugin[] 不是 V2 注册点，保持为空。
4. 优先安装钉住版本（如 0.2.23），不要依赖 @latest（registry 元数据经常滞后）。
5. 安装后必须让用户完全退出 TUI 进程再重开；新会话不会重载插件。
6. 不要删除 ~/.local/share/... 或 %LOCALAPPDATA%\alibabatokenplan\：凭证/本地用量历史/浏览器 profile 在里面。

步骤
1) 备份配置：
   cp ~/.config/opencode/cli.json ~/.config/opencode/cli.json.bak-$(date +%s)
   cp ~/.config/opencode/opencode.jsonc ~/.config/opencode/opencode.jsonc.bak-$(date +%s)
   （Windows 用 Copy-Item，时间戳用 Get-Date -Format yyyyMMdd-HHmmss）

2) 安装：
   opencode plugin add "@te-river/opencode-alibabatokenplan@0.2.23"
   若 404/tarball Not found：等待 2–5 分钟重试，不要改用本地目录长期运行。

3) 清理副作用：
   - 若 opencode.jsonc 的 plugins[] 出现该包：删除该行。
   - 确认 cli.json 的 plugins[] 含 "@te-river/opencode-alibabatokenplan@0.2.23"。
   - 确认 tui.json 的 plugin[] 为空。

4) 验证安装：
   opencode plugin list        # 应出现 @te-river/opencode-alibabatokenplan@0.2.23
   检查缓存目录存在：~/.cache/opencode/npm/@te-river/opencode-alibabatokenplan@0.2.23/

5) 让用户完全退出并重开 TUI，然后检查：
   - /plugins：TUI 段有该插件，Server 段没有它；
   - /tokenplan：标题含版本号 v0.2.23；
   - 侧栏：月额度条（未用白色实心、已用灰色虚、百分比按用量变色），近7天/近5h 消耗条（周期段黄/青）。

常见故障
- Server 段红色 failed：包被写进了 opencode.jsonc，删除后重启。
- 完全看不到插件：只写了 tui.json，移到 cli.json。
- 界面还是旧版：TUI 进程未真正退出，看 /tokenplan 标题版本号确认。
- 授权在升级后丢失：0.2.4+ 已把凭证迁到 %LOCALAPPDATA%\alibabatokenplan\，重新授权一次即可持久。
- 侧栏颜色全白：终端/主题不支持该色值，反馈给插件作者（不要自行改配色）。

限制
- 不要用 computeruse 驱动用户桌面；不要打印任何 cookie/token。
- 不要修改与本插件无关的插件配置。
```

---

## 三、更新 / 回退

```powershell
# 更新：显式安装新钉版（推荐）
opencode plugin add "@te-river/opencode-alibabatokenplan@<新版本>"
# 然后清理 opencode.jsonc 中可能新增的条目，改 cli.json 钉版，完全重启 TUI

# 回退：把 cli.json 的版本改为已安装的旧版本，重启 TUI
# 已安装版本列表：
Get-ChildItem "$env:USERPROFILE\.cache\opencode\npm\@te-river" -Directory
```

---

## 四、开发与发布（仓库维护者）

```powershell
npm install
npm run typecheck   # tsc --noEmit
npm test            # node scripts/test.mjs（95 条）
npm run build       # Babel(solid JSX) + esbuild → dist/tui.js
npm run smoke       # 加载形状：default 必须是 { id, setup }
```

发布前四项必须全绿。发布后把 `cli.json` 钉到新版本，并完全重启 TUI 验证。

---

## 五、数据与隐私

- 凭证：Windows DPAPI 加密存于 `%LOCALAPPDATA%\alibabatokenplan\credential.json`，永不进入日志/UI/缓存。
- 本地用量历史：`usage-history.json`（8 天、仅 at/usedPercent/remainingPercent）。
- Token 合计：来自百炼官方控制台接口（`getModelMonitorDataWithOss`），不保存原始数据。
