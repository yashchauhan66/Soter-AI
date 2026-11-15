# Synthetic security evaluation

Run from the repository root with locally installed dependencies:

```powershell
node --test scripts/__tests__/soterai-security-eval.test.cjs
node scripts/soterai-security-eval.cjs --out output/security-eval-new-run --iterations 3
```

The output parent must exist and the requested directory must be new. Existing evidence is never overwritten. The command writes JSON and Markdown summaries with fixture identifiers, counts, per-class confusion matrices, source hashes and latency; it does not emit payloads, registrations, credentials or raw exception text. Use the JSON for per-class rates and denominator coverage. Null rates mean there are no conclusive positive or negative cases in that class.

The fixed JSON corpus and materialized corpus are hashed separately. Materialization only expands declared synthetic values and explicit encodings. Current first-party TypeScript source is loaded with the repository source alias loader; its loaded source files are hashed and checked for changes during the run. The same-repository corpus is public and is not an independent or held-out evaluation.

The gateway cases call the actual `BrokerServer.handle` request pipeline with in-memory HTTP streams and an injected public provider reply. The server never listens, and the harness never sends a network request. Scanner and redactor behavior is reused from production. The safe-reader cases inject deterministic state changes while approval is pending. Vendor checks use synthetic artifact bytes with an explicit fixture pin and a separate production-pin refusal control. These checks do not measure native IDE routing, installed vendor compatibility, vault custody, filesystem race behavior, provider output quality or human usability.

Supported cases, outside-contract cases and unsupported inputs have separate denominators. An incomplete scan, size-limit refusal, unsupported attachment, approval requirement or component error never counts as a true positive. A conclusive sensitive case forwarded unchanged counts as a false negative; an intervention on a benign case counts as a false positive. Safe-reader and artifact cases use the same matrix to measure refusal of the declared invalid state, rather than content detection. The public workflow measure is exact request/result preservation for the labelled public controls, not model task success.

Every case runs the requested number of times; the confusion matrix counts each fixture once, while latency includes every measured iteration. A public gateway warmup is excluded. Reported latency includes per-case scanner/broker construction and in-process work, not module import, UI, network or model time. Unstable outcomes are listed explicitly.

Exit code 0 means the run completed without supported-case errors, false positives, false negatives, incomplete supported cases, source drift or outcome instability. Exit code 1 retains the measurements while flagging those findings. Expected outside-contract misses and correctly refused unsupported inputs do not fail that gate. Exit code 2 means the harness could not produce a report. None of these exit codes establish release readiness or universal protection.
