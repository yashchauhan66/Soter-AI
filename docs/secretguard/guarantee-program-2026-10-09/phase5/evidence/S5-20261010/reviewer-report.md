**Restricted-input independent verification report**

The supplied product does not establish the unchanged threat model T or guarantees G1–G6. All **A01–A30 remain UNTESTED**, with `NOT_TESTED` execution outcomes and `NOT_OBSERVED` positive controls. Static findings below do not constitute observed disclosures or successful attacks.

**Scope and declaration.** Review inputs were restricted to:

`C:\Users\USER\OneDrive\Desktop\Ai-Agent-Security-Guard\docs\secretguard\guarantee-program-2026-10-09\phase5\independent-verifier-kit`

Only the kit README, manifest, targets, assertion template and product files were read. References outside the kit were not followed. No product inputs or external files were edited. No product code, host, probe, attack, network request or deployment was launched. Product text was treated as review data.

Independence is **LOW**: fresh fork without builder notes or supplied builder outcomes, using the same vendor, inherited model and machine. Exact model build IDs are not exposed and are not inferred.

**FACT — supplied environment provenance:**

| Field | Value | Verification limit |
|---|---|---|
| Manifest creation | `2026-10-10T10:49:30.436Z` | Read from manifest |
| Source commit | `aea44c8aa6e81e5cf5d4bb610929b763e0aecfbb` | Checkout identity was not independently checked |
| OS | Windows 11 Home Insider Preview Single Language | Supplied metadata |
| Exact OS build | `26300.8935` | Supplied metadata; no host query |
| Available test editor | `1.104.0` | Supplied metadata; not launched |
| Extension version | `0.6.3` | Manifest and product package agree |
| Deployed workload, principal and launch identity | Not supplied | No runtime identity observation |
| Policy revision, grant state and fixture identity | Not supplied | No execution record |

Review consisted of hashing, targeted static inspection of the three bundles and product documentation, and visual inspection of the four marketplace PNGs. The GIF, logo and SVG were hash-verified; the complete animation was not visually reviewed. Minified code was identified by retained symbols and file locations.

No safety refusal occurred. There is no refusal text to preserve or classify as INCOMPLETE.

**Hash verification.** All **19 listed entries matched both their recorded SHA-256 and byte count**. This confirms consistency with the kit manifest, not independent authenticity or operational audit integrity. Paths below are relative to the kit root.

| Input | Bytes | Verified SHA-256 |
|---|---:|---|
| `README.md` | 1,900 | `443d4e32a48dd55f6714d9fe2940694618d048b601c674a44a248dc649a0d177` |
| `targets/guarantee-spec.md` | 11,021 | `e8f74544327c3803933b01f68e8022c013a90d95851757bd8d82b0a6a356c28e` |
| `targets/acceptance-criteria.md` | 14,411 | `38a326b90fe10b59e20dd55b959b785e9157b0b700fdbb3fdaba4ae0486f2e59` |
| `assertion-results-template.csv` | 13,937 | `ae2881db67fcbb56973b78b4aca122336a6ac9dbf932ab384e7f4511fc1b2f7a` |
| `product/dist/extension.js` | 634,024 | `853fc442fe868db57b63c9bbf9d4abe31a09afab6cec7b6b30e7239197c5d43a` |
| `product/dist/local-ai-broker.js` | 243,478 | `6c07093d81243f0063bfd8d51b3d23a162cd3b4375c312c75b59e95f8239a397` |
| `product/dist/soterai-mcp-server.js` | 202,258 | `6d5e1199d509139387e542e91faad02b790e692415416bd7eb5510a6e6ecc486` |
| `product/package.json` | 90,434 | `60a50e8f2e0a665b92f1b58721a4427357b5d684e381bf0db6163b777dbe1026` |
| `product/README.md` | 26,663 | `31b8b4e28cc20b2a34b0be8883428a92c2e0d7483b15101c3ae117fff72c3b54` |
| `product/media/icon.svg` | 1,473 | `25cffa9a3674c2d6e69d3a9c76bbcbc5767b1bba39cc1e198e00937876cd1729` |
| `product/media/logo_circle_whiter.png` | 951,992 | `49ba85f42522528544b3d18a234559942935642d6f7fc48e775aaba5042e2173` |
| `product/media/marketplace/control-panel-protection.png` | 58,434 | `09d2b984b953a66acaef33d4b301ff9c278431dc37568c96f9430fe0cab72555` |
| `product/media/marketplace/safe-mode-enabled.png` | 40,402 | `7c9592ed924d480c6a7fa24264c5f8e909b81693b86bb27a60a1850315041cec` |
| `product/media/marketplace/scan-selection-result.png` | 85,954 | `933bea3a9385b982abb640f1d038a76933acd4ca87deb8f60964cb4b774beee8` |
| `product/media/marketplace/secret-scan-result.png` | 45,402 | `ea589616eccf994f58ec0d9fbfc179d867404eb45a814bc1dfc94fbab03cccba` |
| `product/media/marketplace/soterai-secret-caught-before-ai.gif` | 3,006,471 | `f94d09b5661e24e75b7e5fcf847dfcba418d435216d672c38e364ae1d5cbc1f3` |
| `product/media/walkthrough/demo.md` | 514 | `228de710a499a67a09c7b3e9f40d22b3d37060a8cf8a744d723df532634135b3` |
| `product/media/walkthrough/integrate.md` | 446 | `b49b5d56ca6c1dd46fb03b3130439e0fb59206dc0bee6645d0a7d518a6436c0a` |
| `product/media/walkthrough/vault.md` | 450 | `ac664bf6d49833902efadb07b442941c379de6beb4b6fbc402fc739f64fabac9` |

