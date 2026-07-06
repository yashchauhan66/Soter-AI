# SoterAI IDE Guard — Paid MVP P0 Fix Report

This report summarizes the fixes applied to move IDE Guard from **FAIL** to a
paid-MVP candidate. Full validation results are in
`docs/ide-guard-p0-fix-final-report.md`.

## Blockers addressed

| # | Blocker | Status | Key change |
| --- | --- | --- | --- |
| 1 | Raw-secret leak in "Redact Selection for AI" | ✅ | Always-on safety-net pass merged with detector redaction; broadened patterns; fail-closed `redactForSharing`; `DecisionEngine` hard invariant |
| 2 | HashCache stored leaky decision | ✅ | `sanitizeDecisionForCache()` scrubs `redactedText`/`evidencePreview`/finding evidence; only hash + sanitized decision stored |
| 3 | VSIX packaging failed | ✅ | esbuild bundling (guard-core inlined), tightened `.vscodeignore`, `package`/`vscode:package` scripts |
| 4 | Missing declared commands | ✅ | Implemented + registered `configurePolicy`, `scanBeforeAIPrompt`, `scanGitChanges` |
| 5 | Workspace Trust gap | ✅ | `capabilities.untrustedWorkspaces: limited`; cloud/token/remote gated on `isTrusted`; dashboard shows Trusted/Restricted |
| 6 | Test/lint scripts missing/broken | ✅ | `typecheck`/`lint`/`test` scripts; canary regression tests in both packages |
| 7 | Webview hardening | ✅ | CSP on Review-AI-Code panel; `escapeHtml` on all finding fields in both webviews; scripts disabled in review panel |
| 8 | PolicyEvaluator `approval_required` unreachable | ✅ | Threshold selection by highest satisfied tier; unit tests |
| 9 | Docs & release readiness | ✅ | README, LICENSE, repository field, three reports + final report |

## Files changed

**guard-core**
- `src/PolicyEvaluator.ts` — threshold selection rewrite (highest satisfied tier).
- `src/HashCache.ts` — `sanitizeDecisionForCache()` + sanitized `set()`.
- `src/__tests__/redaction.test.ts` — new canary/redaction/cache/evidence tests.
- `src/__tests__/policy.test.ts` — new policy ordering tests.
- (`src/Redactor.ts`, `src/DecisionEngine.ts`, `src/detectors/SecretDetector.ts`
  already carried the safety-net + broadened patterns; verified & tested.)

**vscode-extension**
- `src/commands.ts` — `configurePolicy`, `scanBeforeAIPrompt`, `scanGitChanges`
  handlers + registration; hardened Review-AI-Code webview (CSP + escaping +
  scripts off); cloud connect gated on trust; clipboard writes routed through
  redaction; `escapeHtml`/`getNonce` helpers.
- `src/webview/DashboardPanel.ts` — `escapeHtml` on all finding fields.
- `package.json` — `capabilities.untrustedWorkspaces`, `repository`/`bugs`/
  `homepage`/`license`, esbuild-based scripts, `typecheck`/`lint`/`test`/
  `package`/`vscode:package`, deps (`esbuild`, `tsx`).
- `esbuild.js` — new bundler.
- `.vscodeignore` — tightened.
- `src/__tests__/extension.test.ts` — new command-parity/trust/telemetry/webview
  contract tests.
- `README.md`, `LICENSE` — new.

## Redaction: before → after

**Before** — `redactedText` could pass raw `sk-*` / JWT through when a detector
pattern didn't fire; the cache could then store the leak.

**After** — every scan runs the always-on safety net, `redactForSharing` fails
closed line-by-line, `DecisionEngine` throws on any surviving high-risk secret,
and the cache re-sanitizes on write. Example:

```
# input
OPENAI_KEY=sk-test-soter-canary-123456789
AWS_KEY=AKIAIOSFODNN7EXAMPLE
DATABASE_URL=postgresql://user:password@localhost:5432/prod
JWT=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.canary.signature

# redactedText
OPENAI_KEY=[REDACTED_API_KEY]
AWS_KEY=[REDACTED_AWS_ACCESS_KEY]
DATABASE_URL=[REDACTED_DATABASE_URL]
JWT=[REDACTED_JWT]
```
