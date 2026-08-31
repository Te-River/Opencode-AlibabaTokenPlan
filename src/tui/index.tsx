// TUI 插件入口（03-D4 展示矩阵）。default export { id, tui }。
//
// 渲染方式：不经 JSX 编译链——直接用 @opentui/solid 的运行时原语
// (createElement/setProp/effect/insert/createComponent) 手工构建，与 Solid 编译器
// 产物同构（quota dist/tui.js 头部实证宿主吃这套导出）。

import { createElement, setProp, effect, insert, createComponent } from "@opentui/solid";
import { createSignal, onCleanup } from "solid-js";
import type { StatusFile, WindowView } from "../core/types";
import { loadConfig, type AtpConfig } from "../core/status";
import { matchProvider, isProviderMatchMode, type ProviderMatchMode } from "../core/provider";
import { windowState, fmtHMS, fmtShortDur } from "../core/rules";
import { fmtFactor, homeSummaryLine, sourceBadgeLine } from "../core/text";
import { isCrossVerified, canonicalize } from "../core/merge";
import { QODER_INSALE_FACTORS, QODER_SNAPSHOT_DATE } from "../core/qoder-snapshot";
import { loadStatusView, type StatusView } from "./read-status";

const PKG_ID = "@te-river/opencode-alibabatokenplan";
const POLL_MS = 30_000;
const EVENT_DEBOUNCE_MS = [150, 600]; // quota 同款节奏

// ─────────────────────────── M3：全模块唯一 1Hz 时钟 ───────────────────────────
// tui() 顶层 createSignal(now) + 仅一个 setInterval，双清理（Solid root onCleanup +
// api.lifecycle.onDispose）；sidebar/dialog/home 组件只在响应式 accessor 里读 getNow()
// 订阅该信号，不再各自建局部 setInterval（旧实现每次重挂槽位/对话框都泄漏一个定时器）。
let getNow: () => number = () => Date.now(); // tui() 未运行时的兜底（槽件不会先于 tui() 渲染）
let stopSharedTicker: (() => void) | null = null;

// ─────────────────────────── 无 JSX 渲染助手 ───────────────────────────

type Child = string | number | boolean | null | undefined | (() => unknown) | object | Child[];
interface HProps { [k: string]: unknown }

/** h(type, props, ...children)。props 里函数值=响应式 accessor（编译器等价）。 */
function h(type: string, props: HProps | null, ...children: Child[]): any {
  const el: any = createElement(type);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (k === "ref" && typeof v === "function") { (v as (e: unknown) => void)(el); continue; }
    if (typeof v === "function" && !k.startsWith("on")) {
      // 模拟 babel solid 输出：_$effect(_$p => _$setProp(el, k, expr, _$p))
      effect((p: unknown) => { setProp(el, k, (v as () => unknown)(), p); });
    } else {
      setProp(el, k, v);
    }
  }
  for (const c of children) insertChild(el, c);
  return el;
}

function insertChild(parent: any, c: Child): void {
  if (c === null || c === undefined || c === false || c === "") return;
  if (Array.isArray(c)) { for (const x of c) insertChild(parent, x); return; }
  insert(parent, c as any);
}

/** 一行文本；content 可为字符串或 accessor（每秒 tick 就地更新，不重建节点）。 */
function line(text: string | (() => string), style: HProps = {}): any {
  const props: HProps = { wrapMode: "word", ...style, content: text };
  return h("text", props);
}

// ─────────────────────────── provider 门控（0.1.1 R2：core matchProvider 双模式） ───────────────────────────
// 判定逻辑本身在 core/provider.ts（family/strict 表驱动可单测）；这里只做宿主字段提取。

function providerBaseURL(api: any, id: string): string {
  try {
    const p: any = (api.state.provider as any[])?.find((x) => x?.id === id || x?.provider?.id === id);
    return String(p?.options?.baseURL ?? p?.provider?.options?.baseURL ?? "");
  } catch {
    return "";
  }
}