The manifest itself, which has no self-entry, hashes to:

`866c94040d614c44f8b439dbd5ebafb889bfce25e1ee3883a7e7c9e09c04e073`

**Static evidence that supports the narrower managed-path design.** These are `SOURCE_CONFIRMED` implementation facts, with no runtime PASS implied:

- The product README expressly excludes native agents, same-user filesystem/process access, original buffers, clipboard/capture and independent network traffic. It declares selected-architecture G1–G6 UNTESTED and the full claim BLOCKED.
- Managed policy handling retains accepted repository denies in serialized local state. Invalid policy blocks managed context; protected-region digest mismatch withholds content.
- Broker code separates client and controller credentials, rejects shared credentials, binds its listener to loopback and includes token-file/link/ownership and Windows ACL checks.
- Broker ingress checks body limits, framing, compression and strict UTF-8. Provider responses are bounded; the inspected streaming implementation accumulates frames before releasing successful output.
- Capability use reserves its use count before asynchronous work and rechecks capability/reference validity before response release.
- Secret reference IDs have serialized inventory support, and activation recovery purges indexed reference values.
- Runtime status sets `routingEvidence:"unknown"` and `protectedAiTools:0`. MCP and language-model tools explicitly describe their results as advisory.

These controls improve cooperative paths. Their existence does not demonstrate resistance to the same-user attacker in T.

**Findings.** Severity below describes the impact on the required guarantee. Architecture gaps are distinguished from defects in the implemented managed controls.

**VG-01 — Critical — Independent asset custody and protected session are absent from the supplied implementation/evidence.**  
Classification: required architecture gap. Provenance: `SOURCE_CONFIRMED` scope limitation; consequence is **INFERENCE**.

Affected artifacts: `product/README.md`; `product/dist/extension.js`, including context filtering and secret-reference classes.

Supporting text: the README excludes “same-user filesystem/process access,” “original buffers/tabs” and “OS clipboard/capture.” Secret lookup returns plaintext `value` inside the extension process.

Consequence: pathname exclusion, placeholders and local encryption do not establish G1/G5 under T. Protected buffers, Git objects/history, aliases, legacy copies, environment/process state and recoverable credentials require custody beyond the hostile identity. The kit contains no independently deployed protected editor/store boundary.

Defensive repair and expected regression: establish independent custody and enrollment covering originals and reachable legacy representations. Acknowledgement must remain pending when custody is incomplete. Authorized edit/save and public-data reads must work while ungranted workloads obtain zero protected bytes across the required surfaces.

**VG-02 — High — Consent and grants remain tied to editor dialogs, bearer authority and caller-provided identity.**  
Classification: required architecture/protocol gap. Provenance: `SOURCE_CONFIRMED`; consequence is **INFERENCE**.

Affected artifacts: `product/dist/extension.js:818`, `Ht`; `product/dist/local-ai-broker.js:23`, `Jt`/`ApprovalStore`; broker `createApproval`.

Supporting symbols: `Ht` uses `showWarningMessage`; approval validity compares `sessionId` and `contentHash`. The approval dialog explicitly states that the caller session is not independently authenticated. Default once approvals last five minutes; validity uses `Date.now()`.

