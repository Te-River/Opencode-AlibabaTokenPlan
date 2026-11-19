// 加载形状冒烟（零宿主、零网络）：node scripts/smoke.mjs
// 做法：把 dist/tui.js 复制到临时目录，为它的每个裸 import 造一个 stub 包
// （@opencode/plugin/tui → { Plugin: { define: x => x } }，@opentui/* 与 solid-js → 同名空函数），
// 再真实 import 该副本。断言的正是 V2 TUI 加载器唯一的接受条件：default 是 { id, setup }。

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const distFile = path.resolve("dist/tui.js");
const source = fs.readFileSync(distFile, "utf8");

function bareImports(text) {
  const found = new Map(); // specifier -> local names
  for (const match of text.matchAll(/import\s*\{([^}]*)\}\s*from\s*"([^".][^"]*)"/g)) {
    if (match[2].startsWith("node:")) continue; // 内建模块不造 stub
    const locals = match[1]
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => part.split(/\s+as\s+/)[0].trim());
    const spec = match[2];
    found.set(spec, [...new Set([...(found.get(spec) ?? []), ...locals])]);
  }
  return found;
}

const stubRoot = fs.mkdtempSync(path.join(os.tmpdir(), "atp-smoke-"));

try {
  fs.writeFileSync(path.join(stubRoot, "package.json"), JSON.stringify({ type: "module" }));
  const specs = bareImports(source);
  assert.ok(specs.size > 0, "dist/tui.js 没有任何裸 import，产物可能不是插件入口");

  for (const [spec, locals] of specs) {
    const segments = spec.split("/");
    const pkg = spec.startsWith("@") ? segments.slice(0, 2).join("/") : segments[0];
    const subpath = segments.slice(spec.startsWith("@") ? 2 : 1).join("/");
    const dir = path.join(stubRoot, "node_modules", pkg);
    fs.mkdirSync(dir, { recursive: true });
    const body = spec === "@opencode/plugin/tui"
      ? "export const Plugin = { define: (definition) => definition };\n"
      : `${locals.map((name) => `export const ${name} = () => undefined;`).join("\n")}\n`;
    fs.writeFileSync(path.join(dir, "index.js"), body);
    const exportsField = subpath ? { [`./${subpath}`]: "./index.js" } : { ".": "./index.js" };
    fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: pkg, type: "module", exports: exportsField }));
  }

  const copy = path.join(stubRoot, "tui.js");
  fs.copyFileSync(distFile, copy);
  const mod = await import(pathToFileURL(copy).href);
  const definition = mod.default;

  const checks = [];
  const check = (name, fn) => {
    try { fn(); checks.push(`  ✔ ${name}`); }
    catch (error) { checks.push(`  ✘ ${name}: ${error.message}`); process.exitCode = 1; }
  };

  check("default 存在且 id 为非空 string", () => {
    assert.equal(typeof definition?.id, "string");
    assert.ok(definition.id.length > 0);
  });
  check("default.setup 是 function", () => assert.equal(typeof definition?.setup, "function"));
  check("id 等于包名", () => assert.equal(definition.id, "@te-river/opencode-alibabatokenplan"));
  check("模块只有 default 导出（无 server / tui 导出）", () => {
    assert.deepEqual(Object.keys(mod).sort(), ["default"]);
    assert.ok(!("server" in mod));
    assert.ok(!("tui" in mod));
  });
  check("产物是预编译 Solid JSX（_$createElement 来自 @opentui/solid）", () => {
    assert.match(source, /from\s+"@opentui\/solid"/);
    assert.match(source, /createElement/);
    assert.ok(!/React\.createElement/.test(source), "出现 React.createElement，JSX 没有走 babel-preset-solid");
  });

  console.log(`[smoke] stubbed ${[...specs.keys()].join(", ")}`);
  for (const line of checks) console.log(line);
  console.log(process.exitCode ? "[smoke] FAILED" : "[smoke] ALL PASS");
} finally {
  fs.rmSync(stubRoot, { recursive: true, force: true });
}