function sessionProviderID(api: any, sessionID: string): string | undefined {
  try {
    const sess: any = api.state.session.get(sessionID);
    const direct = sess?.data?.model?.providerID ?? sess?.model?.providerID ?? sess?.providerID;
    if (typeof direct === "string" && direct) return direct;
  } catch {}
  try {
    const msgs = api.state.session.messages(sessionID) ?? [];
    for (let i = msgs.length - 1; i >= 0; i--) {
      const mi: any = msgs[i]?.info ?? msgs[i];
      if (typeof mi?.providerID === "string" && mi.providerID) return mi.providerID;
    }
  } catch {}
  return undefined;
}

function sessionIsTokenPlan(api: any, sessionID: string, mode: ProviderMatchMode): boolean {
  const pid = sessionProviderID(api, sessionID);
  if (matchProvider(pid, undefined, mode)) return true;
  if (!pid) return false;
  return matchProvider(pid, providerBaseURL(api, pid), mode);
}

function anyTokenPlanProvider(api: any, mode: ProviderMatchMode): boolean {
  try {
    for (const p of (api.state.provider as any[]) ?? []) {
      const id = p?.id ?? p?.provider?.id;
      const base = p?.options?.baseURL ?? p?.provider?.options?.baseURL ?? "";
      if (matchProvider(typeof id === "string" ? id : undefined, String(base), mode)) return true;
    }
  } catch {}
  return false;
}

// ─────────────────────────── 数据视图（轮询 + 事件去抖） ───────────────────────────

interface ViewState {
  get: () => StatusView;
  refresh: () => void;
  cfg: AtpConfig;
}

function createViewState(api: any): ViewState {
  const cfg = loadConfig();
  const [view, setView] = createSignal<StatusView>(loadStatusView());
  const refresh = () => { try { setView(loadStatusView()); } catch {} };
  const timer = setInterval(refresh, POLL_MS);
  timer.unref?.();
  const offs: Array<() => void> = [];
  let t1: any, t2: any;
  const debounced = () => {
    clearTimeout(t1); clearTimeout(t2);
    t1 = setTimeout(refresh, EVENT_DEBOUNCE_MS[0]);
    t2 = setTimeout(refresh, EVENT_DEBOUNCE_MS[1]);
  };
  for (const ev of ["message.updated", "session.idle", "tui.session.select"] as const) {
    try { offs.push(api.event.on(ev as any, debounced)); } catch {}
  }
  onCleanup(() => {
    clearInterval(timer); clearTimeout(t1); clearTimeout(t2);
    for (const off of offs) { try { off(); } catch {} }
  });
  return { get: view, refresh, cfg };
}

// ─────────────────────────── sidebar 面板（≤8 行） ───────────────────────────

function wState(w: { start: string; end: string }, now: number) {
  return windowState(w, new Date(now));
}

function currentWindow(st: StatusFile, now: number): WindowView | undefined {
  return [...st.windows].sort((a, b) => {
    const aa = wState(a, now).active ? 0 : 1, bb = wState(b, now).active ? 0 : 1;
    if (aa !== bb) return aa - bb;
    return new Date(a.nextBoundaryAt).getTime() - new Date(b.nextBoundaryAt).getTime();
  })[0];
}

function sessionModelName(api: any, sessionID: string): string | undefined {
  try {
    const sess: any = api.state.session.get(sessionID);
    const m = sess?.data?.model?.modelID ?? sess?.model?.modelID ?? sess?.model?.id;
    if (m) return canonicalize(String(m));
    const msgs = api.state.session.messages(sessionID) ?? [];
    for (let i = msgs.length - 1; i >= 0; i--) {
      const mi: any = msgs[i]?.info ?? msgs[i];
      if (mi?.modelID) return canonicalize(String(mi.modelID));
    }
  } catch {}
  return undefined;
}

function strikethroughText(s: string): string {
  return s.replace(/[^\u0300-\u036f]/g, (c) => c + "\u0336"); // 终端删除线模拟（D4）
}

