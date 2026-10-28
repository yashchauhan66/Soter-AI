# F27 compiled runtime evidence fixture implementation plan

> **For agentic workers:** Follow the already authorized parallel evidence authoring method. Root owns serial production verification, artifact binding, review, and any later execution. This plan does not authorize a launch.

**Goal:** Prepare actual packaged MCP stdio and owned broker CLI checks for the exact new F27 VSIX.

**Architecture:** A fail-closed binding guard verifies original source proof04 (1016 files), current serial receipts, offline archive provenance, all 15 archive entries, four runtime hashes, installed tool pins, and the fixture's own bytes. The runner copies only verified archive bytes to a new ordinary D: synthetic profile/workspace, then owns one actual compiled child at a time until its actual close and both pipe EOFs.

**Tech stack:** Node built-ins, existing pinned `audit-release.cjs` and installed `yauzl`; no runtime TypeScript loader, runtime imports, mocks, network provider, or VS Code launcher.

**Spec:** `work-card-01.md`; parent assignment for compiled runtime authoring; `ledger.md` latest F27 receipt.

## Global constraints

- Authoring only: `PREPARED_NOT_EXECUTED`; no production edits, tests, launches, downloads, Git, login, real secrets/history, normal profile, OS changes, or F26a/native06.
- Exact candidate: `packages/soterai-lite/soterai-lite-0.7.0-f27-20261027-attempt01.vsix`; never derive current bindings from an old artifact or infer missing receipts.
- Original proof04 SHA-256 `aec34a157a5d2b44a4d2040a4f469a029719f09b34b167ff26835daa77b782a8`, 197439 bytes, 1016 files; current compiler06/backend03/full02/readiness02/package01 required.
- New immutable outputs only; retain prior failures; one attempt, no retries. Numeric `127.0.0.1`, owner IPC session, port0, synthetic credentials, scrubbed environment.
- Stop only by stdin EOF (MCP) or exact owner IPC STOP (broker). Deadline retains ownership, drains both bounded pipes, records failure, and prevents any later phase; no signal or forced stop, including signal0.

## Review focus

- Stale artifact/source/test attribution: guard checks exact hashes and original proof before/after every phase.
- Diagnostic leakage: preserve raw bounded streams, assert no synthetic canary/label/token/session/path, then validate the enabled diagnostic schema and public port/status values.
- Availability mistaken for prevention: off/default-off broker remains healthy but produces no diagnostic lines and withholds owned event export.
- Protocol corruption: MCP has fixed numeric IDs, valid initialize/ping/list responses, fixed unknown method/tool categories, and a subsequent ping.
- Unconfirmed closure: deadline never implies completion; acceptance requires actual exit0, actual close, null signal, both EOF, no overflow/error/deadline.

## Task 1: prepare and review exact bindings

**Files:** Create `compiled-runtime-binding-01.template.json` and `compiled-runtime-fixture-01.cjs` in this evidence directory.

- [x] Read ledger first, prior H26c guard/native runner/pipe ownership module, exact-byte audit/build utilities, ownedBrokerCli test, MCP stdio, auth routes, and child environment rules.
- [x] Author an intentionally unbound template. Root must create a separate new bound JSON with explicit hashes, six complete current receipt groups, 15 entries, four runtimes, build provenance, and the fixture pin. Never edit original proof04 or historical failures.
- [ ] Root reviews and binds only after current serial chain/package completes. `--binding PATH --sha256 EXACT_BINDING_SHA256` is mandatory; template status/null fields refuse before D: writes or child launch.

## Task 2: compiled checks after explicit root review

- [x] Prepare one MCP child: initialize1, ping2, tools/list3, unknown canary method4, unknown canary tool5, ping6; no safe-read call/provider/ticket. End stdin, retain six actual replies and empty stderr.
- [x] Prepare three actual CLI children: enabled, explicitly off, default off. Each gets owner IPC, port0, isolated storage/home, distinct synthetic credentials, authenticated health/version/owner status, public scan, control-authenticated unknown route404, malformed scan400, and owned event/export checks.
- [x] Prepare bounded raw pipe collection, exact expected diagnostic schemas, actual close/exit/EOF receipts, and graceful STOP in all paths.
- [ ] Later execution and syntax checking remain root-owned and have **NOT_RUN** status at authoring time.

## Coverage limits

This prepares packaged Node runtime evidence only. It is not actual VS Code host/UI/restart/human coverage. MCP getter-based detector exceptions cannot be represented on JSON stdio and are not claimed. Startup refusal natural1 and arbitrary native crash dumps/transient memory are not covered. No fallback TS import or mock replaces these missing routes. All original feature, affected-family, functional/security, withdrawal, acceptance and commit/byte barriers remain required.
