# Changelog

All notable changes to this project will be documented in this file.
格式参照 https://keepachangelog.com/zh-CN/1.1.0/

## [0.2.14] - 2026-11-19

### Added
- 服务端小时级用量：通过 `getModelMonitorDataWithOss` 拉取近 7 天 / 近 5 小时 Token 合计（月合计用计费月起点查询）
- 侧栏/面板显示三段用量：月额度、近 7 天消耗、近 5 小时消耗；周期消耗来自本地 credit 采样，Token 合计来自服务端
- 7 天/5 小时叠加段使用不同颜色（黄/青），本月已用段为灰色

### Changed
- 侧栏改为两行式指标（标题行 + 条/数值行），顺序：月额度 → 倒计时 → 模型优惠 → 近7天 → 近5h
- 百分比固定一位小数；周期消耗显示为负号（`-0.0%`）；Token 单位使用 `Token`

### Fixed
- 侧栏 `span` 取色属性（`fg`）与小数百分比识别，额度色不再回退为白色
- 面板行 label 超长时与 value 黏连

## [0.2.9] - 2026-11-19

### Added
- 侧栏与 `/tokenplan` 新增三条用量进度条：**月额度 → 近 7 天 → 近 5h**；周期用量以叠加段（`▓`）显示在月度条上，并标注 `+N.N%`
- 近 7 天 / 近 5h 用量使用**本地采样**（每次成功刷新落一条，保留 8 天；无历史时显示“数据采集中”）；服务端无对应时间序列接口（已实测：`usage` 仅月窗口，`subscription` 无 `codingPlanQuotaInfo`）
- 面板标题显示构建版本（`Token Plan 额度与优惠 · vX.Y.Z`），可据此判断 TUI 是否加载了新版本

### Changed
- 侧栏顺序固定为：月额度 → 优惠窗口倒计时 → 近 7 天 → 近 5h → 模型优惠（≤3）→ 加购
- 百分比固定一位小数（如 `82.6%`、`17.4%`）
- 额度进度条与百分比按用量分档着色：`<70%` 绿、`70–90%` 黄、`≥90%` 红；模型优惠保持灰色小字
- 面板优惠段显示窗口内全部模型，qwen 优先排在最前
- 侧栏模型优惠最多 3 行，qwen 优先，不足时用其他品牌补齐

## [0.2.4] - 2026-11-19

### Added
- 优惠与模型折扣改为**实时解析官方文档**（`help.aliyun.com/.../token-plan-personal-overview`）：模型、折扣、时段随官方页面变化，不再使用过期静态快照（当前实测 qwen3.8-max/flash 4 折、DeepSeek 4 款 5 折、qwen4-max-preview 叠加 0.8 折）
- 侧栏与面板额度用量增加终端长条进度条（`█/░`，固定 16 格，按实时百分比绘制）
- 登录/粘贴授权成功后显示凭证存储状态：`已加密保存` 或 `仅本次会话（重启后需重新授权）`

### Changed
- 页脚只显示剩余额度（`额度 月 剩 17%`），不再挤占优惠窗口文字
- 窗口内多档折扣并存时标题显示区间（如 `夜间折扣 0.8–5 折`），不再取第一条规则误标为单一档位

### Fixed
- **授权在 OpenCode 升级/重启后丢失**：凭证与自有浏览器 profile 迁移到 `%LOCALAPPDATA%\alibabatokenplan`（脱离宿主数据目录），旧路径自动一次性迁移且幂等；DPAPI 改用绝对路径调用 PowerShell，落盘失败不再静默降级
- 优惠面板不再展示过期静态模型价目表；无实时文档时不编造优惠行

## [0.2.3] - 2026-11-16

### Changed
- 面板“优惠窗口”段改为动态选取当前最相关窗口：qwen 模型优先、最多 3 行，移除全量静态价格表
- 不足 1 分钟的倒计时显示为秒（`47s`），不再出现 `0m`
- 侧栏无真实数据行时整块不渲染（删除“额度数据待刷新 / 额度 载入中”占位）

## [0.2.2] - 2026-11-16

### Fixed
- 额度数据解析：真实网关信封的 `DataV2.data.data` 下钻一层（`normalize_*`），修复“面板全 `-` 但数据源 browser-session”
- 面板“数据源”时间改为本地时区显示
- 优惠窗口长行加 `truncate`，不再溢出面板边界

## [0.2.1] - 2026-11-16

### Fixed
- V2 server 运行时用没有 `keymap` 的上下文调用 `setup` 时直接 no-op；此前抛 `TypeError` 导致插件被标 failed、TUI 侧栏与 `/tokenplan` 全部不可用
- 按官方文档，TUI-only 插件登记在 `cli.json` 的 `plugins[]`

## [0.2.0] - 2026-11-16

### Added

- OpenCode v2 TUI 插件入口（`Plugin.define({ id, setup })`，`@opencode/plugin` 2.0.16）
- `/tokenplan` 单面板双段：个人套餐额度（套餐状态/规格/剩余天数/到期/用量窗口百分比/加购积分/Qwenwork credits）+ 优惠窗口雷达（时段/倒计时/模型现价原价/文本模型价格/公告）
- `sidebar.content`（≤3 行摘要）、`home.footer.status` 与 `prompt.footer.status`（同款单行摘要）三个表面
- 外接浏览器授权：CDP 拉起插件自有 profile 的 Chromium 系浏览器（Edge/Chrome/Brave/Chromium/Vivaldi/Opera），Firefox 直读明文 `cookies.sqlite`，兜底「粘贴控制台 Cookie」
- 系统默认浏览器优先：Windows 注册表 UserChoice / macOS `defaults read` / Linux `xdg-settings`
- 额度查询每 60 秒一次；另有首帧立即刷新与会话结束 15s 去抖刷新
- `quota-cache.json` 缓存（`schemaVersion: 2`，字段白名单投影，无任何凭证字段）

### Removed

- server 插件入口与 web 面板（`dashboard.autoOpen`、本地端口、edge `--app` 窗口）
- `status.json` 落盘与 v1 工具、启动 toast

### Changed

- 从 0.1.x 迁移：必须从 `~/.config/opencode/cli.json` 的 `plugins[]` 删除本包，否则 CLI 加载器继续报 `Invalid V2 TUI plugin module`；`tui.json` 的 `plugin[]` 保留

### Security

- 凭证（Cookie/Bearer）永不进入日志、界面文字、toast 或缓存文件
- 凭证落盘使用 Windows DPAPI（当前用户）加密；系统加密不可用时仅留内存
- 只清理插件自己启动的浏览器进程与自有 profile 目录，绝不触碰用户日常浏览器