function buildSidebar(api: any, vs: ViewState, sessionID: string, collapsed: () => boolean, toggle: () => void): any {
  const theme = () => api.theme.current;
  const now = getNow; // M3：订阅全模块唯一 1Hz 信号（不再局部 setInterval）

  const header = h("box", { style: { flexDirection: "row", gap: 1 }, onMouseUp: toggle },
    line("Token Plan 优惠", { fg: () => theme().text }),
    line(
      () => (vs.get().degraded ? `静态快照(截至${QODER_SNAPSHOT_DATE})` : sourceBadgeLine(vs.get().status)),
      { fg: () => (vs.get().degraded ? theme().textMuted : theme().success) },
    ),
  );

  const body = h("box", { style: { flexDirection: "column" } });
  // 外层=数据变化时重建行；行内 content=accessor 每秒就地走字
  insert(body, () => {
    const sv = vs.get();
    if (collapsed()) {
      return line(() => "已折叠 · /tokenplan 查看", { fg: theme().textMuted });
    }
    const s = sv.status;
    const w = currentWindow(s, now());
    if (!w) return line("暂无已知优惠窗口", { fg: theme().textMuted });
    const star = w.models[0];
    const rows: any[] = [
      line(() => `${wState(w, now()).active ? "▸" : "▹"} ${w.label} ${w.start}–${w.end}${star?.effective ? " " + star.effective : ""}`, {
        fg: () => (wState(w, now()).active ? theme().success : theme().text),
      }),
      line(() => `${fmtHMS(new Date(w.nextBoundaryAt).getTime() - now())} ${wState(w, now()).active ? "后结束·进行中" : "后开始"}`, {
        fg: () => (wState(w, now()).active ? theme().success : theme().warning),
      }),
    ];
    const model = sessionModelName(api, sessionID);
    if (model) {
      const entry = s.discounts.find((d) => d.model === model);
      const qf = QODER_INSALE_FACTORS[model];
      const factorRules = (entry?.applies ?? []).filter(
        (r) => r.unit === "credits-factor" && r.factor !== undefined &&
          (r.kind === "time-window" && r.window ? wState(r.window, now()).active : true),
      );
      const cur = factorRules[factorRules.length - 1];
      const fStr = fmtFactor(cur?.factor ?? qf?.factor) ?? "—";
      const bStr = fmtFactor(cur?.baseFactor ?? qf?.factor);
      const struck = bStr && bStr !== fStr ? strikethroughText(bStr) + " " : ""; // 划线价=字符串相等判断
      rows.push(
        line(
          () =>
            `当前 ${model} ${struck}${fmtFactor(cur?.factor ?? QODER_INSALE_FACTORS[model]?.factor)}${
              cur ? ` ${cur.label}${isCrossVerified(cur) ? " [双源印证]" : ""}` : " Credits倍率"
            }`,
          { fg: () => theme().accent },
        ),
      );
    }
    for (const o of s.windows.filter((x) => x.id !== w.id).slice(0, 2)) {
      rows.push(
        line(() => {
          const ws = wState(o, now());
          return `${o.label} · ${ws.active ? "剩" : "距"} ${fmtShortDur(new Date(o.nextBoundaryAt).getTime() - now())}${ws.active ? "结束" : "开始"}`;
        }, { fg: () => theme().textMuted }),
      );
    }
    if (sv.degraded) rows.push(line(`快照可能失效 · 数据截至 ${QODER_SNAPSHOT_DATE}`, { fg: () => theme().warning }));
    return h("box", { style: { flexDirection: "column" } }, ...rows.slice(0, 6));
  });

  return h("box", { style: { flexDirection: "column" } }, header, body);
}

// ─────────────────────────── /tokenplan Dialog ───────────────────────────

const TABS = [
  { key: "windows", title: "窗口倒计时", desc: "各优惠窗口与下一边界（每秒走字）" },
  { key: "models", title: "模型倍率", desc: "百炼目录价 + Qoder 在卖倍率" },
  { key: "limited", title: "限时优惠", desc: "flat-cut 明细（两单位不互算）" },
  { key: "free", title: "免费活动", desc: "free-calls / policy 与时效声明" },
  { key: "about", title: "口径说明", desc: "数据源、汇率、快照红线" },
] as const;

function openMainDialog(api: any, vs: ViewState): void {
  try {
    api.ui.dialog.replace(() =>
      createComponent(api.ui.DialogSelect as any, {
        title: `Token Plan 优惠（Qoder 快照截至 ${QODER_SNAPSHOT_DATE}）`,
        options: TABS.map((t) => ({ title: t.title, value: t.key, description: t.desc })),
        current: (() => { try { return api.kv.get("atp.lastDialogTab", "windows"); } catch { return "windows"; } })(),
        onSelect: (opt: any) => {
          try { api.kv.set("atp.lastDialogTab", opt.value); } catch {}
          openTabDialog(api, vs, String(opt.value));
        },
      }),
    );
    api.ui.dialog.setSize("medium");
  } catch {
    try { api.ui.toast({ variant: "error", message: "Token Plan 面板打开失败" }); } catch {}
  }
}

