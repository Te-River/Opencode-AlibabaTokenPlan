// 构建：esbuild 三条命令（bundle:true, packages:external），产物 dist/server.js|tui.js|core.mjs。
// packages:external → 宿主在装载 npm 插件时会把 dependencies 装进包目录（team-mode 缓存实证，03-D1），
// 运行时 solid-js/@opentui/* 从包自身 node_modules 解析。类型检查由 tsc --noEmit 单独跑。

import { build } from "esbuild";
import { rmSync, mkdirSync } from "node:fs";

rmSync("dist", { recursive: true, force: true });
mkdirSync("dist", { recursive: true });

const common = {
  bundle: true,
  packages: "external",
  platform: "node",
  format: "esm",
  target: "node22",
  legalComments: "none",
  logLevel: "info",
};

const entries = [
  { entryPoints: ["src/server/index.ts"], outfile: "dist/server.js" },
  { entryPoints: ["src/tui/index.tsx"], outfile: "dist/tui.js" },
  { entryPoints: ["src/core/index.ts"], outfile: "dist/core.mjs" },
];

for (const e of entries) {
  await build({ ...common, ...e });
}
console.log("[build] dist/server.js dist/tui.js dist/core.mjs OK");
