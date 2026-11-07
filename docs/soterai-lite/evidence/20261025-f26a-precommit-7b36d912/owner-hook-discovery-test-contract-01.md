# F26a owner hook discovery test contract

Authoring under the existing F26a card/plan. `src/__tests__/ownerHookDiscovery.test.ts` has exactly12 grouped Windows cases. No test, production module, wrapper, compiler/build, Git/config query, hook, real child or native editor was executed by this author. The new discovery module is absent before implementation; the root-owned missing-module baseline remains required.

## API and authority

`new OwnerHookDiscovery({context,valid,deadline,now?,createProcess?})` uses a genuine `CheckedOwnerHookContext` before reading capability properties. Its worker factory receives exactly the same context, a `version` or `config` operation, a guarded validity callback, the one aggregate deadline and optional injected clock. The default production factory is `OwnerHookGitProcess`; this fixture always injects fake workers, so it does not claim integration coverage of default child creation.

The result is frozen `{status:'COMPLETE',hooksRelative:string,fingerprint:64hex}` or frozen value-free `{status:'UNAVAILABLE'|'STOP_UNCONFIRMED'}`. `start()` is one-shot; `closed`, `busy`, `withdraw()` and `canRelease(exactCompletedResult)` preserve actual ownership and sticky authority. No raw projection/origin/key/credential is exposed in the result.

Version must complete and actually close before its exact pinned text is accepted through the existing version recognizer. Only then may a config worker exist. The supported complete projection is parsed by OwnerHookProtocol: empty selects `.git/hooks`; one supported local custom value preserves that relative path; unsupported scopes/includes/duplicates/malformed frames withhold the whole result. The framing contract is already backed by root's retained synthetic `owner-config-framing-witness-01.json`.

The fingerprint binds a fixed domain, exact root and raw projection via SHA256. Tests intentionally do not duplicate an implementation serialization. They require lowercase64hex, stable repeated observations of the same root/raw bytes and different values for a changed hook path, an equivalent selection with changed raw origin framing, or another root.

## Twelve grouped cases

1. Disabled and structurally forged/accessor/proxy/undefined contexts create zero workers and invoke zero capability traps.
2. Useful default and in-root custom selection complete through version/config with metadata-only frozen results and releasable exact identity.
3. Nonlocal scopes, include/includeIf, duplicate records, truncated framing and malformed UTF8 withhold wholly.
4. Unpinned/empty/trailing/private-looking version bytes prevent the config query.
5. Exact sequential phase options use the same genuine context/owner environment and original aggregate deadline; version time does not renew config's budget.
6. Fingerprint stability and independent root/raw/path change controls.
7. A worker returning premature COMPLETE while its `closed` is pending cannot advance phases, finish discovery or release a result.
8. Active withdrawal returns STOP_UNCONFIRMED while preserving busy ownership until the held fake worker is naturally finished; no forced close/signals.
9. Pre-start withdrawal is sticky and creates no worker; repeated starts cannot schedule another query.
10. Release requires exact result identity; clones/proxies refuse without traps; flag withdrawal, local config drift and restore remain sticky; reentrant withdrawal or elapsed time inside the final callback cannot release a held result.
11. Invalid initial deadlines/clocks, late reversal/nonfinite clocks, hard60sec aggregation and independently bounded phase payloads withhold.
12. Closed UNAVAILABLE/STOP_UNCONFIRMED transport outcomes, malformed nonBuffer payloads and a throwing factory cannot yield partial selection.

Fake workers expose held outcomes and separate natural completion. All generated workers are asserted to start exactly once and never receive kill/destroy calls. Temporary ordinary roots contain manual empty SHA1 DIRC, inert config/HEAD and genuine internally prepared metadata; every fixture root/job is retained. Injected discovery clocks stay valid through admission before explicit expiry, and no actual executable is spawned.

## Scope limits and custody

Even a complete result only has the current captured local/env/policy capability. It does not automatically witness current external global/system file contents. The caller must run discovery again before/after installer mutation and before publishing its state. A future external commit environment/config override, hook edit or bypass can avoid hook invocation and remains a cooperative limit. Fingerprints are comparison metadata, not an OS boundary or secret-value promise.

`owner-hook-discovery-preproduction-01/` contains exact current context/process/protocol/metadata reference snapshots and the authored test copy. `owner-hook-discovery-author-freeze-01.json` binds those bytes,12 declared cases, the absence of new OwnerHookDiscovery production and this contract. It records authoring/custody only, with no static compiler or behavior PASS claim. Root must retain an actual baseline before implementation and then run fresh discovery/current compiler/combined checks.