function openTabDialog(api: any, vs: ViewState, tab: string): void {
  const theme = () => api.theme.current;
  const now = getNow; // M3：订阅共享 1Hz 时钟

  const rowsFor = (): string[] => {
    const s = vs.get().status;
    const tt = now();
    switch (tab) {
      case "windows":
        return s.windows.flatMap((w) => {
          const ws = wState(w, tt);
          const head = `${w.label} [${w.start}–${w.end}] ${ws.active ? "进行中" : "未开始"} · ${ws.active ? "距结束" : "距开始"} ${fmtHMS(new Date(w.nextBoundaryAt).getTime() - tt)}`;
          const rows = w.models.map(
            (m) =>
              `  ${m.model} ${m.regular && m.regular !== m.effective ? strikethroughText(m.regular) + " " : ""}${m.effective ?? ""} ${m.badge ?? ""}${isCrossVerified(m) ? " [双源印证]" : ""}`,
          );
          return [head, ...rows];
        });
      case "models":
        return [
          "— 百炼目录（Credits/百万tok）—",
          ...s.textModels.map((m) => `${m.model} 输入 ${m.input} 缓存 ${m.cache} 输出 ${m.output}${m.bands ? `（${m.bands}）` : ""}${m.creditsFactor ? ` · Qoder ${m.creditsFactor}` : ""}${m.badge ? ` · ${m.badge.label}` : ""}`),
          "— Qoder 在卖倍率（快照，非优惠）—",
          ...Object.entries(QODER_INSALE_FACTORS).map(([k, v]) => `${k} ${fmtFactor(v.factor)}${v.note ? ` (${v.note})` : ""}`),
        ];
      case "limited":
        return s.offers
          .filter((r) => r.kind === "flat-cut")
          .flatMap((r) => [
            `${r.models.join(", ")} ×${r.factor ?? "-"}（${r.unit === "credits-factor" ? "Qoder Credits" : "百炼 ¥"}）${r.batchStack !== undefined ? ` Batch叠加×${r.batchStack}` : ""}`,
            ...(r.note ? ["  " + r.note] : []),
          ]);
      case "free":
        return s.notices.map((n) => `[${n.kind}] ${n.text}${n.expired ? "（已过期，快照可能失效）" : ""} · ${n.source}`);
      default:
        return [
          `百炼目录源: ${s.sources.catalog}（live→cli→snapshot 三级回退）`,
          `Qoder 快照: ${s.sources.qoderSnapshot}（静态，不调用任何 Qoder 私有端点）`,
          `换算注记: 1 元 = ${s.creditsPerYuan} Credits（${s.creditsRateNote}）`,
          "两套单位永不互算：Credits 倍率与 ¥ 价格倍率各居其 facet",
          "折后消耗显示「消耗/Cost，单位 Credit」；runtimeConfig 会变实际消耗",
          s.quota.available ? `额度: 实时（${s.quota.checkedAt}）` : `额度: ${s.quota.hint ?? "不可用"}`,
        ];
    }
  };

  try {
    api.ui.dialog.replace(() => {
      const scroll = h("scrollbox", { style: { flexGrow: 1, flexDirection: "column" } });
      insert(scroll, () => {
        const container = h("box", { style: { flexDirection: "column" } });
        for (const r of rowsFor()) insertChild(container, line(r));
        return container;
      });
      return h(
        "box",
        { style: { flexDirection: "column", height: "100%" } },
        line(`${TABS.find((x) => x.key === tab)?.title ?? tab} · 数据截至 ${QODER_SNAPSHOT_DATE} · esc 关闭`, { fg: () => theme().textMuted }),
        scroll,
      );
    });
    api.ui.dialog.setSize("large");
  } catch {
    try { api.ui.toast({ variant: "error", message: "Token Plan 明细打开失败" }); } catch {}
  }
}

// ─────────────────────────── 插件入口 ───────────────────────────