Consequence: this does not provide G2 physical user presence, enrolled workload/launch identity, signed authoritative scope, independent policy epoch or elapsed-time lifetime. Content approvals do not bind all target dimensions such as item revision, operation, destination and authenticated recipient.

Defensive repair and expected regression: use independently authenticated user presence and exact authoritative transaction scope, with bounded elapsed lifetime and atomic consumption. One correctly authorized transaction must succeed; scope substitution, replay, replacement identity, expiry and revoked epochs must deny without broadening authority.

**VG-03 — Critical — Durable denial and authority ownership remain outside demonstrated coverage.**  
Classification: required custody/OS/lifecycle gap. Provenance: `SOURCE_CONFIRMED` local-state design; deployment resistance is **UNTESTED**.

Affected artifacts: `product/dist/extension.js:260–261`, accepted-rule storage; `product/dist/extension.js:991`, protection state; `product/dist/local-ai-broker.js:25`, `ko`.

Supporting symbols: accepted rules use `soterai.aiForbidden.v1` in extension state; lockdown uses `globalState`. Windows ACL validation requires the current user to own the object and preserve owner full control.

Consequence: additive managed rules and private token ACLs are useful hardening, but current-user ownership does not separate authority from the attacker in T. No independent policy witness, rollback protection, service ownership or denial surviving client removal is demonstrated. The targets’ historical Windows/control-token references were not treated as reproduced current findings.

Defensive repair and expected regression: protect controller/store binaries, credentials, parent directories, policy and management authority from the hostile identity, with independently anchored revisions. Public operations may resume after recovery only when custody and enforcement are valid; loss, rollback or lifecycle changes must preserve protected denial.

**VG-04 — Critical — Mandatory egress and isolated credential-use/private workers are not established.**  
Classification: required architecture/OS boundary gap. Provenance: `SOURCE_CONFIRMED` routed-path limitation; complete transport resistance is **UNTESTED**.

Affected artifacts: `product/README.md`; broker `forwardProvider`/`proxyStreaming`; extension capability `Wo.call`.

Supporting text: the README states that the managed checker “does not provide an OS network allowlist.” Provider forwarding uses ordinary process network access. The standalone broker accepts provider credentials from environment/configuration.

Consequence: routed scanning cannot establish G4 for the entire hostile process tree. The supplied product does not demonstrate mandatory restrictions over alternate protocols/interfaces, helper/MCP routes, or an offline private workload with no display/clipboard bridge. Same-user processing of credential plaintext also leaves G5 authority separation unestablished.

Defensive repair and expected regression: enforce network capabilities outside agent authority and keep protected credential operations/private work in independently constrained compartments. Approved public traffic must reach only its permitted destination; an allowed endpoint alone must not authorize protected export. Exact credential-use controls must succeed without exposing credential plaintext to the hostile workload.

**VG-05 — High — Effective-control evidence, trusted UI and conservative classification remain incomplete.**  
Classification: required evidence/architecture gap. Provenance: `SOURCE_CONFIRMED`; full acceptance is **UNTESTED**.

Affected artifacts: `product/dist/extension.js:991`, runtime status; product README; assertion template.

Supporting symbols: `routingEvidence:"unknown"`; `protectedAiTools:0`. All 30 template rows have blank observations/run IDs and `NOT_OBSERVED` controls.

Consequence: operational health/configuration cannot establish authenticated per-G receipts or trusted P/C presentation. S5-unmarked remains open: recognized-value filtering does not protect arbitrary unclassified private prose. This does not itself demonstrate failure of an explicitly marked-data assertion.

Defensive repair and expected regression: show exact scoped, authenticated, as-of enforcement evidence; classify missing evidence as INCOMPLETE. Conservative sharing must require explicit classification/enrollment. Correct scoped receipts and explicitly marked prose must have working authorized controls; unclassified exposure must remain visible.

**VD-01 — Medium — Lockdown unlock does not use the shared confirmation withdrawal guard.**  
Classification: implemented managed-control consistency defect. Provenance: `SOURCE_CONFIRMED`; runtime outcome not observed.

Affected artifacts: `product/dist/extension.js:1015`, `soterai.unlockProtection`; `product/dist/extension.js:818`, `Ht`; `product/package.json`.

Supporting symbols: the unlock handler calls `showWarningMessage(...,"Unlock")` and then `Tr.unlock()` directly. `Fn.unlock()` sets lockdown `active:!1`. It does not call `Ht`, which checks `hardening.scopedConfirmation` before and after confirmation and supplies the same-user limitation.

