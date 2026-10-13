# Project privacy workflow

This workflow is implemented in the local source build. The 2026-10-12 candidate has passed its scoped real VS Code functional checks in isolated synthetic hosts. It has not been installed into the main editor or verified to intercept external AI tools. See [the implementation plan](IMPLEMENTATION-PLAN.md), [Cline assessment](CLINE-ASSESSMENT.md) and [verification report](IMPLEMENTATION-REPORT.md).

## Open the controls

In a trusted local workspace, run **SoterAI: Manage Project Privacy** from the command palette, or open **Project privacy** in the SoterAI sidebar. The page puts three actions together: restrict files, review safe access, and check/revoke sharing. Its visible scope notice explains that these controls govern SoterAI-managed reads.

The flag `soterai.projectPrivacy.enabled` defaults to true and is machine-scoped. The safe reader also requires the existing add-only policy setting. A repository configuration does not supply a persistent allow or approval to this reader.

## Restrict a file

Select **Restrict a file** for a normal project document. Select **Restrict as sensitive** for a document whose entire content should remain withheld even after approval. The existing Explorer SoterAI menu also offers sensitive restriction and safe-view review.

Restrictions are saved as managed denies. Marking a file sensitive saves path metadata, not its contents. A one-time safe read does not delete a deny. Files remain in place; these actions do not rewrite or encrypt the originals.

The 2026-10-12 update stores a manually marked file's deny and sensitive treatment in one retained policy record. Existing legacy marks are validated and committed into that record before managed release; their old metadata is retained. A pending sensitive update withholds reads of that normalized file path until the save settles. Failed saves show an error and do not acknowledge protection. Generic deny relaxation excludes sensitive records; a dedicated sensitive-relaxation workflow has not been implemented.

Known credential-bearing paths are excluded from default managed context. This is a filename/path rule plus explicit user markings; arbitrary private prose in an ordinary document is not universally recognizable. Mark such files sensitive to withhold the whole new safe view.

## Review a saved-file view

Select **Review a safe view** and choose a project file. The native confirmation describes the exact project/file, route, masking treatment and 60-second review lifetime. It does not display original contents. Dismissal releases no text.

For `.env`, `.env.local` and nested dotenv files, the approved output is a schema:

```text
DATABASE_URL=[MASKED]
API_KEY=[MASKED]
PORT=[MASKED]
```

Every value is masked, including ordinary settings. Comments, URL fragments and multiline values are omitted. Assignment-looking lines within quoted values are not treated as field names. Variable names and their count are intentionally shared. Other sensitive formats produce a masked summary instead of parsing out values.

For an ordinary file, one approved saved-file view removes recognized secret values and protected text regions. Unknown private text can remain; the modal states that limit. Unsaved editor buffers are not the reader's input. A content or policy change during review invalidates the request.

The preview is a virtual document containing only the approved safe output. It is not a raw-file opening, clipboard export, plaintext backup or model submission. The programmatic integration command has the same approval service; a caller-provided `approved` or `raw` value does not authorize a read. Cline is not wired to that command in this build.

## Use the managed read terminal

Select **Open read terminal**. This opens **SoterAI Project Reader**, a fixed reader interface. It accepts `read <relative path>`, `help` and `clear`. For example, the supported reader operation `read .env` requests the same native review and returns the schema above after approval. Paths with spaces are entered directly, without shell quoting. Input is deliberately not echoed.

It has no operating-system shell and launches no commands. It rejects unavailable policy, unsafe aliases, outside-project paths, binary/invalid text and files over 64 KiB. Each read needs a new review. Closing it or using Ctrl+C revokes pending managed reads.

This terminal does not intercept PowerShell, bash, Cline's terminal tool or external processes. Those routes retain their existing filesystem access.

## Revoke and roll back

**Revoke pending reads** invalidates outstanding requests and clears SoterAI's safe previews. It cannot recall text already released, copied, captured or sent elsewhere. Closing a managed terminal revokes pending requests; already printed safe output can remain in terminal scrollback.

Turning `soterai.projectPrivacy.enabled` off withdraws the new reader routes, clears their previews and retains saved denies. Legacy original-paste/reveal options then return to their old settings; disabling the flag can weaken those older flows if risky overrides were enabled. Rolling back source code does not delete saved policy or restore file contents because this feature never migrated them.

For rollback of the 2026-10-12 sensitive-policy increment, turn only `soterai.projectPrivacy.atomicSensitivePolicy` off while keeping `soterai.projectPrivacy.enabled` on. This withdraws safe reads and sensitive-marking commands, retains strong records, and does not disable the existing project-privacy masking defaults. Do not downgrade to an older reader that ignores the new sensitive field. This is a logical single-record update, not verified crash-safe or same-user-tamper-proof storage. See [the increment report](ENTERPRISE-I1-REPORT.md).

## Coverage

| Surface | This implementation | Limit |
|---|---|---|
| Default SoterAI project collection | Credential-path and saved-deny exclusions | Other extensions are not compelled to use it |
| Approved dotenv reader | Variable names plus `[MASKED]`, no original values | Names are metadata; direct reads remain possible |
| Approved ordinary-file reader | One review, recognized-secret and protected-region redaction | Unknown private text can remain |
| Sensitive-marked file reader | Whole-content masked summary | Original file still exists and keeps its OS permissions |
| Managed read terminal | Same review/masking service; no shell | Ordinary terminals and Cline commands are outside it |
| Managed paste/reveal overrides | Risky raw choices withheld while the flag is enabled | OS clipboard, direct editor reads and unknown secrets remain gaps |
| Project history, buffers, copies, debug/build output | Existing managed controls only | No complete discovery or access boundary |
| Cline's model/server uploads | No new interception | Cline routing and outgoing traffic are UNTESTED |

An editor modal is not independent user presence. Same-user tools can change user settings or obtain originals through other routes. A complete no-read/no-send contract requires a separately verified agent compartment with protected editing outside that compartment; a second profile by itself does not establish it. Full claim remains BLOCKED; deployment remains DEFERRED.

## Final review dashboard and public development

The separate synthetic review window shows **Covers / Does not cover**, full claim **BLOCKED**, matching bundle hashes, real host results, unit skips, observed native/network failures and bounded agent CLI outcomes. **Refresh state** rereads local evidence. Evidence is editable local metadata, not an independent attestation. Codex/Gemini public-context compatibility passed; Claude Code CLI could not authenticate. No third-party secret-blocking claim follows.

The dashboard offers optional **Prepare public workspace**, **Preview development contract**, and **Start/Stop synthetic preview**. Publication and synthetic runtime default off. Enable their machine flags only for the reviewed workflows. Publication exports explicitly chosen public saved files plus approved dummy configuration into a new folder; originals are not mounted or moved, and no isolation or auto-sync is provided. The preview is a fixed loopback fixture, not your app or database.

Rollback new public workflows with `soterai.projectPrivacy.safePublication=false` and `soterai.projectPrivacy.syntheticRuntime=false`. Preserve the parent privacy setting and saved restrictions. The professional UI, safe composition and atomic-sensitive flags can be withdrawn individually; this withholds their actions rather than releasing originals. Full OS isolation, independent consent/secret custody and mandatory egress remain undeployed. See [final report](FINAL-LOCAL-REPORT.md) and [deployment gates](DEPLOYMENT-GATES.md).
