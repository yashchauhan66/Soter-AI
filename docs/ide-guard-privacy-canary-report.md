# SoterAI IDE Guard — Privacy & Canary Report

**Scope:** Prove that no raw secret material leaves the redaction boundary of the
IDE Guard — in `redactedText`, clipboard output, the hash cache, telemetry,
logs, webview HTML/state, or exported reports.

## Canary values

The four required canaries (plus additional high-risk classes) are exercised by
`packages/guard-core/src/__tests__/redaction.test.ts`:

| Class | Canary |
| --- | --- |
| OpenAI-like key | `sk-test-soter-canary-...` |
| AWS access key | `AKIAIOSFODNN7EXAMPLE` |
| Database URL | `postgresql://user:password@localhost:5432/prod` |
| JWT | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.canary.signature` |
| GitHub / Bearer / Stripe / Razorpay / Private key | additional coverage |

## Defense-in-depth architecture

1. **Detector pass** — `SecretDetector` (+ others) produce typed, position-based
   matches. Broadened patterns now include a calibrated OpenAI-like `sk-[A-Za-z0-9_-]{16,}`
   catch-all, relaxed JWT (`eyJ…` with short middle/signature segments), bearer
   tokens, GitHub/GitLab tokens, DB URLs, private keys, and AWS keys.
2. **Always-on safety net** — `redactText()` runs a pattern-based redaction pass
   **even when detector findings are supplied**, so anything a detector missed is
   still masked. Detector-based + pattern-based redaction are merged, not
   either/or.
3. **Fail-closed sharing** — `redactForSharing()` runs the safety net, then
   asserts via `findSurvivingSecrets()`. Any line that still contains a secret is
   replaced wholesale with `[REDACTED_LINE_CONTAINED_SECRET]`.
4. **Hard invariant** — `DecisionEngine.scan()` throws if any high-risk secret
   survives into `redactedText`.
5. **Cache sanitization** — `HashCache.set()` runs `sanitizeDecisionForCache()`,
   scrubbing `redactedText`, `evidencePreview`, and finding evidence before
   storage. No raw input content is ever cached — only the hash + sanitized
   decision.

## Leak-surface coverage

| Surface | Guarantee | Test |
| --- | --- | --- |
| `decision.redactedText` | Invariant throws on survivor; canary block redacts clean | `redaction.test.ts` → "DecisionEngine never emits raw secrets" |
| Clipboard | Only `decision.redactedText` or `redactForSharing(...)` is written | `extension.test.ts` → "Redaction / clipboard safety" |
| Hash cache | `sanitizeDecisionForCache` + serialization check | `redaction.test.ts` → "HashCache never stores raw secrets" |
| Telemetry queue | Event uses `evidencePreview` only; no `redactedText`/content | `extension.test.ts` → "Telemetry contains no raw content" |
| Logs | No token/content in `console.*`; token in SecretStorage | `extension.test.ts` → "SecretStorage token hygiene" |
| Webview HTML/state | CSP on every panel; all fields `escapeHtml`-escaped | `extension.test.ts` → "Webview hardening" |
| Evidence/findings | `EvidenceMinimizer` masks match content | `redaction.test.ts` → "EvidenceMinimizer never exposes raw secrets" |
| Exported report | Only redacted evidence fields serialized | `commands.ts` `scanGitChanges` / `exportLocalRiskReport` |

## Acceptance

After scanning/redacting the canary block, the redacted output contains **zero**
raw canary values — only masked placeholders such as `[REDACTED_API_KEY]`,
`[REDACTED_AWS_ACCESS_KEY]`, `[REDACTED_DATABASE_URL]`, `[REDACTED_JWT]`.

_Test results are recorded in `docs/ide-guard-p0-fix-final-report.md`._
