/** @jsxImportSource @opentui/solid */
// 两个紧凑表面：侧栏 2–4 行、页脚单行。都只是一个 view 的两种投影，不含取数逻辑。

import { For, Show } from "solid-js";
import type { TuiContext } from "./context";
import { createClock, type TokenPlanView } from "./state";
import {
  barSegments,
  footerLine,
  isQuotaMeterLine,
  MONTH_LABEL,
  overlayFg,
  quotaSeverity,
  quotaSeverityFg,
  sidebarLines,
  splitMeter,
} from "./format";

type Theme = TuiContext["theme"];

/**
 * span 的取色属性。@opentui/solid 的 SpanProps 声明成 ComponentProps<{}, …>，漏了
 * TextNodeOptions 的 fg；运行期 props 直接进 SpanRenderable→TextNodeRenderable 构造器，
 * 所以把 fg 塞进 style 对象会被静默丢弃，必须作为顶层 props 传下去（这里绕过类型声明）。
 */
export const spanFg = (fg: string): Record<string, string> => ({ fg });

function QuotaLine(props: { theme: Theme; line: string; usedPercent: number | null | undefined }) {
  const base = props.theme.text.base;
  const parts = splitMeter(props.line);
  if (!parts) {
    return (
      <text fg={base} wrapMode="none">
        {props.line}
      </text>
    );
  }
  const meterFg = quotaSeverityFg(props.theme, quotaSeverity(props.usedPercent));
  return (
    <text fg={base} wrapMode="none">
      <span {...spanFg(base)}>{parts[0]}</span>
      <span {...spanFg(meterFg)}>{parts[1]}</span>
      <span {...spanFg(base)}>{parts[2]}</span>
    </text>
  );
}

/** 侧栏值行：16 格叠加条 + 余下文案（`-12.6% 817.14M Token`）。 */
const VALUE_LINE = /^([█▓░]{16}) (?=.*)/;

/** 周期值行：叠加条逐段上色 —— █ 亮（正文色）、░ 灰、▓ 该行强调色（7d 黄 / 5h 青）。 */
function PeriodLine(props: { theme: Theme; line: string; overlay: "week" | "fiveHour" }) {
  const base = props.theme.text.base;
  const muted = props.theme.text.muted;
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
    <text fg={muted} wrapMode="none">
      <For each={barSegments(parts[1])}>
        {(segment) =>
          segment.kind === "period" ? (
            <span {...spanFg(accent)}>{segment.text}</span>
          ) : segment.kind === "month" ? (
            // 已用段：正文亮色（不压暗）
            <span {...spanFg(base)}>{segment.text}</span>
          ) : (
            // 空轨：灰，弱于已用段
            <span {...spanFg(muted)}>{segment.text}</span>
          )
        }
      </For>
      <span {...spanFg(muted)}>{rest}</span>
    </text>
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
  const fg = props.line.startsWith(MONTH_LABEL) ? props.theme.text.base : props.theme.text.muted;
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
      <text fg={props.context.theme.text.muted} wrapMode="none">
        {line()}
      </text>
    </Show>
  );
}
