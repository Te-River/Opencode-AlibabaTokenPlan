// 构建：Babel(solid JSX + TS) → esbuild bundle（ESM, packages:external）→ dist/tui.js
// 宿主只加载纯 ESM；JSX 必须在打包期编译成 @opentui/solid 的 _$ 助手，
// 运行期不装 JSX 编译器（参考插件 dist/tui.js 首行即 _$ 助手 import）。

import { build } from "esbuild";
import { copyFileSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import { transformAsync } from "@babel/core";

rmSync("dist", { recursive: true, force: true });
mkdirSync("dist", { recursive: true });

// @opentui/solid 的 JSX 运行期：generate:"universal" + moduleName 决定 _$ 助手的 import 来源。
const solidJsx = {
  name: "solid-jsx",
  setup(buildApi) {
    buildApi.onLoad({ filter: /\.tsx$/ }, async (args) => {
      const transformed = await transformAsync(readFileSync(args.path, "utf8"), {
        filename: args.path,
        babelrc: false,
        configFile: false,
        presets: [
          ["@babel/preset-typescript", { isTSX: true, allExtensions: true }],
          ["babel-preset-solid", { moduleName: "@opentui/solid", generate: "universal" }],
        ],
      });
      if (!transformed?.code) throw new Error(`[build] babel 无输出: ${args.path}`);
      return { contents: transformed.code, loader: "js", resolveDir: dirname(args.path) };
    });
  },
};

const common = {
  bundle: true,
  packages: "external",
  platform: "node",
  format: "esm",
  target: "node22",
  legalComments: "none",
  logLevel: "info",
  // 插件版本只在构建期定：面板标题用它，TUI 运行时不读 package.json。
  define: { __ATP_VERSION__: JSON.stringify(JSON.parse(readFileSync("package.json", "utf8")).version) },
};

await build({ ...common, entryPoints: ["src/tui/index.tsx"], outfile: "dist/tui.js", plugins: [solidJsx] });

// 纯 node 侧入口，只给 scripts/test*.mjs 用，不进 exports、不进宿主加载路径（设计 03 §7）。
await build({ ...common, entryPoints: ["src/core/index.ts"], outfile: "dist/core.mjs" });

// 纯 TUI 插件：公开类型只有 { id, setup } 的 default export。
copyFileSync("src/tui/plugin.d.ts", "dist/tui.d.ts");

console.log("[build] dist/tui.js dist/tui.d.ts OK");
