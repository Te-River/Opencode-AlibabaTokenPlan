// core 汇聚入口：esbuild 以此打包 dist/core.mjs（node 直测/冒烟用）。
// 本目录所有模块零 opencode 依赖，仅 node 内建。

export * from "./types";
export * from "./rules";
export * from "./text";
export * from "./merge";
export * from "./qoder-snapshot";
export * from "./bailian-snapshot";
export * from "./status";
