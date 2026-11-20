/** @jsxImportSource @opentui/solid */
// /tokenplan 面板：同一个对话框里上下两段——额度 + 优惠窗口；「授权」在同一面板内切换成登录流程。

import { For, Show, createSignal } from "solid-js";
import { TextAttributes } from "@opentui/core";
import { useTerminalDimensions } from "@opentui/solid";
import type { TuiContext } from "./context";
import type { TokenPlanView } from "./state";
import { createClock } from "./state";
import { colorString, discountRows, PALETTE, quotaRows, quotaSeverityFg, rowLabelText, type Row } from "./format";
import { spanFg } from "./views";
import { LoginFlow, loginSuccessNotice, type LoginStorage } from "./login";
import { forgetCredential, submitManualCookie } from "../core/quota/credentials";

// 构建期由 scripts/build.mjs 的 esbuild define 注入（package.json version），运行时不读文件。
declare const __ATP_VERSION__: string;

function RowLine(props: { row: Row; mutedFg: string; baseFg: string; valueFg?: string }) {
  // 主题色可能是 RGBA 对象：所有 fg 统一归一化成字符串，避免渲染器 .trim() 崩溃。
  const mutedFg = colorString(props.mutedFg, PALETTE.muted);
  const baseFg = colorString(props.baseFg, PALETTE.base);
  const valueFg = colorString(props.valueFg, baseFg);
  // truncate：wrapMode="none" 的长行（优惠窗口那行有 4 段）按行宽尾部裁掉，不越出面板边界。
  return (
    <text wrapMode="none" truncate fg={props.row.muted ? mutedFg : valueFg}>
      <span {...spanFg(mutedFg)}>{rowLabelText(props.row.label)}</span>
      {props.row.value}
    </text>
  );
}

/** 成功提示只带 storage；存在即显示，缺 storage（老形状）就退化成「授权成功」。 */
type LoginNotice = { storage?: LoginStorage };

