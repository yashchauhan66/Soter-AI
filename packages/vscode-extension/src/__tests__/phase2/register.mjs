/**
 * PHASE 2 — module loader that substitutes `vscode-stub.ts` for `vscode`.
 *
 * TWO interceptions are required, and the reason is not obvious:
 *
 *   `packages/vscode-extension/package.json` has no `"type": "module"`, so tsx
 *   transpiles every `.ts` file in this package to CommonJS and resolves its
 *   imports through `require`. An ESM `module.register` resolve hook therefore
 *   NEVER FIRES for them. Patching `Module._load` alone is what actually works;
 *   `Module.register` is kept for any genuinely-ESM file in the graph.
 *
 * Measured: with only the register() hook, `import * as vscode from "vscode"`
 * inside ContextGatherer.ts failed with `Cannot find module 'vscode'` and a CJS
 * require stack.
 *
 * Usage:  npx tsx --import ./src/__tests__/phase2/register.mjs <entry>
 */
import Module from "node:module";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const stubPath = fileURLToPath(new URL("./vscode-stub.ts", import.meta.url));
const req = createRequire(import.meta.url);

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
    if (request === "vscode") return req(stubPath);
    return originalLoad.call(this, request, parent, isMain);
};

Module.register(new URL("./loader-hooks.mjs", import.meta.url));
