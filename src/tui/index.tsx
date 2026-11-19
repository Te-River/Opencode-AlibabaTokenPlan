/** @jsxImportSource @opentui/solid */
// V2 TUI 入口：default export 必须是 { id, setup }（V2 加载器唯一的接受形状）。
// 四个表面：sidebar.content（3 行摘要）、home.footer.status 与 prompt.footer.status（各单行）、
// /tokenplan 对话框（额度 + 优惠合体）。

import { Plugin } from "@opencode/plugin/tui";
import type { TuiContext } from "./context";
import { createTokenPlanView, type TokenPlanView } from "./state";
import { FooterView, SidebarView } from "./views";
import { TokenPlanPanel } from "./panel";

const PLUGIN_ID = "@te-river/opencode-alibabatokenplan";
// 每轮对话结束都会 refresh；15s 内的连发合并成一次，免得刷爆控制台接口。
const STEP_REFRESH_GAP_MS = 15_000;

function openPanel(context: TuiContext, view: TokenPlanView): void {
  void view.refresh();
  context.ui.dialog.show(() => <TokenPlanPanel context={context} view={view} />);
  context.ui.dialog.set({ size: "large" });
}

export default Plugin.define({
  id: PLUGIN_ID,
  setup(context) {
    // V2 的 server 运行时会 import 同一个包，并用「没有 keymap/ui」的上下文调用 setup；
    // TUI 专属能力只在 TUI 运行时存在。server 侧必须是无害 no-op，否则插件会被标 failed，
    // 连 TUI 侧也不会再挂载（宿主只挂 active 的插件）。
    if (!context || !context.keymap) return () => {};

    const view = createTokenPlanView();

    const disposeSidebar = context.ui.slot({
      append: "sidebar.content",
      render: () => <SidebarView context={context} view={view} />,
    });
    const disposeHome = context.ui.slot({
      append: "home.footer.status",
      render: () => <FooterView context={context} view={view} />,
    });
    const disposePromptFooter = context.ui.slot({
      append: "prompt.footer.status",
      render: () => <FooterView context={context} view={view} />,
    });

    context.keymap.layer(() => ({
      mode: "global",
      commands: [
        {
          id: "tokenplan.open",
          title: "Token Plan 额度与优惠",
          group: "Token Plan",
          palette: true,
          slash: { name: "tokenplan" },
          // 同步返回：返回 Promise 会被宿主当成"已处理"。
          run: () => openPanel(context, view),
        },
      ],
    }));

    let lastStepRefresh = 0;
    const stopSteps = context.data.on("session.step.ended", () => {
      const at = Date.now();
      if (at - lastStepRefresh < STEP_REFRESH_GAP_MS) return;
      lastStepRefresh = at;
      void view.refresh();
    });

    return () => {
      stopSteps();
      disposePromptFooter();
      disposeHome();
      disposeSidebar();
      view.dispose();
    };
  },
});
