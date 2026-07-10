# When to use each guard mode

SoterAI exposes several guard surfaces. Calling only the general text guard
(`/api/guard/input`) leaves agent, tool, and RAG risks partially uncovered — the
general guard analyzes *text*, while the specialized surfaces enforce *policy*
(per-tool rules, approval/escrow, blast-radius limits, tenant/namespace ACLs).

To close that gap, every `/api/guard/input`, `/api/guard/output`, and
`/api/guard/analyze` response now carries a **routing advisory** under
`metadata.advisory`. When the general guard sees text shaped like an agent
action, a tool invocation, or poisoned retrieved content, the advisory names the
specialized endpoint and SDK method that fully cover it. The advisory is purely
additive — it never changes the allow/block decision or any existing field.

## Advisory shape

```jsonc
"metadata": {
  "advisory": {
    "riskClass": "TOOL_ABUSE",            // dominant risk class
    "severity": "HIGH",
    "recommendedEndpoint": "/api/agent/tool/check",
    "recommendedSdkMethod": "guard.toolCall()",
    "safeNextAction": "…plain-language next step…",
    "generalGuardSufficient": false        // false ⇒ use the recommended surface too
  }
}
```

## Mode selector

| If you are guarding…                                   | Use this endpoint                     | SDK method                     |
| ------------------------------------------------------ | ------------------------------------- | ------------------------------ |
| A user prompt before the model                         | `POST /api/guard/input`               | `guard.input()`                |
| A model response before returning it                   | `POST /api/guard/output`              | `guard.output()`               |
| Arbitrary text, direction-agnostic (no API key)        | `POST /api/guard/analyze`             | `guard.analyze()`              |
| An autonomous **agent action** (goal/plan execution)   | `POST /api/agent/action/check`        | `guard.agentAction()`          |
| A **tool / function** invocation (shell, db, payment…) | `POST /api/agent/tool/check`          | `guard.toolCall()`             |
| **Retrieved / RAG document** content before indexing   | `POST /api/rag/document/trust-score`  | `guard.rag()`                  |
| A grounded answer against its cited sources            | `POST /api/guard/grounding`           | *(project-scoped; server-side)* |

`guard.agentAction()`, `guard.toolCall()`, and `guard.rag()` are advisory-friendly
aliases of `checkAgentAction()`, `checkToolUse()`, and `scoreRagDocument()` — they
exist specifically so the `recommendedSdkMethod` the general guard hands back
always resolves to a real, correctly-routed call.

## How the advisory picks a surface

`deriveAdvisory()` (`lib/guard/routingAdvisory.ts`) classifies the payload in
most-specialized-first order:

1. **TOOL_ABUSE** — destructive ops (`rm -rf`, `DROP TABLE`, `truncate`, …) or a
   tool invocation combined with unbounded intent → `guard.toolCall()`.
2. **EXCESSIVE_AGENCY** — autonomous / no-confirmation / looping agent framing →
   `guard.agentAction()`.
3. **RAG_INDIRECT_INJECTION** — instructions addressed to "any AI reading this",
   priority-spoofing, `<!-- ai -->` comments → `guard.rag()`.
4. **DATA_EXFILTRATION** — exfil / SSRF risk types → also scan model output with
   `guard.output()`.
5. **SENSITIVE_DATA** — PII / secret detected; general guard is sufficient but
   also guard output on the way back.
6. **PROMPT_ATTACK** — ordinary injection/jailbreak/leak; general guard is
   sufficient (`generalGuardSufficient: true`).
7. **NONE** — clean or benign automation; nothing further required.

When `generalGuardSufficient` is `true`, the general guard result stands on its
own. When it is `false`, route the same payload through
`recommendedSdkMethod` / `recommendedEndpoint` as well.

## Integration notes

- **n8n / VS Code / browser extension / SDK** — read `metadata.advisory` after a
  general-guard call and surface `safeNextAction` to the operator, or auto-route
  to the recommended endpoint when `generalGuardSufficient` is `false`.
- **Backward compatibility** — the advisory only adds a `metadata.advisory` key.
  Existing consumers that ignore it are unaffected.
