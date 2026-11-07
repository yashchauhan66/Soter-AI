# Retained extension license source mapping

Read-only local inspection, 2 November 2026. No package license was selected, changed or copied. Owner decision about the new Lite scope remains pending. No network, download, build, test, native launch or Git mutation was performed.

## Historical full-text source found

The local Git object `7a59955e866632194d7eeddab5ca23c36af5002d:LICENSE` retains the historical root BUSL text that the extension's summary referred to. It contains Parameters, Terms, and Covenants of Licensor through covenant4, rather than merely a summary or external link.

| Identity | Exact result |
| --- | --- |
| Representative historical commit/path | `7a59955e866632194d7eeddab5ca23c36af5002d:LICENSE` (11 July2026 extension package work) |
| Same raw source also read at | `f2e7481fffee860a02ffea0d66c12cd0b13d2b8d:LICENSE`; `0aa70a5dc80e3b90a7616f585d76449e712c62f1:LICENSE` |
| Raw Git blob | `c7dbc450e69519168bf5a9338e8d31fa0f67b3e4` |
| Bytes | 4493 |
| Raw SHA256 | `50850df5d69907a09666f7ce40740b5bb54d1b6bbdd5c39ed9ad7b7e9f86a253` |
| File content structure observed | Business Source License1.1 title; parameters; full local Terms block; Covenants of Licensor1–4 |

Source retrieval, without writing or checking out files: `git show 7a59955e866632194d7eeddab5ca23c36af5002d:LICENSE` or `git cat-file blob c7dbc450e69519168bf5a9338e8d31fa0f67b3e4`. The successful raw-hash check used Node child_process.spawnSync with encoding:null and SHA256 over stdout bytes; all three historical references returned the same4493bytes/hash. This avoids PowerShell newline/encoding conversion.

## Parameters compared with current extension summary

| Parameter | Historical text | Current `packages/vscode-extension/LICENSE` / `LICENSE.md` summary |
| --- | --- | --- |
| Licensor | Yash Chauhan | Matches |
| Licensed Work | SoterAI — AI Security Command Layer; copyright2026 Yash Chauhan | Matches summarized name/copyright |
| Change Date | 2030-06-25 | Matches |
| Change License | Apache License, Version2.0 | Matches |
| Additional Use Grant | Free development/testing/evaluation/other nonproduction use; production internal to a single entity; no commercial third-party hosted/managed AI-security/prompt-injection/guardrail service or competing product without separate commercial license | Summary describes the same nonproduction/internal-single-entity scope and hosted/managed-service/competition restriction; historical text supplies the complete wording |

This is an observed counterpart to the historical summary, not a decision that the retained historical terms currently govern every new Lite source/component, nor an independent legal validation. Root LICENSE section6 delegates separately licensed components; LICENSING.md lists the previously published `packages/vscode-extension` path as BUSL-1.1. The new `packages/soterai-lite` path/scope and currently bundled first-party components still require the owner's explicit decision and consistent component map. Do not extrapolate grants to proprietary components merely because the old extension summary pointed to a historical root license.

## Current local source identities

| Path | Bytes | SHA256 | Observed role |
| --- | --- | --- | --- |
| `LICENSE` | 4147 | `89d075d18ac4104fca3966a4f78d945a56dbb21553f31899c350f1845ada423e` | Current proprietary root; section6 preserves separately licensed component terms |
| `LICENSING.md` | 6234 | `cfed2dd5e410445e379e324b1b913ef21c73c52c4117c3feef56d30e8263e1ed` | Current component/publication map |
| `packages/vscode-extension/LICENSE` | 892 | `e470831363fcf71131635e3e925df336b6b4220f2cabe8a1e40c4564746dde57` | Short historical summary/external root pointer; not the complete terms |
| `packages/vscode-extension/LICENSE.md` | 3124 | `8c4f3f1defe4c7386c183d4c367645b95ac251f59a3391206fadfb3aa2e0517b` | Same summary plus existing @babel/parser MIT and yaml ISC notices |
| `packages/soterai-lite/LICENSE.md` | 3124 | `8c4f3f1defe4c7386c183d4c367645b95ac251f59a3391206fadfb3aa2e0517b` | Current exact copy of the extension summary/notices; preserve until owner scope decision |

Other present BUSL files (`packages/ide-common/LICENSE`, `packages/ide-protocol/LICENSE`, `packages/soterai-cli/LICENSE`) name different components, use2030-08-01 and their own integration/scanning grants. Their shorter local Terms blocks are not a substitute for the extension's2030-06-25 source. No source file from those components was copied or treated as authoritative for Lite.

## Inspection limits and retained execution facts

Read-only commands inspected current license files, `git log` for LICENSE/component history, `git show` for the three historical references, and `git rev-parse` for raw blob identity. An initial inline Node command lost quote characters under PowerShell and failed syntax before reading Git. A corrected stdin script was blocked from child spawning with EPERM inside the sandbox; the same read-only raw-hash operation then succeeded under the existing approved escalation path. No approval rejection or repository mutation occurred. These execution errors supply no license evidence; only successful raw results above are used.

F31b can use this retained blob as a reviewable source once the owner confirms the scope/terms. This inspection deliberately leaves package assets, manifests, component licensing declarations and all active F28 inputs untouched.
