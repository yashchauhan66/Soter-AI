# Expected and observed evidence contract

**INFERENCE — Status, 2026-10-10 (Asia/Calcutta).** This is a reporting template, not an execution result. The [assertion result sheet](assertion-results-template.csv) starts with `actual_outcome=NOT_TESTED`, `acceptance_status=UNTESTED` and `positive_control_actual=NOT_OBSERVED`. Empty actual fields mean no observation. Never fill them from expected text or change them to PASS on runner completion alone.

**FACT — Authoritative source URLs and dates.** Outcome labels come from the [specification](../../phase0/guarantee-spec.md), dated 2026-10-09. Acceptance grading and positive controls come from the [acceptance criteria](../../phase3/acceptance-criteria.md), dated 2026-10-09. The documents distinguish observed execution labels from acceptance conclusions.

| Field group | Required contents |
|---|---|
| Record identity | INFERENCE: immutable unique run and observation IDs; client date/timezone, UTC observation time, verifier identity and fresh-session declaration; exact builder/verifier model IDs/versions. |
| Product identity | INFERENCE: source/release revision and SHA-256; manifest SHA-256; each executed release-artifact SHA-256; dirty-dependency/source identity and reproducibility limitations where present. |
| Matrix and topology | INFERENCE: requested cell, actual OS build/editor/agent/model versions, CLI/extension/fork mapping, local/remote topology and deployed selected-architecture boundary. |
| Authority | INFERENCE: authenticated principals, controller/store/editor/confirmation/enforcer identities, enrolled workload and launch epoch; actual effective ACL/management/session ownership and available privileges. |
| State | INFERENCE: authoritative policy/enforcer/witness/revocation epochs, item/region/key fixture identity/revision/hash, acknowledgement state, consent/request/grant scope/use count/expiry and prerequisites. Use synthetic fixture hashes/identifiers, never real secrets. |
| Expected result | INFERENCE: assertion ID, its exact expected-result text, its positive/control expectation and the boundary at which that result is required. |
| Actual result | INFERENCE: actual operation and observed boundary; actual outcome label, captured protected-byte/authority result, observation artifact path/hash and actual positive/control result. Preserve absence/errors/timeouts. |
| Timing | INFERENCE: monotonic elapsed-time evidence where needed; A19's serialized revocation decision tD, enforcement acknowledgement tA and release/cancel/drain observations, without treating pre-tD disclosure as recallable. |
| Conclusion | INFERENCE: separate acceptance status, reason, scope, prerequisites/capabilities missing, untested subpaths, residual limitations and independent-evidence provenance. |

**INFERENCE — Separate columns.** `actual_outcome` records an execution observation using only the original labels below. `acceptance_status` records `PASS`, `FAIL`, `INCOMPLETE` or `UNTESTED`. Preserve raw labels and raw records even when the corresponding acceptance status differs. Record helper-runner pass/fail/skips separately; they never fill full-boundary acceptance fields automatically.

| Actual outcome | Acceptance treatment |
|---|---|
| BLOCKED_SCOPED | INFERENCE: a managed/scoped denial is evidence only for that path; it cannot establish a mandatory-boundary PASS by itself. |
| BLOCKED_BOUNDARY | INFERENCE: use only for independently demonstrated mandatory enforcement at the required boundary; PASS also requires matching exact identity/state and the corresponding working positive controls. |
| LEAK_CONFIRMED | INFERENCE: FAIL for the applicable confidentiality assertion. Preserve measured disclosure and recipient/boundary; do not replace the label with runner PASS. |
| NOT_TESTED | INFERENCE: UNTESTED for requested but unevaluated assertions/cells. |
| SKIP | INFERENCE: preserve the reason; missing coverage remains UNTESTED or INCOMPLETE, never PASS. |
| ERROR | INFERENCE: INCOMPLETE unless captured evidence independently establishes a failure; an error is not secure denial. |
| UNSUPPORTED | INFERENCE: preserve the unsupported prerequisite/topology; it supplies no PASS and must remain in coverage reporting. |

**INFERENCE — Positive/control rule.** Every acceptance assertion has an exact positive/control expectation in [expected-results.md](expected-results.md). Record its actual observation for the same identity, bundle, policy and configuration. Blanket denial, missing fixture, unavailable permission, stopped capability, missing capture, timeout, mock-only behavior, ignored command or installed extension never supplies a PASS. If the protected path denies but the relevant public/authorized control does not work or is not observed, the conclusion is INCOMPLETE. Disclosure or excess authority remains FAIL even when a control fails.

**INFERENCE — Narrow evidence and preservation.** Report independently established source facts as `SOURCE_CONFIRMED`, inherited claims as `HISTORICAL_REPORTED`, and unobserved possibilities as `HYPOTHESIS_NOT_REPRODUCED`; these are source-provenance labels, not execution results. Tag narrative claims `FACT` with supporting source URL/date, `INFERENCE` with its basis, or `SPECULATION` with the missing evidence. Keep failed runs and prior artifact versions immutable. Local hashes provide review provenance; they are not an independently anchored operational audit.

**INFERENCE — Success-count rule.** Count actual protected disclosure or excess-authority successes and report all of them. Do not issue the specified zero-success wording if any success exists, observations are missing, controls are broken, required cells remain incomplete, or results merely come from a runner's exit status. A verified result may claim only the exact evidenced bundle/threat model/attack-class/cell/topology scope and must list untested combinations and residual risks. An unexecuted kit has no observed success denominator and supports no zero-success claim.
