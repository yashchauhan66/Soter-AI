# SoterAI IDE Guard Baseline Results

- Typecheck: PASSED (0 errors)
- Eslint: PASSED (0 errors, 89 warnings)
- Test Suite: PASSED (679/679 tests passed)
- JS SDK tests: PASSED (18/18 tests passed)
- Extension Permission validation: PASSED
- Browser Extension Package zip: PASSED (packaged successfully into `apps/extension/dist/soter-extension-v0.1.1.zip` - 0.20 MB)
- VS Code Extension Package VSIX: PASSED (packaged successfully into `packages/vscode-extension/soterai-ide-guard-0.1.0.vsix` - 322 KB)
- Honest Guard Benchmark: PASSED (1218 cases. Strictest Hard block/review: 63.89%)
- guard-core performance benchmark: PASSED
  - 1KB / file scan: p50=0.24ms, p95=0.35ms
  - 10KB / file scan: p50=2.02ms, p95=3.31ms
  - 100KB / file scan: p50=16.56ms, p95=23.02ms
  - 256KB / file scan: p50=31.48ms, p95=39.84ms
