# SoterAI Lite

Local managed secret protection for cooperative AI tools. Lite offers reviewed masked reads, local policy and scanners, optional vault workflows, checked terminals and a bundled provider gateway. Install one Windows VSIX; no administrator access, VM, controller service or SoterAI account is required for local operation.

**Release verification is in progress.** This candidate is not release-ready or independently reviewed. Exact-object installed lifecycle, integrated checks and required human evidence are publication requirements. No coverage score is issued here.

## What Lite protects

- Saved protected paths and regions use deny-by-default policy. Ordinary approved reads return a reviewed safe representation. Sensitive dotenv reads expose key names with values masked; unsupported sensitive formats are withheld.
- The optional private env editor uses its own document model and masks values by default. Native per-value reveal, reviewed save and encrypted recovery are owner actions. Opening originals as ordinary text remains a separate exposure path.
- Optional vault migration replaces reviewed workspace values with placeholders and retains encrypted recovery. Selected app/task/debug runs receive approved values through a scrubbed child environment. Application code receiving a value can still disclose it.
- Checked PowerShell5.1, cmd and Git Bash profiles handle their declared bounded command grammars with a fresh environment and filtered output. Unsupported shell forms refuse. These profiles do not intercept every arbitrary interactive/native command.
- The managed gateway inspects supported bounded request bodies and supported encodings before forwarding, including request-local split-value recognition. Provider routing requires explicit configuration. Independent clients, unmanaged uploads and unsupported protocols are outside it.
- Owner-reviewed adapters use pinned vendor controls and managed safe-read routes. The Coverage view distinguishes Gateway-routed, Vendor-controls-only and Uncovered routes after actual local verification.
- Local source, history, config, Docker/Kubernetes, build-artifact and log reviews report possible exposures without executing project configuration or rewriting Git history. Findings are heuristic; unsupported input is withheld or reported unverified.
- Reviewed pre-push and PSReadLine exclusion workflows are optional. **Pre-commit (F26a) is an opt-in candidate pending native verification.** The owner can enable its machine setting and review install/resume; the setting remains off by default. Existing owned-hook status and reviewed restore remain accessible. Availability does not establish completed protection or release acceptance.
- The Protection Center shows protected items, activity and scoped setup verification. Feature withdrawal preserves saved protection and recovery. A passing local self-check is limited to its tested surface.

## Tool and platform scope

| Tool or environment | Available route and limitation |
| --- | --- |
| Cline, Claude Code | Reviewed pinned vendor controls and applicable managed safe reads/provider routing; original filesystem reads and independent processes remain outside Lite. |
| Codex IDE, Codex CLI, Gemini CLI | Reviewed dedicated or vendor configurations for pinned versions and tested managed routes. A different version stays unverified until reviewed. |
| PowerShell5.1, cmd, Git Bash | Optional checked-command profiles with documented grammar. Other shells, interpreters, expansions and unmanaged terminal actions are not implicitly covered. |
| PowerShell7 | Not available/tested on the verification machine; not advertised as supported. No download is required by Lite. |
| Windows local filesystem workspace | Target win32-x64. Installation, startup, upgrade and removal evidence applies only to its recorded VSIX; consult release evidence for current status. |
| Linux, macOS, remote, virtual workspaces | NOT_TESTED / not supported by this release. |

These are implemented route descriptions, not a final per-tool coverage result. Supported versions and exact-object evidence belong to the local Coverage view and release evidence. Real-provider logins, authenticated agent smoke, human usability and screen-reader review require the owner's separate actions.

## What remains exposed

Lite is not an OS boundary against hostile or manipulated same-user processes. Arbitrary native reads, original buffers in other extensions, hardlink/junction routes outside checked readers, inherited data in unmanaged shells, Git-history access outside checked routes, unknown transformations and independent uploads can bypass these controls. The retained unmanaged17-case baseline includes9 confirmed leaks. Filtering output cannot undo a value already transmitted or a credential exposed earlier. SecretStorage does not isolate same-user code.

## Setup and privacy

Open the getting-started walkthrough and Protection Center. Review protected items and run **Verify my setup**. Local scanning can start automatically; optional adapter/configuration, terminal and vault changes require owner review. Configured provider traffic is separate from the default-off cloud/telemetry preferences. See [PRIVACY.md](PRIVACY.md) for local filenames/activity, storage, retention and provider/advisory routes.

Before removing Lite, run **SoterAI: Restore changes before removal** in the trusted local project. Its native summary inventories known recovery metadata; each supported profile, editor association, dedicated adapter or hook still requires its own review. Cancellation, changed/foreign records and unconfirmed worker shutdown leave recovery pending. The command retains policy, vault values and encrypted backups. Checked terminal/editor settings can be restored after their feature flags are off; recovery never enables those flags.

Cline, Claude and earlier plaintext-capable configuration backups require separate manual recovery review; this command does not decrypt or restore them. Missing journals cannot discover unrecorded earlier edits. Keep Lite installed while a required restore is pending. VS Code uninstall/disable does not guarantee cleanup code runs, erase old copies or restore raw secrets. Lifecycle measurements and limits apply to each exact tested artifact and do not replace authenticated tool smoke or human review.

The complete owner-selected [Business Source License1.1](LICENSE.md) applies to Lite. The package includes full [third-party notices](THIRD-PARTY-NOTICES.md) and `SBOM.cdx.json`. Embedded metadata describes bundled runtime/source components; a detached inventory binds the final VSIX hash. This is an offline inventory, not legal approval or a current vulnerability advisory audit.

Publishing remains an owner action after the required release and human gates. No Marketplace/Open VSX publication, login or token handling is performed by package creation.
