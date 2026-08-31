# @te-river/opencode-alibabatokenplan

Opencode 双入口插件（server + TUI）：把阿里云百炼 **Token Plan 优惠雷达**常驻在 Opencode 侧栏/首页 ——
三级动态数据源 + Qoder 逆向快照第四源，合并后原子持久化到 `status.json`，附倒计时、模型倍率、
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
  "sidebar": { "order": 160, "showNonTokenPlan": false }, // 非 Token Plan 会话默认整块隐藏；true=弱化一行
  "toast": true,                                     // 窗口边界翻转提醒（每窗口每日恰 2 次）
  "refresh": { "catalogMin": 10, "quotaMin": 5 }     // server 刷新周期（分钟）
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

## License

MIT © te-river
