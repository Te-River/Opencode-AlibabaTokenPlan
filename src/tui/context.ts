import type { Plugin } from "@opencode/plugin/tui";

/** setup(context) 收到的上下文；由 @opencode/plugin 的 Definition 反推，避免直接依赖 @opencode/theme 类型。 */
export type TuiContext = Parameters<Plugin.Definition["setup"]>[0];
