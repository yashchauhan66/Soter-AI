/**
 * Loads `tailwind.config.ts` from plain Node scripts.
 *
 * The config is TypeScript, so `require()` cannot read it. Rather than
 * duplicating the palette into every audit script — which is how a design system
 * ends up with two sources of truth that quietly disagree — this compiles the
 * real file and evaluates it, so scripts verify the values the build emits.
 *
 * It uses TypeScript's own transpiler rather than stripping types with regexes.
 * The regex approach was tried first and broke immediately: `const X: Record<…> =`
 * needs the annotation removed but the initialiser kept, and a pattern loose
 * enough to catch that also mangles generics elsewhere. Compiling is shorter and
 * correct for any syntax the config might grow into.
 */
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const root = join(__dirname, "..");
const filename = join(root, "tailwind.config.ts");

const { outputText } = ts.transpileModule(readFileSync(filename, "utf8"), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    // The config does `import colors from "tailwindcss/colors"`, a CJS module
    // with no `default` export. Without interop the compiled `colors.slate`
    // reads off `module.exports.default`, which is undefined.
    esModuleInterop: true,
  },
  fileName: filename,
});

const mod = new Module(filename, null);
mod.filename = filename;
mod.paths = Module._nodeModulePaths(root);
mod._compile(outputText, filename);

// `export default config` compiles to `exports.default`.
module.exports = mod.exports.default ?? mod.exports;
