# Cross-IDE test results — recording template

This is a blank record. Copy it per run and fill only cells you actually executed. **No fake results.** If a step was not performed, write NOT-RUN or BLOCKED with a reason — never PASS by assumption, inference, or analogy to another host. A single canary/secret leak or non-loopback scan is FAIL (and score 0) for that run, regardless of other passes. See `docs/cross-ide-real-user-test-plan.md` for scenario definitions, criteria, and the score rubric.

## Run header

- Editor + version:
- Adapter package + version:
- OS + architecture:
- Sample project(s):
- Broker version + port:
- Tester:
- Date:

## Scenario results

Result values: `PASS` / `FAIL` / `BLOCKED` / `NOT-RUN`. Leave notes concrete (what was observed), and name any blocker.

| # | Scenario | Result | Notes | Blocker |
|---|---|---|---|---|
| 1 | Install |  |  |  |
| 2 | Start / connect broker |  |  |  |
| 3 | Scan selection with canary |  |  |  |
| 4 | Redact |  |  |  |
| 5 | Scan file |  |  |  |
| 6 | Scan workspace |  |  |  |
| 7 | Safe Mode |  |  |  |
| 8 | Memory inspector |  |  |  |
| 9 | MCP scan |  |  |  |
| 10 | Terminal check |  |  |  |
| 11 | Git diff scan |  |  |  |
| 12 | Export report |  |  |  |
| 13 | Uninstall / reinstall |  |  |  |
| 14 | Offline mode |  |  |  |
| 15 | Broker-stopped mode |  |  |  |
| 16 | Wrong-token mode |  |  |  |
| 17 | Restricted-workspace mode |  |  |  |
| 18 | Performance |  |  |  |

## Privacy / security confirmation

Fill explicitly. Do not mark supported without these.

- Canary string absent from UI, report, and ledger:  (yes / no / not-checked)
- Canary/secret absent from adapter and IDE logs:  (yes / no / not-checked)
- All scan traffic stayed on `127.0.0.1` (loopback only):  (yes / no / not-checked)
- No data sent to SoterAI Cloud by default:  (yes / no / not-checked)
- Broker-stopped failure was graceful and secure (no insecure fallback):  (yes / no / not-checked)
- Wrong/blank token was rejected (adapter did not proceed):  (yes / no / not-checked)

## Compatibility score

- Score (0–5, per the rubric):
- One-line justification (must reflect security/canary outcomes; any leak or insecure fallback = 0):

## Verdict

- Support statement for this editor × OS (supported only at score 5 with linked evidence; otherwise state exactly what is missing):