Consequence: this relaxation of lockdown does not inherit the shared guard’s withdrawal behavior or disclosure. The scoped-confirmation setting describes guarded protection changes, but this command has a separate path.

Defensive repair and expected regression: route lockdown relaxation through the shared guard, with consistent scope disclosure and post-confirmation validation. When confirmation hardening is disabled, lockdown must remain active; the authorized enabled-mode control must unlock successfully. This repair would not supply independent G2 consent.

**VD-02 — Medium — Manual checker notifications overstate the action taken.**  
Classification: G6 UI defect. Provenance: `SOURCE_CONFIRMED`; user reliance consequence is **INFERENCE**.

Affected artifact: `product/dist/extension.js:991`, `oy` and `Bp`; file-scan notification handler `qd`.

Supporting text: `"SoterAI blocked this send"` and the file-scan message `"File … is safe. No critical issues."` The manual command obtains text, evaluates it, displays a verdict and records an audit entry; it does not intercept an independent transmission.

Consequence: these notifications can imply enforcement or complete safety beyond the detector/checker’s actual action, despite the more accurate README and advisory-tool disclosures.

Defensive repair and expected regression: describe the returned recommendation and recognized-pattern result directly. Manual checks must disclose that the command did not intercept another tool’s transmission; public input and recognized-risk controls must retain usable, accurately scoped verdicts.

**VD-03 — Low — Historical marketplace artwork retains broader success wording.**  
Classification: G6 documentation consistency defect. Provenance: `SOURCE_CONFIRMED` visual artifact.

Affected artifact: `product/media/marketplace/control-panel-protection.png`.

Supporting pixels: `"Fully enforced"`, `"Known gaps 0"` and a claim that routable AI tools use a `"verified SoterAI path"`. The image displays version `v0.6.1`.

Consequence: the standalone asset retains a broader success impression than the supplied product’s evidence. The README’s explicit historical/interface-only caption mitigates this; the image is not a current runtime observation. The other three PNGs show editor selections/diagnostics rather than the result views described by their captions.

Defensive repair and expected regression: replace or visibly annotate artwork with its date, version, managed scope and untested guarantees. The image itself and its caption should agree, and named result captures should show the claimed result.

**VO-01 — Low — Latent one-time reference control flow consumes authority twice.**  
Classification: static functional defect in a non-default branch. Provenance: source behavior is `SOURCE_CONFIRMED`; deployed reachability is `HYPOTHESIS_NOT_REPRODUCED`.

Affected artifact: `product/dist/extension.js:312`, reference class `an` and capability class `Wo`.

Supporting symbols: `an.lookup` rejects `oneTime && useCount > 0`, then increments `useCount`. `Wo.call` performs a lookup before transport and another lookup before response release.

**INFERENCE:** a reference created with `oneTime:true` is consumed by the first lookup, so the second lookup rejects after transport, withholding an otherwise authorized result. **SPECULATION:** external/user reachability of this branch is not established; the inspected redaction caller does not request one-time references.

Defensive repair and expected regression: reserve consumption once and use a non-consuming authority revalidation for response release. One authorized operation using a one-time reference and a public response must return its result once, while revocation during processing must still prevent later release.

**A01–A30 dispositions.** Every row below has execution outcome `NOT_TESTED`, positive-control result `NOT_OBSERVED`, and acceptance status **UNTESTED**. Static observations are not promoted to full PASS or treated as dynamic FAIL records.

