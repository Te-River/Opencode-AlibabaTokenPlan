# 给 AI Agent 的安装提示词

把这个文件直接交给 agent，或复制下面「提示词正文」整段。

---

## 提示词正文（复制给 agent）

你是负责在本机安装 OpenCode 插件 `@te-river/opencode-alibabatokenplan` 的 AI agent。目标是让用户在 OpenCode **V2 TUI** 里看到额度与优惠面板，并且不破坏其它插件配置。

### 环境前提

- Windows；OpenCode 2.x（TUI）；npm 已登录（发布者账号才需要）
- 配置目录：`C:\Users\<用户>\.config\opencode\`
- 插件缓存：`C:\Users\<用户>\.cache\opencode\npm\@te-river\`

### 硬规则（违反会导致插件 failed 或完全不显示）

1. **这是 TUI-only 插件**：只能注册在 **`cli.json` 的 `plugins[]`**。
2. **绝对不要**把它写进 `opencode.jsonc` 的 `plugins[]`——server 运行时会加载并标记 `failed`（`/plugins` 里出现红色 Server 条目）。
3. `tui.json` 的 `plugin[]` **不是 V2 的注册点**，不要依赖它（留空即可）。
4. 优先安装**钉住版本**（如 `@0.2.14`）而不是 `@latest`：registry 的 `latest` 元数据经常滞后/卡在 staged 状态。
5. 安装后必须让用户**完全退出 TUI 进程再重开**；只开新会话不会重新加载插件。
6. 不要删除或迁移 `%LOCALAPPDATA%\alibabatokenplan\`（凭证、本地用量历史、浏览器 profile 都在这里）。删除会让用户重新授权。

### 安装步骤

1. 备份配置：
   ```powershell
   $cfg="$env:USERPROFILE\.config\opencode"; $stamp=Get-Date -Format yyyyMMdd-HHmmss
   Copy-Item "$cfg\cli.json" "$cfg\cli.json.bak-$stamp" -Force
   Copy-Item "$cfg\opencode.jsonc" "$cfg\opencode.jsonc.bak-$stamp" -Force
   ```
2. 联网安装钉版（示例版本 `0.2.14`，以实际发布为准）：
   ```powershell
   opencode plugin add "@te-river/opencode-alibabatokenplan@0.2.14"
   ```
   - 若报 404 / tarball Not found：registry 还在传播，等 2–5 分钟后重试；不要改用本地目录长期运行。
3. **清理 `plugin add` 的副作用**：它会自动把包写进 `opencode.jsonc` 的 `plugins[]`。删除这一条，只保留 `cli.json` 中的注册：
   ```powershell
   # 手工编辑，或检查：
   Select-String -Path "$cfg\opencode.jsonc" -Pattern "alibabatokenplan"   # 期望 0 命中
   ```
4. 确认 `cli.json` 只有这一处注册（钉版）：
   ```jsonc
   { "plugins": ["@te-river/opencode-alibabatokenplan@0.2.14"] }
   ```
5. 验证安装产物：
   ```powershell
   Get-ChildItem "$env:USERPROFILE\.cache\opencode\npm\@te-river\opencode-alibabatokenplan@0.2.14" -Directory
   opencode plugin list   # 应出现 @te-river/opencode-alibabatokenplan@0.2.14
   ```

### 让用户做的验收（agent 无法替代）

请用户**完全退出 OpenCode TUI 并重新打开**，然后检查：

1. `/plugins`：**TUI 段**出现 `@te-river/opencode-alibabatokenplan`，**Server 段没有它**（若 Server 段出现红色 failed，回到步骤 3）。
2. `/tokenplan`：标题含版本号（例：`Token Plan 额度与优惠 · v0.2.14`）。
3. 侧栏顺序与内容：
   ```
   月额度 · <N>d<N>h 后重置
   ████████████░░░ 84.0% <月 Token 合计>
   夜间 <倒计时> 后开始
   qwen4-max-preview 0.8 折
   qwen3.8-flash 4 折
   qwen3.8-max 4 折

   近7天消耗
   ████████████▓▓░ -N.N% <7d Token>

   近5h消耗
   ████████████▓░░ -N.N% <5h Token>
   ```
4. 颜色：月百分比按用量变色（<70% 绿 / 70–90% 黄 / ≥90% 红）；7d 叠加段黄色、5h 叠加段青色。

### 常见故障速查

| 现象 | 原因 | 处理 |
|---|---|---|
| `/plugins` 里 Server 段红色 failed | 包被写进 `opencode.jsonc plugins[]` | 删除该条，只留 `cli.json` |
| `/plugins` 完全看不到插件 | 只写了 `tui.json` | 移到 `cli.json plugins[]` |
| `plugin add` 报 404 tarball | registry 传播滞后 | 等待后重试，或换钉版号 |
| 界面还是旧版 | TUI 进程未重启 | 结束进程后重开，确认 `/tokenplan` 版本号 |
| 授权在升级后丢失 | 旧版本把凭证放在 opencode 目录 | ≥0.2.4 已迁移到 `%LOCALAPPDATA%\alibabatokenplan\` |

### 开发本仓库（仅当 agent 需要改代码）

```powershell
cd D:\Github\Opencode-AlibabaTokenPlan
npm install
npm run typecheck
npm test          # node scripts/test.mjs
npm run build     # Babel(solid JSX) + esbuild -> dist/tui.js
npm run smoke     # 加载形状：default = { id, setup }
```

发布前必须四项全绿：`typecheck` / `test` / `build` / `smoke`。发布用 `npm publish`，随后用 `opencode plugin add @…@<新版本>` 安装。

---

## 备注

- 本文件由工程实践总结，重点针对 OpenCode V2 的 TUI-only 插件加载规则。
- 若 OpenCode 后续版本改变 `cli.json` 的插件注册方式，以官方文档 `opencode.ai/docs/plugins` 为准。