const tui = async (api: any, options?: unknown, _meta?: unknown) => {
  const g = globalThis as any;
  if (g.__atpTuiLoaded) return; // 双实例守卫（kv 键统一 atp. 命名空间）
  g.__atpTuiLoaded = true;

  // ── M3：全模块唯一 1Hz ticker，本函数顶层注册一次；双清理=Solid root onCleanup + 宿主 onDispose ──
  const [nowSig, setNowSig] = createSignal(Date.now());
  getNow = nowSig;
  const sharedTick = setInterval(() => setNowSig(Date.now()), 1000);
  sharedTick.unref?.();
  let stopped = false;
  stopSharedTicker = () => { if (stopped) return; stopped = true; clearInterval(sharedTick); };
  try { onCleanup(stopSharedTicker); } catch {} // 宿主未包 Solid root 时静默，靠 onDispose 兜底
  const stopTicker = stopSharedTicker;

  const vs = createViewState(api);
  let cfg = vs.cfg;
  try {
    const extra = typeof options === "string" ? undefined : (options as any);
    if (extra && typeof extra === "object") {
      for (const k of ["sidebar", "webpanel", "toast", "refresh", "providerMatch"]) {
        const v = extra[k];
        if (v === undefined) continue;
        // m7：toast 等布尔/标量键直接赋值（旧 `if(extra[k]) Object.assign(cfg[k], v)` 对 boolean
        // 既丢 false 又静默失效），对象键才做浅合并；R2：providerMatch 只认 family/strict
        if (k === "providerMatch") { if (isProviderMatchMode(v)) (cfg as any)[k] = v; }
        else if (typeof v !== "object" || v === null) (cfg as any)[k] = v;
        else Object.assign((cfg as any)[k] ?? {}, v);
      }
    }
  } catch {}
  void cfg;

  const collapsed = () => { try { return !!api.kv.get("atp.collapsed", false); } catch { return false; } };
  const toggleCollapsed = () => { try { api.kv.set("atp.collapsed", !collapsed()); } catch {} };

  api.slots.register({
    order: cfg.sidebar.order,
    slots: {
      sidebar_content(_ctx: any, props: any) {
        const sid = String(props?.session_id ?? "");
        if (!sid) return null;
        const tp = sessionIsTokenPlan(api, sid, cfg.providerMatch);
        if (!tp && !cfg.sidebar.showNonTokenPlan) return null; // R2：family 下 alibaba-cn 会话也命中；非匹配家族仍默认整块隐藏（D4 取舍）
        if (!tp) {
          // showNonTokenPlan=true → 弱化一行
          return line(() => {
            const w = currentWindow(vs.get().status, Date.now());
            return w ? `Token Plan: ${w.label} ${wState(w, Date.now()).active ? "进行中" : w.start + " 开始"}` : "Token Plan: 无已知窗口";
          }, { fg: () => api.theme.current.textMuted });
        }
        return buildSidebar(api, vs, sid, collapsed, toggleCollapsed);
      },
      home_bottom() {
        if (!anyTokenPlanProvider(api, cfg.providerMatch)) return null; // 门控=state.provider 含任一匹配条目（R2 默认 family）
        // M3：复用共享 1Hz 时钟（摘要粒度到分钟，逐秒重算成本可忽略），不再局部 setInterval
        return line(() => homeSummaryLine(vs.get().status, new Date(getNow())), { fg: () => api.theme.current.textMuted });
      },
    },
  });

  const dispose = api.keymap.registerLayer({
    commands: [{
      namespace: "palette",
      name: "tokenplan.main",
      title: "Token Plan 优惠总览",
      desc: `百炼+Qoder 快照优惠窗口/倍率/倒计时（数据截至 ${QODER_SNAPSHOT_DATE}）`,
      category: "Token Plan",
      slashName: "tokenplan",
      run: () => { vs.refresh(); openMainDialog(api, vs); },
    }],
    bindings: [],
  });
  api.lifecycle.onDispose(() => {
    try { stopTicker(); } catch {} // M3：宿主生命周期终止时停掉共享 ticker
    try { dispose(); } catch {}
  });
};

export default { id: PKG_ID, tui };
export const AliBabaTokenPlanTui = tui;
