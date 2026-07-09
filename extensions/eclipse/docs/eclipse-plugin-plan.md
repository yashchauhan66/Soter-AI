# Eclipse plugin plan (Phase 10)

Status date: 2026-07-06. This is a design/plan record for a **scaffold**. Nothing
here has been built or installed. It exists to make the intended architecture and
the acceptance path explicit and honest.

## Goal

Ship a thin Eclipse adapter that reuses the shared SoterAI Local AI Broker for all
security logic. The plugin only routes explicitly selected/opened content and
renders redacted results. It is deliberately a low-priority target (Complexity
High, Priority 4 in the cross-IDE feasibility matrix) because OSGi target-platform
and update-site distribution are heavier than the VS Code family.

## Architecture

```
Eclipse workbench
  commands (plugin.xml)
    -> handlers (AbstractHandler, background Job)
        -> BrokerClient (java.net.http, loopback + bearer)
            -> Local AI Broker  <-- ALL detectors/redaction/policy live here
    -> SoterAIView (redacted report only)
```

- **Thin adapter rule.** No detector, scoring, or redaction code in this bundle.
  `BrokerClient` maps 1:1 onto the broker HTTP contract and nothing else.
- **Threading.** Handlers capture editor state on the UI thread, then run the
  broker call inside an Eclipse `Job`. Document edits (redaction) are re-applied
  with `Display.asyncExec`. This respects Eclipse's UI-thread rules.
- **Token handling.** Real build stores/reads the broker token via
  `org.eclipse.equinox.security` (Eclipse Secure Storage). The scaffold falls
  back to the broker's `~/.soterai/broker/auth-token` file. Token is never logged.
- **JSON.** A tiny in-bundle reader (`Json.java`) parses the flat broker
  responses so the scaffold has no external OSGi dependency (e.g. Gson) to
  resolve in the target platform. Swap for a vetted library if desired later.

## Broker endpoints used

| Command / action | Method + path | Auth |
|---|---|---|
| Broker status | `GET /health`, `GET /v1/safe-mode/status` | health none; status bearer |
| Scan selection / file | `POST /v1/scan {content}` | bearer |
| Redact selection | `POST /v1/redact {content}` | bearer |

`decision` is one of `allow | warn | redact | block | approval_required`. The
adapter treats these as display values; it does not enforce anything the broker
did not already decide.

## Extension points

- `org.eclipse.ui.commands` — four commands under one category.
- `org.eclipse.ui.handlers` — one handler class per command.
- `org.eclipse.ui.menus` — editor popup contribution + a top-level `SoterAI` menu.
- `org.eclipse.ui.views` — the `SoterAI Guard Report` view.
- (Real build) a preference page under `org.eclipse.ui.preferencePages` for the
  broker port and a "Store broker token" action into Secure Storage.

## Target platform / dependencies

`org.eclipse.ui`, `org.eclipse.core.runtime`, `org.eclipse.jface.text`,
`org.eclipse.ui.workbench.texteditor`, `org.eclipse.ui.editors`,
`org.eclipse.equinox.security`. JavaSE-17. Built with Tycho against a pinned
Eclipse release (`pom.xml` currently pins 2024-06).

## Remote / distributed Eclipse

Eclipse over SSH/remote workspaces does not automatically reach a developer's
local loopback broker. That topology requires running the broker beside the
workbench or an authenticated pairing/tunnel. The scaffold assumes a local
broker on `127.0.0.1` and must not claim remote support until proven.

## Known limitations (must stay in the copy)

- No universal terminal or command interception (TM Terminal APIs are optional
  and out of scope for the MVP).
- Only editor documents/selections are in scope; DataGrip-style consoles and
  other specialized editors are not.
- Update-site / p2 distribution is required; there is no single universal JAR.

## Out of scope for the scaffold

- Signing the feature/update site.
- Preference UI wiring beyond the plan.
- Any automated Plugin/Bundle verification (no target platform here).