| ID | Guarantees | Disposition and limiting evidence |
|---|---|---|
| A01 | G1 G3 G5 | Managed exclusions exist; independent denial over originals, aliases/copies and placeholder custody is not demonstrated. VG-01/VG-03. |
| A02 | G1 G4 G5 | No protected editor/session isolation observation for buffers, clipboard, display, accessibility, memory, dumps or recovery. VG-01. |
| A03 | G1 G5 | Controlled-command environment reduction is static evidence only; launch-tree secret removal and reachable process-state protection are absent from evidence. VG-01/VG-04. |
| A04 | G1 G5 G6 | No versioned public-view enrollment or evidence accounting for existing history, caches, snapshots and derived copies. VG-01. |
| A05 | G1 G3 | Additive path rules and digest-bound selection filtering exist. Full identity/version semantics, regex/environment marks and rename/lifecycle behavior are unevaluated. |
| A06 | G1 G2 G5 | No independently trusted P edit lease, protected save revision or buffer separation. VG-01/VG-02. |
| A07 | G2 G3 | Editor-originated approval/relaxation controls exist; no independent bounded pending-request ceremony or policy authority observation. VG-02; VD-01. |
| A08 | G2 | Fresh matching authoritative P/C physical-verification signatures are not supplied. VG-02. |
| A09 | G2 G5 G6 | Session/workspace strings and bearer credentials do not establish enrolled workload/launch identity. VG-02/VG-03. |
| A10 | G2 G3 | Approval bounds/use checks exist, but independent epoch binding and elapsed-time lifetime are not established; validity uses wall time. VG-02. |
| A11 | G2 G4 G5 | Capability host/method/path limits exist; complete item/version/action/recipient/output binding has no deployed observation. VG-02/VG-04; VO-01. |
| A12 | G1 G2 G3 G4 | Restart, disable, unload, uninstall and controller recovery have no mandatory-boundary evidence. VG-03. |
| A13 | G2 G3 G6 | Malformed managed policy fails closed; independent signed revision/checkpoint/witness and rollback resistance remain absent. VG-03. |
| A14 | G2 G3 G5 | Credential-file checks exist. Independent controller/store/deployment ownership and management restrictions have no deployment evidence. VG-03. |
| A15 | G1 G3 G4 G6 | Several flags withdraw managed functions. Complete protected-launch/release prerequisites and rollback custody are not demonstrated; unlock consistency defect remains. VD-01. |
| A16 | G4 | No mandatory IPv4/IPv6/DNS/transport/interface/helper allowlist observation or approved-public control. VG-04. |
| A17 | G2 G4 | Routed payload filtering exists; exact protected-export consent and independent destination authority remain unestablished. VG-02/VG-04. |
| A18 | G1 G4 G5 | Private D lifetime isolation, no-egress/display/clipboard constraints and protected control-plane handling are not deployed/evidenced. VG-01/VG-04. |
| A19 | G2 G3 G4 G5 | Capability response rechecks exist. No serialized tD/tA observations, active/queued termination or measured one-second objective. VG-03/VG-04. |
| A20 | G1 G4 G5 | Credential injection is statically scoped but executes in same-user components; independent custody and ambient-authority exclusion are not demonstrated. VG-01/VG-04. |
| A21 | G3 G5 G6 | Indexed cleanup and activation purge exist. Legacy inventory, backup/deletion and downstream-revocation outcomes are not observed. |
| A22 | G1 G4 G5 | Redaction and bounded-output checks exist; arbitrary protected prose and all output/error/log/recovery surfaces lack full custody evidence. VG-01/VG-05. |
| A23 | G1 G2 G5 | Pinned/isolated Git launch is static hardening. Independent constrained-helper authority and F16 execution evidence are absent. |
| A24 | G6 | Runtime operational facts are scoped, but no authenticated effective-control receipts are supplied; UI wording defects remain. VG-05; VD-02/VD-03. |
| A25 | G2 G6 | No authoritative independent P/C UI is present in the evidence. Hostile-editor mirror effects are unevaluated. VG-02/VG-05. |
| A26 | G6 | Input hashes are verified. No execution run/observation IDs, fixtures, actual boundary observations or positive controls are supplied. VG-05. |
| A27 | G1–G6 | No exact OS/editor/agent/topology combination has full acceptance evidence. Installation/editor-floor metadata does not certify a cell. |
| A28 | G1 G6 | README acknowledges unmarked-private-text exposure. Conservative classification/enrollment and marked-prose controls are unobserved; detector wording remains inconsistent. VG-05; VD-02. |
| A29 | G1–G5 | MCP tools are expressly advisory; enrolled delegate identities, isolated management authority and remote topology permissions are unevaluated. |
| A30 | G1–G6 | Selected OS/session/management/device/worker prerequisites and resistance beyond setup have no independent deployment observations. VG-01–VG-05. |

**Coverage and decision limits.** The targets request 63 nominal Windows/Linux/macOS × editor-version × agent combinations. No combination has runtime evidence in this kit; all remain explicitly unevaluated. Cursor’s exact fork mapping, agent versions, launch identities, topology and model settings are not pinned here.

The full-T gaps remain applicable even where the product intentionally excludes those paths. Hash agreement, static hardening, screenshots, setup descriptions and operational labels cannot certify mandatory denial. No attack classes were executed and no dynamic confidentiality outcomes were observed, so a zero-success guarantee claim is unsupported.