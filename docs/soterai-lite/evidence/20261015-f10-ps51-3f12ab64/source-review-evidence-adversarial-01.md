# F10 parser/PUBLIC worker static review 01

Reviewer `/root/evidence_adversarial_review`, same-lineage independence LOW. Review resumed through the same normal route after the retained service-limit failure; that failed attempt is not retroactively counted as a completed review. Closing clock 2026-10-16 03:12:44 UTC. Scope: current parser and PUBLIC worker against frozen design01/02, current frozen parser/worker tests and design04's trusted dispatcher responsibility. No production/test edits, test execution, shell operation, build, native host or network/model call occurred. This unique note is the sole write.

## Findings and disposition

No concrete parser expression-evaluation escape, command-prefix execution path, UTF8-surrogate conversion flaw or budget bypass was found in this bounded source review. The parser bounds the entire string before lexing, rejects controls and lossy UTF8, checks individual token bytes/counts and recognized arity/options, freezes fresh results and preserves accepted literal case/Unicode. Quoted punctuation is data; the worker receives copied JSON operands rather than a reconstructed command. The exact two dollar forms have the frozen literal-only interpretation. Path validation is lexical and does not establish filesystem containment by itself.

No additional high-confidence standalone worker lifecycle/schema defect was identified. The worker copies strict own-data PUBLIC operations, rejects extra fields/accessors/sparse/extra-property arrays, rechecks action-specific operand bounds and bounds the serialized protocol. The encoded script is fixed, module-qualified built-ins consume data operands, and stdin carries no source-derived executable text. Spawn uses the pinned absolute executable with a fresh minimal environment, no shell or normal user profile. Close ownership precedes nullable pipe setup; available pipes continue draining after cancellation. Output remains withheld until real child close and both channels drain. Reentrant guard/output cancellation is checked again before final publication; output callback errors have constant withholding rather than a raw fallback. Cancellation does not kill a process or resolve an unclosed child.

**I/O containment dependency, reported and assigned to integration:** PUBLIC list itself sends a relative directory to Get-ChildItem without filesystem checks inside the worker. A relative name can denote a junction outside the root; lexical refusal alone is insufficient. The root clarified that design04 assigns canonical root/directory capture and a retained enabled guard to the trusted dispatcher. The worker is not a public arbitrary-root execution command, and frozen mocks intentionally use nonexistent roots. This is therefore a required integration regression, not a request to weaken/replace those frozen worker fixtures or force filesystem work into their host-free path.

Required integration controls: an initially external-pointing synthetic junction must be refused before worker request release; a captured ordinary directory switched to such a junction before spawn/protocol send must invalidate the retained guard and send no operation; cancellation/output withholding must retain ownership until the mock child's actual close. Pair these with an unchanged ordinary in-root directory that remains usable. Use mock dispatch/child release to test the outside-pointing case; do not actually enumerate an outside directory through a native worker. The worker already checks enabled before spawn, again before stdin.end on spawn, during polling/data and final output; correctness depends on the caller's guard actually binding that canonical target and policy/root state at those points. This review does not certify the not-yet-reviewed dispatcher implementation.

No new tests were authored merely to restate the implementation. The root reported 68 frozen cases PASS, including three finite actual installed PS5.1 cases; this reviewer read the fixtures but did not execute or independently recalculate that receipt. Those finite version/write/cancel cases do not prove profile registration, complete dispatch, COPY, Git or native consent routes. Package/runtime identity, actual profile/default setting diff/undo, supported-tool coverage and independent human review remain separate gates. No rating or coverage promotion is assigned.

## SHA256 snapshots

Parser/worker source hashes matched again unchanged at review close.

| Path | SHA256 |
| --- | --- |
| `packages/core/src/PowerShell51Command.ts` | `ca54087a3f1720f72eb8b6afac48b6b683f29ef45b4ade5c532f3520c9588e80` |
| `packages/vscode-extension/src/terminal/PowerShell51Worker.ts` | `df165df6c0d7030a0df5a6e41785fcdc75518294186b72255fdbc884264fd20e` |
| `packages/vscode-extension/src/__tests__/powerShell51Command.test.ts` | `9a96f77a731b104bec3696c487be1300a2c1f0f5d29676c431d2d31a0478aeb7` |
| `packages/vscode-extension/src/__tests__/powerShell51Worker.test.ts` | `353acfc4146d87141dd28b6697816115ee50aadce3ce19b1f31f2980403e1913` |
| `design-01.md` in this evidence directory | `82f918488881a9d43b245e8b0a4e22b99ab70c908b5acb88f569c8b1630d6b67` |
| `design-02.md` | `fe57221b463dcb396617b53b39239e3cd89aca848266a7aa0d0a1fcbd4016fd3` |
| `design-04.md` | `b2c1a5dbccfc9edd434ac57a83791e46609130a38dc409a6a3ecc06c3544678a` |

Only narrow source/design/test reads, filename inventory, SHA256 metadata and clock queries were used. Long batched output was truncated by the tool once; the affected worker fixtures and remaining parser tail were reread narrowly before this note.
