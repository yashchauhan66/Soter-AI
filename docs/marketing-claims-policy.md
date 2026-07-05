# Marketing Claims Policy

## Purpose

Security claims must be specific, measurable, current and reproducible. SoterAI reduces risk as one defense-in-depth layer; it does not make a model, application, agent, browser or computer completely secure.

## Forbidden claims

- “100% secure,” “100% protection,” “zero risk,” “risk-free,” “unhackable,” “unbreakable,” or “stops all attacks.”
- “World’s best,” “most comprehensive,” “market leader,” or “better than [vendor]” without an independent, current and like-for-like study.
- “SOC 2 certified,” “ISO certified,” “DPDP compliant,” “HIPAA compliant,” or equivalent unless the exact product/scope and valid evidence support it.
- “Real-time,” “zero latency,” “under 50ms,” or uptime/scale numbers without a defined measurement boundary and current artifact.
- Passing a synthetic test suite described as independent audit, penetration test, production efficacy or certification.
- Tiny-category “100%” results presented without numerator/denominator, corpus and limitations.

## Allowed claim template

> In benchmark version **[version/hash]**, the **[exact component]** achieved **[metric]** on **[N attack / M benign cases]** at **[threshold/FPR]** in **[environment]**. The benchmark was **[internal/independent]**, excludes **[boundaries]**, and does not guarantee detection of every attack. Reproduce it with **[command/link]**.

Examples currently supportable if the checked-in artifact is reviewed and unchanged:

- “The deterministic analyzer recorded 84.3% recall and 0.54% false-positive rate on a disclosed internal 1,218-case corpus.”
- “Analyzer CPU latency in that run was approximately 4.6ms p50 and 7.1ms p95; this excludes HTTP, authentication, Redis, database, persistence and network time.”
- “The repository test suite passed 665 tests on 2026-07-05.”

Always place the limitations and reproduction link adjacent to the number.

## Claim evidence levels

| Level | Evidence | Permitted wording |
|---|---|---|
| E0 | Feature/code exists | “Includes,” “supports in preview” if limitations shown |
| E1 | Unit/regression tests | “Tested against [named internal cases]” |
| E2 | Reproducible internal benchmark/integration | Exact measured result with method |
| E3 | Authorized customer pilot/staging evidence | “Observed in [scoped environment]” with permission |
| E4 | Independent assessment | “Independently assessed by…” with scope/date/report |
| E5 | Certification/attestation | Exact certification, entity, scope and validity period |

Do not promote an E0/E1 feature as production-proven or an E2 result as independent.

## Required claim record

Every quantitative or compliance claim needs: owner, exact text, surface, evidence URL/artifact hash, component boundary, environment, corpus/sample, date, expiry/review date, limitations and approval. Expired evidence removes or downgrades the claim automatically in the release checklist.

## Competitor comparisons

- Compare the same capability, version, configuration, environment and metric.
- Cite primary public documentation and date the observation.
- Use “public documentation did not identify…” rather than asserting absence.
- Separate feature breadth from efficacy, latency, scale, support, certification and price.
- Give the compared vendor a correction path before publishing a named matrix.

## Review checklist

- Is the subject the analyzer, API, extension, agent control, or whole platform?
- Is the metric boundary explicit?
- Are sample size, FPR/threshold and dataset provenance visible?
- Is the result current and reproducible?
- Is “internal” versus “independent” unmistakable?
- Are false positives, false negatives and residual risk acknowledged?
- Does the UI/demo avoid turning “risk score 0” into “zero risk”?
- Are historical reports labeled historical and prevented from contradicting current evidence?

Recommended default sentence:

> SoterAI is a defense-in-depth AI security control plane that helps detect, block, redact, review and audit selected AI risks. Effectiveness varies by use case and configuration, and false positives and false negatives remain possible.
