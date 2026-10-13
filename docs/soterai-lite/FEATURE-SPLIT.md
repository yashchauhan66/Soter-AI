# Feature split — SoterAI Lite / Full

Status: P02 split/build/typecheck/unit/content inspection PASS; exact-object host baseline and frozen catalog remain P03. No product behavior upgrade or coverage promotion is implied by this inventory.

Lite is the existing local non-VM functionality under one installable VSIX, with the cooperative-tool limits retained. Full is a separate dependency scaffold only. Names such as broker, capability, sandbox or controller are not sufficient to classify code: actual activation, transport and source provenance control the decision.

## Every current extension source domain

Paths are under `packages/vscode-extension/src` unless stated otherwise.

| Source / current feature | Class | Decision and reason |
| --- | --- | --- |
| `advanced` — egress review, Unicode normalization, posture and audit | LITE | Local managed checks/audit; independent traffic is not intercepted |
| `agent` — LM advisory tools, metadata and standalone MCP | LITE | Preserve three advisory tools and the standalone bundled server; safe-read tool comes later |
| `ai-boundary` — saved deny policy, context exclusion and redacted previews | LITE | Core managed privacy feature; retain stronger accepted denies |
| `broker` — manager, auto-start, tool config routing, encrypted config recovery | LITE | Local loopback broker lifecycle and reviewed config changes need no VM/service installation |
| `clipboard` — managed paste/redact | LITE | Explicit managed clipboard routes; no OS clipboard boundary claim |
| `dep-guard` — dependency/configured OSV advisory review | LITE | Existing advisory feature remains optional; agent checks use synthetic/offline data |
| `diagnostics` — live inline scanning | LITE | Visibility/detection only; preserve automatic local feedback |
| `enterprise` — local dashboard, managed settings and opt-in telemetry gate | LITE | Local presentation/policy does not deploy an OS controller |
| `firewall` — context gathering, consent, policy, scanner, vault, canary and ledgers | LITE | Local managed workflows, encrypted recovery and consent; preserve existing behavior before individual upgrades |
| `mcp-firewall` — configuration review/managed gateway commands | LITE | Advisory/scoped local integration, not VM networking |
| `memory-guard` — local metadata/history inspection | LITE | Bounded local review; no cross-process memory privacy claim |
| `permissions` — managed permission metadata | LITE | Existing local policy records and commands |
| `policy-packs` — presets | LITE | Existing local presets; 200+ versioned policy improvement remains separate F02 |
| `project-privacy` top-level safe reads, sensitivity, fixed read terminal and panel | LITE | Existing masked/approved saved-file workflow; not another tool's filesystem boundary |
| `project-privacy/publication` — public snapshots and development contracts | LITE | Explicit reviewed local export, not isolation; default-off workflow retained |
| `project-privacy/SyntheticPreview` | LITE | Fixed loopback sample service, no real DB/secret runtime |
| `project-privacy/capabilities` | FULL reference | Independent-authority protocol, no activated production importer. Keep outside new Lite package/runtime input set; retain history/source/tests |
| `protection` — centralized state, setup, tool inventory, lockdown and revocation | LITE | Central local UX/policy state; no claim arbitrary agents are confined |
| `reports` — local report commands/catalog | LITE | Preserve report workflows with missing/stale status; old verification does not certify new Lite |
| `scanners` — continuous managed detectors | LITE | Preserve dynamic `@soterai/detectors` resolution as well as guard-core |
| `secret-broker` — scoped references, storage, classifiers and local API operation handling | LITE | Activated local API operations, including EnforcedApiCapability, are not the independent Full controller |
| `secret-shield` — document-open monitor, read sentinel, optional vault migration | LITE | Retain monitoring/migration and explicit original-read limits |
| `security` VS Code/I/O adapters | LITE | Host services, confirmations and containment checks remain extension-side |
| `security/pathContainment` pure predicate | SHARED-CORE | Canonical pure implementation belongs in packages/core; historical import becomes compatibility re-export |
| `sentinel` — optional local activity monitor | LITE | Local metadata/detection, default scoped limitations retained |
| `terminal` — post-start shell watcher and detector | LITE | Existing monitoring only; real managed profiles arrive in serial cards |
| `tier2-lite` — unactivated devcontainer template/reference | FULL reference | External runtime/template reference is not automatic install-only Lite; keep source/tests outside shipped runtime |
| `views` — risk/policy/findings trees | LITE | Native editor presentation |
| `webview` — panel/dashboard/styles | LITE | Existing local UI, CSP/action allowlists and themes |
| `workspace-guard` | LITE | Managed collection/protection policy; no universal OS denial claim |
| top-level extension/state/commands/launch/telemetry/runtime-probe modules | LITE | Existing activation and common workflows are retained |
| `__tests__`, host suites, benchmarks, fixtures | DROP from shipping | Preserve and run verification separately; never package tests/fixtures/evidence |

