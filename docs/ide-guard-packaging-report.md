# SoterAI IDE Guard — Packaging Report

## Problem

`vsce package` followed the symlinked monorepo (`node_modules/@soterai/guard-core`
→ `packages/guard-core`, and the hoisted root `node_modules`) and attempted to
include 60k+ files / ~1.6 GB, producing no usable VSIX.

## Fix

1. **esbuild bundling** (`packages/vscode-extension/esbuild.js`)
   - Entry `src/extension.ts` → single `dist/extension.js`.
   - `@soterai/guard-core` is **inlined** into the bundle.
   - `vscode` is marked `external` (provided by the host).
   - `platform: node`, `format: cjs`, `target: node18`.
   - Production build minifies and drops the sourcemap.

2. **`.vscodeignore` tightened** to exclude:
   - `node_modules/**` (nothing is needed at runtime — guard-core is bundled)
   - `src/**`, `esbuild.js`, `tsconfig*.json`, ESLint config
   - `**/*.map`, tests (`**/__tests__/**`, `**/*.test.*`), coverage, `out/**`
   - repo/tooling noise (`.git`, `.vscode`, `.gitignore`, `.vscodeignore`)
   - ad-hoc/large assets, `*.vsix`, `canaryVerify.ts`, `test_output*.txt`

3. **Scripts** (`package.json`)
   - `npm run compile` → esbuild dev bundle
   - `npm run bundle` → esbuild production bundle
   - `npm run package` / `npm run vscode:package` → bundle + `vsce package --allow-missing-repository --skip-license`
   - `vscode:prepublish` → `npm run bundle`

4. **Manifest** gained `repository`, `bugs`, `homepage`, and `license` fields so
   packaging no longer warns fatally (and `--allow-missing-repository` covers CI).

## Result

- Bundled output: `dist/extension.js` (single file, guard-core inlined).
- VSIX contents are limited to: `extension.vsixmanifest`, `package.json`,
  `README.md`, `LICENSE`, `dist/extension.js`, and `media/` icon.

_Exact VSIX path and size are recorded in `docs/ide-guard-p0-fix-final-report.md`._
