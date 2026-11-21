/** @jsxImportSource @opentui/solid */
// 两个紧凑表面：侧栏 2–4 行、页脚单行。都只是一个 view 的两种投影，不含取数逻辑。

import { For, Show } from "solid-js";
import type { TuiContext } from "./context";
import { createClock, type TokenPlanView } from "./state";
import {
  barSegments,
  colorString,
  footerLine,
  isQuotaMeterLine,
  MONTH_LABEL,
  overlayFg,
  PALETTE,
  parseMeter,
  quotaSeverity,
  quotaSeverityFg,
  sidebarLines,
} from "./format";

type Theme = TuiContext["theme"];

/** 多色行用「同级多个 <text> + flexDirection:row」实现：该渲染器里嵌套 span 的 fg 不生效。 */
/** 月额度值行：bar 底色保持白/灰，只有百分比按 severity 上色；Token 合计用正文色。 */
function QuotaLine(props: { theme: Theme; line: string; usedPercent: number | null | undefined }) {
  const base = colorString(props.theme.text.base, PALETTE.base);
  const muted = colorString(props.theme.text.muted, PALETTE.muted);
  const parts = parseMeter(props.line);
  if (!parts) {
    return (
      <text fg={base} wrapMode="none">
        {props.line}
      </text>
    );
  }
  const percentFg = quotaSeverityFg(props.theme, quotaSeverity(props.usedPercent));
  return (
    <box flexDirection="row">
      <text fg={base} wrapMode="none">{parts.prefix}</text>
      <For each={barSegments(parts.bar)}>
        {(segment) => (
          <text
            fg={segment.kind === "unused" ? base : segment.kind === "period" ? percentFg : muted}
            wrapMode="none"
          >
            {segment.text}
          </text>
        )}
      </For>
      <text fg={percentFg} wrapMode="none">{` ${parts.percent}`}</text>
      <text fg={base} wrapMode="none">{parts.suffix}</text>
    </box>
  );
}

/** 侧栏值行：16 格叠加条 + 余下文案（`-12.6% 817.14M Token`）。 */
const VALUE_LINE = /^([█▒░]{16}) (?=.*)/;

/** 周期值行：叠加条逐段上色 —— █ 未用（亮）、░ 已用（灰）、▒ 周期消耗（7d 黄 / 5h 青）。 */
function PeriodLine(props: { theme: Theme; line: string; overlay: "week" | "fiveHour" }) {
  const base = colorString(props.theme.text.base, PALETTE.base);
  const muted = colorString(props.theme.text.muted, PALETTE.muted);
  const parts = VALUE_LINE.exec(props.line);
  if (!parts) {
    return (
      <text fg={muted} wrapMode="none">
        {props.line}
      </text>
    );
  }
  const accent = overlayFg(props.theme, props.overlay);
  const rest = props.line.slice(parts[1].length);
  return (
    <box flexDirection="row">
      <For each={barSegments(parts[1])}>
        {(segment) => (
          <text
            fg={segment.kind === "period" ? accent : segment.kind === "unused" ? base : muted}
            wrapMode="none"
          >
            {segment.text}
          </text>
        )}
      </For>
      <text fg={muted} wrapMode="none">{rest}</text>
    </box>
  );
}

/** 一行侧栏的三种形态：月额度值行（语义色）、周期值行（分段色）、其它（正文/灰色）。 */
function SidebarLine(props: {
  theme: Theme;
  line: string;
  usedPercent: number | null | undefined;
  overlay: "week" | "fiveHour";
}) {
  // 按内容识别，不按行号：月额度值行（bar16 + 正百分比）走语义色。
  if (isQuotaMeterLine(props.line)) {
    return <QuotaLine theme={props.theme} line={props.line} usedPercent={props.usedPercent} />;
  }
  if (VALUE_LINE.test(props.line)) {
    return <PeriodLine theme={props.theme} line={props.line} overlay={props.overlay} />;
  }
  const fg = props.line.startsWith(MONTH_LABEL)
    ? colorString(props.theme.text.base, PALETTE.base)
    : colorString(props.theme.text.muted, PALETTE.muted);
  return (
    <text fg={fg} wrapMode="none">
      {props.line.length > 0 ? props.line : " "}
    </text>
  );
}

export function SidebarView(props: { context: TuiContext; view: TokenPlanView }) {
  const now = createClock();
  const status = () => props.view.status();
  const lines = (): string[] => {
    const current = status();
    return current ? sidebarLines(current, now()) : [];
  };
  // 月额度是「标签行 + 值行」两行：标签用正文色，值行由 QuotaLine 上语义色，其余行灰色。
  // 周期值行紧跟在「近5h消耗」标签后 → 叠加段用青色；近7天用黄色。
  return (
    <box flexDirection="column">
      <For each={lines()}>
        {(line, index) => (
          <SidebarLine
            theme={props.context.theme}
            line={line}
            usedPercent={status()?.quota.window?.usedPercent}
            overlay={index() > 0 && lines()[index() - 1] === "近5h消耗" ? "fiveHour" : "week"}
          />
        )}
      </For>
    </box>
  );
}

export function FooterView(props: { context: TuiContext; view: TokenPlanView }) {
  // 首帧无数据时不渲染，避免在宿主页脚占一行空行。
  const line = (): string => {
    const status = props.view.status();
    return status ? footerLine(status) : "";
  };

  return (
    <Show when={line().length > 0}>
      <text fg={colorString(props.context.theme.text.muted, PALETTE.muted)} wrapMode="none">
        {line()}
      </text>
    </Show>
  );
}
