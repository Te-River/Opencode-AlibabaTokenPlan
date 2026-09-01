# @te-river/opencode-alibabatokenplan

Opencode 双入口插件（server + TUI）：把阿里云百炼 **Token Plan 优惠雷达**常驻在 Opencode 侧栏/首页 ——
三级动态数据源 + Qoder 快照第四源（来源：Qoder 客户端公开界面快照转录 2026-08-31），合并后原子持久化到 `status.json`，附倒计时、模型倍率、
`/tokenplan` 分类明细、边界 toast 与查询工具。

> 📸 截图位（文字版）
> ```
> ┌ Token Plan 优惠雷达（sidebar_content · order 160）────────┐
> │ Token Plan 优惠   实时 20:15 · Qoder快照08-31              │
> │ ▸ 错峰 5 折（Off-Peak 50% off） 22:00–08:00 0.25x          │
> │   03:47:12 后开始                                           │
> │ 当前 qwen3.8-max  0̶.̶5̶x̶ 0.25x 错峰 5 折                    │
> │ 目录夜间优惠 · 距 1h45m 开始                                │
> │ 折叠态点击标题切换（kv: atp.collapsed）                     │
> └────────────────────────────────────────────────────────────┘
> home_bottom: 错峰 22:00–08:00 · qwen3.8-max×0.5/×0.25 · 距开始 5h23m · 源:Qoder快照08-31
> ```

## 安装（两行手工注册）

`~/.config/opencode/opencode.jsonc` → `"plugin"` 数组追加一条：

```jsonc
// ~/.config/opencode/opencode.jsonc  →  "plugin": [ …原有条目…, "@te-river/opencode-alibabatokenplan@latest" ]
```

`~/.config/opencode/tui.json` → `"plugin"` 数组追加**同一字符串**：

```json
// ~/.config/opencode/tui.json        →  { "$schema": "https://opencode.ai/tui.json",
//   "plugin": [ "@slkiser/opencode-quota@latest", "@te-river/opencode-alibabatokenplan@latest" ] }
```

无 postinstall 魔法；两个入口都吃同一份 `~/.cache/opencode/alibabatokenplan/status.json`。

## 数据源与隐私声明

- **百炼目录三级回退（零登录）**：公开控制台匿名接口（live）→ 本机 `bl model list`（cli）→ 随包内置快照（snapshot）。
  实时额度可选走 `bl usage token-plan`（需 `bl auth login --console --console-site domestic`）。
- **Qoder 数据 = 2026-08-31 静态快照**：全部优惠规则/倍率以常量形式内嵌（`src/core/qoder-snapshot.ts`），
  **不调用任何 Qoder 私有端点**（包内 0 处相关 fetch 代码）；展示一律带「截至 2026-08-31」标注，
  过期公告位会显示「快照可能失效」。快照更新流程：修订该文件 → `npm run build && npm test` → 重发版。
- 两套单位（Qoder Credits 倍率 / 百炼 ¥ 价格倍率）**永不互算**，各居其 facet；仅 (模型,窗口,倍率,单位)
  全等才合并为「双源印证」行。1 元 = 250 Credits 仅为展示换算注记（据百炼计费示例验证，非官方汇率）。
- 与旧版 `bailian-discount-panel.ts` 兼容：`bailian_discounts` 工具保留（委托到新名
  `tokenplan_discounts`）；旧缓存 `~/.cache/opencode/bailian-discount-cache.json` 首启自动迁移。

## 配置（可选）

`~/.config/opencode/alibabatokenplan/config.jsonc`（server + TUI 同读；缺失/坏 = 全默认）：

```jsonc
{
  "webpanel": { "enabled": false, "port": 7777 },   // 本地 HTTP 面板（默认关；样式见随包 src/server/panel.html）
  "sidebar": { "order": 160, "showNonTokenPlan": false }, // 非匹配会话默认整块隐藏；true=弱化一行
  "toast": true,                                     // 窗口边界翻转提醒（每窗口每日恰 2 次）
  "refresh": { "catalogMin": 10, "quotaMin": 5 },    // server 刷新周期（分钟）
  "providerMatch": "family"                          // TUI 门控：family=阿里系全家族（alibaba-cn 亦显示，默认）；strict=仅 token-plan 专属
                                                     // 主机判定为完整域名锚定：仅 *.maas.aliyuncs.com / dashscope[-x].aliyuncs.com 及其子域命中，coding.net 等前缀撞车域不误判
}
```

status.json schema、陈旧降级（`staleAfterSec`/坏 JSON/缺席 → TUI 内嵌快照+灰徽标）见包内架构契约。

## 开发

```bash
npm install        # devDeps: esbuild/typescript/@types/node/@opencode-ai/plugin
npm run typecheck  # tsc --noEmit
npm run build      # esbuild → dist/server.js dist/tui.js dist/core.mjs（packages:external）
npm test           # 零宿主单测（回退链/合并/跨午夜/JSONC/陈旧判定）
npm run smoke      # 零宿主冒烟：窗口断言(23:30/15:00 注入 now)+status.json 落盘
npm run publish:check
```

## Changelog

### 0.1.2

- **修复：多实例宿主（桌面版）下插件命令/工具丢失（守卫只挡副作用，hooks 每实例返回）**——桌面版同一 server 进程会按 workspace/实例多次调用 `plugin()`，0.1.1 的双实例守卫让第二次之后的调用拿到无 hooks 存根，`/tokenplan` 命令与查询工具在后启实例里静默消失。现在守卫只保护进程级副作用（状态落盘/后台刷新/定时器/面板，仅首启执行、dispose 也仅首启实例真清理），配置解析与完整 hooks（config / command.execute.before / tool / dispose）每次实例化都返回。

### 0.1.1

- **桌面端确定性命令**：`/tokenplan` 经 server 侧 `command.execute.before` 拦截，优惠摘要（窗口状态+倒计时、在卖倍率、限时优惠、来源与截至声明、时区）由插件直接写入当前会话转录（`ignored` 部分对用户可见、不进模型上下文），模型仅回一句确认——Opencode 桌面版（Electron，不渲染 TUI 插件层）从此可见；支持可选模型名过滤（`/tokenplan qwen3.8-max`）。hook 失败时回退旧「经 LLM 调工具」模板，不炸命令。
- **门控放宽**：新增 `providerMatch` 配置（默认 `family`）——TUI sidebar/home_bottom 门控从「仅 token-plan 专属 provider/主机」放宽为「阿里系全家族」，provider=`alibaba-cn` 会话也显示；`strict` 保持 0.1.0 语义。桌面命令不受门控限制（显式调用总是可用，非阿里系供应商时输出行首注明）。

### 0.1.0（初版要点）

- server + TUI 双入口：百炼目录三级回退（live→cli→snapshot）+ Qoder 静态快照并入，原子持久化 `status.json`（`staleAfterSec` 陈旧降级 + 灰徽标）。
- TUI：sidebar 优惠面板 / 折叠、home_bottom 一行摘要、`/tokenplan` 分类明细对话框，秒级本地倒计时。
- 边界 toast（双源同窗只弹一次）、`tokenplan_discounts` 查询工具（旧名 `bailian_discounts` 委托）、可选本地 web 面板（默认关）。
- Qoder 数据为纯静态快照（来源：Qoder 客户端公开界面快照转录 2026-08-31），不调用任何 Qoder 私有端点。

## License

MIT © te-river