## Other current packages

| Source | Class | Decision |
| --- | --- | --- |
| `apps/local-ai-broker` | LITE | Keep bundled HTTP broker, management auth, fixed controlled operations and three-runtime packaging. Its separate control token is retained |
| `apps/privacy-controller` | FULL reference | Signed independent controller/journal, mTLS DataPlane, VirtualBox inspector and FullModePlan remain outside Lite; do not execute VM/controller setup |
| `packages/guard-core` | SHARED-CORE | Preserve its established ABI/name and non-IDE consumers. Pure redaction/detectors/crypto/policy/process-isolation evaluators are not VM deployment |
| `packages/detectors` | SHARED-CORE | Preserve existing detector dependency; no additional runtime installation required after bundling |
| `packages/mcp-gateway`, `ide-common`, `ide-protocol` | SHARED-CORE / separate integrations | Keep existing contracts/consumers; do not include unrelated runtime code just because it is in the repo |
| `packages/sdk` named `@soterai/core` | SHARED-CORE / separate SDK | Existing SDK must not be overwritten. New packages/core uses distinct name `@soterai/local-core` |
| cached editors, old VSIXes, screenshots, build outputs and evidence | DROP from shipping | Keep existing artifacts/history; only explicit current runtime/docs/icon/license allowlist enters Lite |

## Compatible structure and identity

- `packages/core`: host-free shared exports under `@soterai/local-core`, retaining `@soterai/guard-core` compatibility. No VS Code state, SecretStorage adapter, webview or terminal service enters this package.
- `packages/soterai-lite`: manifest/build/package/entrypoint for the single current Lite extension; three runtime bundles. One canonical feature implementation is reused from the historical source package during migration rather than copied into two editable guard trees.
- `packages/vscode-extension`: compatibility/source/test package, excluded from active npm workspace registration to avoid duplicate package names. Existing tests/source/history remain available. It is not a second installed extension in the isolated test profiles.
- `packages/soterai-full`: dependency-only scaffold with `soterai.full.*`; no runnable VM/controller implementation or installer.

Preserve Lite's current extension identity `soterai.soterai-ide-guard` by default, with display name SoterAI Lite and a new local candidate version. This preserves the existing settings, workspace/global state and SecretStorage namespace; changing the ID can make older vaulted keys inaccessible through the public API. Publisher/IDs are centralized in release-identity.json for owner finalization. An owner-requested identity change needs an explicit migration/recovery design, not a silent rename.

Preserve `soterai.*` settings and command IDs. Full uses its own `soterai.full.*` namespace and depends on the actual Lite ID. Existing installed npm supports negated workspace patterns; the source of its map-workspaces implementation was inspected before using the compatibility-package exclusion.

## P02 acceptance

Build/typecheck the canonical sources and new Lite entrypoint, preserve current non-VM commands/settings/assets, record all esbuild runtime inputs and hashes, and inspect actual VSIX files. Reject provenance from apps/privacy-controller, independent project-privacy/capabilities and tier2/devcontainer reference. Do not reject pure preflight evaluators or local management auth by word matching.

No source/tests/maps/evidence/fixtures/real secrets/local absolute paths may ship. Omit historical packaged verification JSON from the new candidate until matching new evidence exists; missing evidence must show UNVERIFIED rather than old green results. Record byte size, archive/runtime hashes and actual loaded object. Run current synthetic baseline and existing 17-case host harnesses against that object; retain every managed block and unmanaged leak.

Rollback packaging selects the last proven Lite artifact while retaining saved denies; it never installs Full, restores raw workspace secrets or changes OS permissions. No package identity or structural split is promoted to verified tool confinement.
