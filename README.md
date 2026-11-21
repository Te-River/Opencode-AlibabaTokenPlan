# @te-river/opencode-alibabatokenplan

OpenCode **v2 TUI 插件**：把阿里云百炼 Token Plan 的**个人套餐额度**与**优惠窗口雷达**放进同一个面板，
侧栏与页脚各有一行摘要。凭证只存在于 core 内部，界面上永远不出现 token / cookie。

## 安装

只注册 TUI 入口（不再有 server 入口）：

```jsonc
// ~/.config/opencode/tui.json
{
  "plugin": ["@te-river/opencode-alibabatokenplan@latest"]
}
```

重启 OpenCode。首次运行侧栏显示 `额度 未授权 · …`，打开 `/tokenplan`（或命令面板里的
`Token Plan 额度与优惠`）→ 按 `a` → 选中一个可用浏览器 → 在浏览器里登录一次。

## 界面

| 表面 | 内容 |
|---|---|
| `sidebar.content` | 最多 3 行：额度 / 加购剩余 credits / 最近优惠窗口倒计时 |
| `home.footer.status` | 单行：`额度 周 62% · 错峰 5 折 2h13m 后开始`（无数据时不渲染） |
| `prompt.footer.status` | 同款单行，渲染在输入框上方状态区（无数据时不渲染） |
| `prompt.footer.status` | 同一行摘要，挂在输入框下方的状态栏（无数据时不渲染） |
| `/tokenplan` | 同一个面板两段：**额度**（套餐状态 / 规格 / 剩余天数 / 到期 / 用量窗口百分比 / 加购积分 / Qwenwork credits）与**优惠窗口**（窗口时段 + 倒计时 + 模型现价原价 + 文本模型价格 + 公告 + 目录源日期） |

面板内：`a` 授权 / 重新授权，`d` 退出登录（清除凭证），`↑↓` 滚动，`Esc` 关闭。
刷新：每 60 秒一次，另外每轮对话结束后（15 秒内合并）刷新；倒计时是本地每秒 tick，不轮询网络。

## 授权

`/tokenplan` → `a` 会列出 `detect()` 实测到的东西：已安装的浏览器（Edge / Chrome / Brave / Chromium /
Vivaldi / Opera / Firefox）与可用适配器（用已登录会话自动读取、打开专用窗口登录一次、读 Firefox cookie）。
系统默认浏览器排在候选列表第一位，它对应的适配器标为「（推荐）」（Windows 读注册表 `UserChoice`，
macOS `defaults read`，Linux `xdg-settings`）。
选中一个后插件自己拉起浏览器、等你在里面登录，屏幕上显示剩余秒数；`Esc` 取消会中止等待并关掉**它自己启动的**
那个浏览器实例（不会动你日常在用的浏览器）。最长等待 180 秒。

列表最后永远有兜底项「粘贴控制台 Cookie」，适合没有任何可用浏览器的机器：选中后把已登录百炼控制台的
Cookie 串（单行，至少两个 `name=value` 对）粘进对话框，校验通过才落盘；粘贴的内容不回显、不写日志、不进缓存。

凭证落盘用 Windows DPAPI（当前用户），存放在 `%LOCALAPPDATA%\alibabatokenplan\credential.json`——
这个目录不属于 OpenCode 自身的数据目录，**升级 OpenCode 或更新插件不会清掉授权**；旧版本的
`%LOCALAPPDATA%\opencode\alibabatokenplan\` 会在首次启动时自动迁移过来。
系统加密不可用时就只留在内存里，登录成功后会提示「仅本次会话（重启后需重新授权）」。
任何情况下凭证都不会出现在界面文字、toast、日志或 `quota-cache.json` 里。面板里按 `d` 退出登录（清除凭证）。

## 从 0.1.x 迁移

0.2.0 只保留 TUI 入口，以下**已移除**：

- server 插件入口与 `status.json` 落盘；
- 内置 web 面板（`dashboard.autoOpen` / edge `--app` 窗口 / 本地端口）——这个功能整体不存在了，
  等价的详情看 `/tokenplan` 面板；
- v1 的工具与启动 toast；
- `src/tui/read-status.ts`（改为读 `quota-cache.json`）。

需要手动做的两步：

1. 从 `~/.config/opencode/cli.json` 的 `plugins[]` 里**删掉**本包（旧版注册的 server 插件）；
2. 确认它仍在 `~/.config/opencode/tui.json` 的 `plugin[]` 里。

> **第 1 步不做，0.2.0 看起来就是坏的**：CLI 加载器照旧会 import 本包的根导出，而根导出现在是
> `{ id, setup }`，于是继续报 `Invalid V2 TUI plugin module`。这个条目不会自己消失，必须手动删。

若宿主仍加载旧版本，删掉 npm 缓存目录后重启：
`%USERPROFILE%\.cache\opencode\npm\@te-river\opencode-alibabatokenplan@latest\`。

### 状态文件

| 内容 | 位置 | 清除方式 |
|---|---|---|
| 额度缓存（`schemaVersion: 2`，无凭证字段） | `%USERPROFILE%\.cache\opencode\alibabatokenplan\quota-cache.json` | 删文件，下次刷新重建 |
| 凭证（Windows DPAPI 密文） | `%LOCALAPPDATA%\opencode\alibabatokenplan\credential.json` | 面板里按 `d`，或删文件 |
| 插件专用浏览器 profile | `%LOCALAPPDATA%\opencode\alibabatokenplan\browsers\<浏览器 id>\profile` | 关掉 OpenCode 后删目录 |

连授权状态一起清：删掉 `%USERPROFILE%\.cache\opencode\alibabatokenplan\` 与
`%LOCALAPPDATA%\opencode\alibabatokenplan\` 两个目录即可（不会动你日常在用的浏览器 profile）。

## 数据来源

- 额度：外接浏览器授权拿到的会话 Cookie（或手动粘贴的 Cookie）打百炼控制台 API（4 个子调用，任一失败只降级该段）；
  结果按 `schemaVersion: 2` 缓存在 `%USERPROFILE%\.cache\opencode\alibabatokenplan\quota-cache.json`，
  缓存里没有任何凭证字段。
- 优惠：随包快照（`bailian-snapshot`，离线可用），本地纯函数计算窗口与倒计时。
- 失败按类别给文案：未授权 / 登录已过期 / 网络 / 数据无法识别，绝不抛进渲染。

## 开发

```bash
npm install
npm run build      # Babel(solid JSX) → esbuild bundle → dist/tui.js
npm run typecheck  # tsc --noEmit
npm test           # core 单测
npm run smoke      # 加载形状：default 必须是 { id, setup }
```

`dist/tui.js` 是纯 ESM，`default` 导出 `{ id, setup }`（v2 TUI 加载器唯一的接受形状），
JSX 在构建期编译成 `@opentui/solid` 的 `_$` 助手，运行期不装 JSX 编译器。

发布：`npm run publish:check`（build + test + smoke + `npm pack --dry-run`）→ `npm publish`。

给 AI agent 的安装提示词：[`AGENT_INSTALL.md`](./AGENT_INSTALL.md)；用户/Agent 通用安装指南（可复制命令）：[`INSTALL.md`](./INSTALL.md)。

## 未做的部分

- 优惠目录仍是随包快照，不做控制台实时抓取。