export function TokenPlanPanel(props: {
  context: TuiContext;
  view: TokenPlanView;
  /** 粘贴 Cookie 会重建面板，成功提示得跟着新实例进来。 */
  initialNotice?: LoginNotice;
}) {
  const [mode, setMode] = createSignal<"report" | "login">("report");
  const [notice, setNotice] = createSignal<LoginNotice | null>(props.initialNotice ?? null);
  const now = createClock();
  const dimensions = useTerminalDimensions();
  let scroll: any;

  const close = () => props.context.ui.dialog.clear();
  const theme = () => props.context.theme;
  const maxHeight = () => Math.max(8, Math.floor(dimensions().height * 0.7) - 6);

  // prompt 会顶掉当前面板，所以粘贴流程无论成败都要把面板重新挂回去（新实例要带上成功提示）。
  const repaint = (notice?: LoginNotice) => {
    props.context.ui.dialog.show(() => (
      <TokenPlanPanel context={props.context} view={props.view} initialNotice={notice} />
    ));
    props.context.ui.dialog.set({ size: "large" });
  };

  const requestPaste = () => {
    setNotice(null);
    void props.context.ui.dialog
      .prompt({
        title: "粘贴控制台 Cookie",
        description: "从已登录的百炼控制台复制 Cookie（单行，至少两个 name=value 对）。内容不回显、不写日志、不进缓存。",
        placeholder: "name=value; name2=value2",
      })
      .then(async (raw) => {
        if (raw === undefined) {
          repaint();
          return;
        }
        // raw 只在本次调用内流转：不进 signal、不落盘、不打日志。
        const result = await submitManualCookie(raw, new AbortController().signal).catch(
          (): { ok: false; message: string } => ({ ok: false, message: "Cookie 校验失败 · 请重试" }),
        );
        if (!result.ok) {
          await props.context.ui.dialog.alert({ title: "授权失败", message: result.message });
          repaint();
          return;
        }
        repaint({ storage: result.storage });
        void props.view.refresh();
      });
  };

  const quotaSection = (): Row[] => {
    const status = props.view.status();
    return status ? quotaRows(status.quota, now(), status.usagePeriods, status.usageSeries) : [{ label: "状态", value: "载入中…" }];
  };
  const discountSection = (): Row[] => {
    const status = props.view.status();
    return status ? discountRows(status.discount, now()) : [];
  };

  props.context.keymap.layer(() => ({
    mode: "modal",
    commands: [
      { bind: "return", title: "关闭", group: "Token Plan", enabled: () => mode() === "report", run: close },
      {
        id: "tokenplan.authorize",
        bind: "a",
        title: "授权 / 重新授权",
        group: "Token Plan",
        enabled: () => mode() === "report",
        run: () => {
          setNotice(null);
          setMode("login");
        },
      },
      {
        id: "tokenplan.forget",
        bind: "d",
        title: "退出登录 / 清除凭证",
        group: "Token Plan",
        enabled: () => mode() === "report",
        run: async () => {
          await forgetCredential();
          setNotice(null);
          setMode("report");
          await props.view.refresh();
        },
      },
      { bind: "up", title: "上一行", group: "Token Plan", enabled: () => mode() === "report", run: () => scroll?.scrollBy(-1) },
      { bind: "down", title: "下一行", group: "Token Plan", enabled: () => mode() === "report", run: () => scroll?.scrollBy(1) },
      { bind: "pageup", title: "上一页", group: "Token Plan", enabled: () => mode() === "report", run: () => scroll?.scrollBy(-maxHeight()) },
      { bind: "pagedown", title: "下一页", group: "Token Plan", enabled: () => mode() === "report", run: () => scroll?.scrollBy(maxHeight()) },
    ],
  }));

  return (
    <box flexDirection="column" paddingLeft={2} paddingRight={2}>
      <text attributes={TextAttributes.BOLD} fg={colorString(theme().text.base, PALETTE.base)}>
        {mode() === "login" ? "Token Plan 授权" : `Token Plan 额度与优惠 · v${__ATP_VERSION__}`}
      </text>

      <Show when={notice()}>
        {(current) => (
          <text
            fg={
              current().storage === "session"
                ? colorString(theme().text.feedback?.warning?.base, PALETTE.warning)
                : colorString(theme().text.base, PALETTE.base)
            }
          >
            {loginSuccessNotice(current().storage)}
          </text>
        )}
      </Show>

      <Show when={props.view.lastError()}>
        {(message) => <text fg={colorString(theme().text.muted, PALETTE.muted)}>⚠ {message()}</text>}
      </Show>

      <Show
        when={mode() === "login"}
        fallback={
          <scrollbox ref={(element) => (scroll = element)} maxHeight={maxHeight()}>
            <box flexDirection="column">
              <text attributes={TextAttributes.BOLD} fg={colorString(theme().text.action?.primary?.selected, PALETTE.base)}>额度</text>
              <For each={quotaSection()}>
                {(row) => (
                  <RowLine
                    row={row}
                    mutedFg={theme().text.muted}
                    baseFg={theme().text.base}
                    valueFg={row.severity ? quotaSeverityFg(theme(), row.severity) : undefined}
                  />
                )}
              </For>

              <text attributes={TextAttributes.BOLD} fg={colorString(theme().text.action?.primary?.selected, PALETTE.base)}>优惠窗口</text>
              <For each={discountSection()}>
                {(row) => <RowLine row={row} mutedFg={theme().text.muted} baseFg={theme().text.base} />}
              </For>
            </box>
          </scrollbox>
        }
      >
        <LoginFlow
          context={props.context}
          onFinished={(storage) => {
            setNotice({ storage });
            setMode("report");
            void props.view.refresh();
          }}
          onManualPaste={requestPaste}
        />
      </Show>

      <text fg={colorString(theme().text.muted, PALETTE.muted)}>
        {mode() === "login"
          ? "Esc 取消（会关闭本次启动的浏览器）"
          : `${props.view.refreshing() ? "刷新中… · " : ""}a 授权/重新授权 · d 退出登录 · ↑↓ 滚动 · Esc 关闭`}
      </text>
    </box>
  );
}
