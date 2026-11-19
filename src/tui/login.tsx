/** @jsxImportSource @opentui/solid */
// 授权流程：列出 detect() 给出的可用适配器（浏览器列表）→ 用户选一个 → 等登录（带倒计时）→ Esc 中止。
// 浏览器进程的 spawn / 关闭全在 core 的 credentials 内；这里只负责发 signal 与显示进度，
// 组件卸载（Esc/关窗/重新挂载）时 abort，core 的 finally 会收掉自己启动的浏览器。

import { For, Show, createSignal, onCleanup } from "solid-js";
import type { TuiContext } from "./context";
import { detectCredentialAdapters, login } from "../core/quota/credentials";

type Detection = Awaited<ReturnType<typeof detectCredentialAdapters>>;
type AdapterId = Detection["adapters"][number];
type Progress = Parameters<Parameters<typeof login>[0]["onProgress"]>[0];

/** core 的成功结果里 storage 只有这两个值；缺省=老形状（没告诉我们是否落盘）。 */
export type LoginStorage = "dpapi" | "session";

/** 成功文案：storage 决定用户能否指望重启/升级后凭证还在。 */
export function loginSuccessNotice(storage?: LoginStorage): string {
  if (storage === "dpapi") return "授权成功 · 凭证已加密保存";
  if (storage === "session") return "授权成功 · 仅本次会话（重启后需重新授权）";
  return "授权成功";
}

const PHASE_TEXT: Record<string, string> = {
  launching: "正在启动浏览器…",
  "waiting-login": "请在浏览器中完成登录",
  verifying: "正在校验登录态…",
  closing: "正在关闭浏览器…",
};

function adapterLabel(id: AdapterId): string {
  switch (id) {
    case "cdp-own-profile":
      return "打开插件专用浏览器窗口，登录一次";
    case "firefox-sqlite":
      return "读取 Firefox 已保存的登录 Cookie";
    case "manual-paste":
      return "粘贴控制台 Cookie";
    default:
      return id;
  }
}

function headerLine(found: Detection): string {
  const names = found.browsers.map((browser) => browser.label);
  return names.length ? `当前可用：${names.join(" / ")}` : "未检测到已安装的浏览器";
}

export function LoginFlow(props: {
  context: TuiContext;
  onFinished: (storage?: LoginStorage) => void;
  onManualPaste: () => void;
}) {
  const [detection, setDetection] = createSignal<Detection | null>(null);
  const [choice, setChoice] = createSignal(0);
  const [progress, setProgress] = createSignal<Progress | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  let controller: AbortController | null = null;

  // Esc / 关窗 / 卸载：中止等待，浏览器由 core 的 finally 清理。
  onCleanup(() => controller?.abort());

  const detect = () => {
    void detectCredentialAdapters()
      .then((next) => {
        setDetection(next);
        setChoice(0);
      })
      .catch(() => {
        setDetection({ browsers: [], adapters: [], preferred: null });
      });
  };
  detect();

  // 列表照抄 detect()：manual-paste 是兜底项（没有可自动读取的浏览器时唯一的路）。
  const options = (): AdapterId[] => detection()?.adapters ?? [];

  const start = (adapter: AdapterId) => {
    if (progress()) return;
    // 粘贴走面板的输入框；login() 在 manual-paste 上只会返回错误，不启动它。
    if (adapter === "manual-paste") {
      props.onManualPaste();
      return;
    }
    const abort = new AbortController();
    controller = abort;
    setError(null);
    setProgress({ phase: "launching", secondsLeft: 180 });
    void login({ signal: abort.signal, adapters: [adapter], onProgress: setProgress })
      .then((result) => {
        if (abort.signal.aborted) return;
        controller = null;
        setProgress(null);
        if (result.ok) props.onFinished(result.storage);
        else setError(result.message);
      })
      .catch(() => {
        controller = null;
        setProgress(null);
        setError("登录流程异常中止，请重试");
      });
  };

  props.context.keymap.layer(() => ({
    mode: "modal",
    commands: [
      {
        bind: "up",
        title: "上一项",
        group: "Token Plan",
        enabled: () => !progress(),
        run: () => setChoice((index) => Math.max(0, index - 1)),
      },
      {
        bind: "down",
        title: "下一项",
        group: "Token Plan",
        enabled: () => !progress(),
        run: () => setChoice((index) => Math.min(options().length - 1, index + 1)),
      },
      {
        bind: "return",
        title: "开始授权",
        group: "Token Plan",
        enabled: () => !progress() && options().length > 0,
        run: () => {
          const adapter = options()[choice()];
          if (adapter) start(adapter);
        },
      },
    ],
  }));

  const theme = () => props.context.theme;

  return (
    <box flexDirection="column">
      <Show when={progress()}>
        {(current) => (
          <box flexDirection="column">
            <text fg={theme().text.base}>{PHASE_TEXT[current().phase] ?? "等待登录"}</text>
            <text fg={theme().text.muted}>剩余 {current().secondsLeft} 秒 · Esc 取消</text>
          </box>
        )}
      </Show>

      <Show when={!progress()}>
        <Show when={detection()} fallback={<text fg={theme().text.muted}>正在检测可用浏览器…</text>}>
          {(found) => (
            <box flexDirection="column">
              <text fg={theme().text.muted}>{headerLine(found())}</text>
              <Show
                when={options().length > 0}
                fallback={<text fg={theme().text.muted}>未检测到可用授权方式 · 请稍后重试</text>}
              >
                <For each={options()}>
                  {(adapter, index) => (
                    <box
                      onMouseDown={() => {
                        setChoice(index());
                        start(adapter);
                      }}
                    >
                      <text
                        wrapMode="none"
                        fg={index() === choice() ? theme().text.action.primary.selected : theme().text.base}
                      >
                        {index() === choice() ? "▶ " : "  "}
                        {adapterLabel(adapter)}
                        {found().preferred === adapter ? "（推荐）" : ""}
                      </text>
                    </box>
                  )}
                </For>
              </Show>
            </box>
          )}
        </Show>
      </Show>

      <Show when={error()}>{(message) => <text fg={theme().text.base}>{message()}</text>}</Show>
    </box>
  );
}
