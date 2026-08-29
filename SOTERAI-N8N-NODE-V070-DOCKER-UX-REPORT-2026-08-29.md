# SoterAI n8n Node v0.7.0 â€” Real Docker and UX Verification

**Date:** 2026-08-29
**Package:** `n8n-nodes-soterai@0.7.0`
**n8n:** `2.27.4`
**Docker Engine:** `29.7.2` on Docker Desktop
**Base image digest:** `n8nio/n8n@sha256:cf11c96b0d0089bb24459bf97b445fd7008f41543b673cce4d955f7c0ed8752d`
**Final test image:** `sha256:01e6e1350c5b1514bcdc14b0f96618bb110df1c06226517f3755064fbe25dd32`

## Scope

This is real n8n runtime evidence, not a mocked transport test. The final npm tarball was unpacked into n8n 2.x's community-node directory in a clean derived image. Workflows were imported into a fresh named volume and executed by n8n's CLI engine. The final image was also started as an editor server and its authenticated node-type metadata was queried.

The host SoterAI API was not running on port 3000 during this run, so cloud passport calls were not represented as live backend evidence. Their request/response behavior is covered by the package integration suite; this report does not relabel those tests as live API evidence.

## Artifact

- Tarball: `n8n-nodes-soterai-0.7.0.tgz`
- SHA-256: `1DAC6F1B528418568804288ACAC915FBED1E69FD546F217D6A87A805AEB9F30C`
- Packed files: 37
- Lifecycle example included: `examples/soterai-agent-passport-lifecycle.workflow.json`
- No production credential or passport token embedded in the example

## Installation

The tarball was installed at:

```text
/home/node/.n8n/nodes/node_modules/n8n-nodes-soterai
```

The derived image was rebuilt after the final UX changes with `--no-cache`, then tested with a new volume so no older package copy could be inherited.

## Real Workflow Results

| Workflow | Input | Result | Physical output | Status |
| --- | --- | --- | --- | --- |
| Safe input | Refund-policy question | `ALLOW`, risk 0 | Safe | success |
| Injection | Ignore previous instructions + reveal system prompt | `CONTENT_BLOCKED`, risk 96 | Flagged | success |
| India PII | Aadhaar + PAN + GSTIN + Voter ID + DL | 5 redactions; cleartext identifiers removed | Safe | success |
| Whitespace | Spaces only | `EMPTY_INPUT`, `SKIPPED`, engine `none` | Safe | success |

Observed India PII output contained:

```text
[REDACTED_AADHAAR]
[REDACTED_PAN]
[REDACTED_GSTIN]
[REDACTED_VOTER_ID]
[REDACTED_DRIVING_LICENCE]
```

All four executions finished with n8n status `success`.

## Real Editor / UX Metadata

The final image was started on an isolated editor port and returned `200 {"status":"ok"}` from `/healthz`. After creating an owner only inside the disposable test volume, authenticated `POST /rest/node-types` returned:

| Field | Observed |
| --- | --- |
| Display name | SoterAI |
| Node version | 2 |
| Properties | 49 |
| Contextual hints | 7 |
| Actions | 12 |
| Passport actions | Numbered and grouped 1 â†’ 5 |
| Passport token editor field | Password-masked |
| Engine selector | Hidden for server-only lifecycle actions |
| Community nodes | Enabled |

Passport lifecycle shown in the editor metadata:

1. Enroll Identity
2. Issue Passport
3. Validate Passport
4. Check Tool Call
5. Revoke Passport

## Other Release Gates

- Package validation: pass
- TypeScript: pass
- n8n community-node lint: pass
- Unit tests: 68/68 pass
- Targeted root integration/reputation/rate-limit tests: 45/45 pass
- ReDoS sweep: 124 regex literals Ã— 15 adversarial shapes, pass
- Stress suite: all cases within budget
- Build and runtime-load smoke: pass
- npm pack dry run: pass

## Honest Limitations

1. The live Docker matrix in this report is Local-engine focused because no SoterAI API process was listening on the host during this run.
2. Local mode remains a pattern-only first filter with the measured recall limitations displayed in-node.
3. A third-party security assessment, production SLA history, and enterprise customer references are external evidence and cannot be created by a local test.

## Reproduction Assets

Local evidence is under `.tmp/n8n-v070-live/` and includes the Dockerfile, generated workflow fixtures, raw execution output, package metadata, and node-type metadata. The retained test image is `n8n-soterai-test:0.7.0-ux`.
