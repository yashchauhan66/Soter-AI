# JupyterLab extension plan (Phase 11)

Status date: 2026-07-06. Design/plan record for a **scaffold**. Nothing here has
been built, installed, or exercised. JupyterLab is Complexity High / Priority 5
in the cross-IDE feasibility matrix, primarily because of the token/topology
problem and the size/sensitivity of notebook outputs.

## Goal

A thin JupyterLab 4 adapter that reuses the shared Local AI Broker for all
security logic and shows only redacted results. It routes explicitly acted-on
content (cells, notebooks, prompts, opt-in outputs); it does not intercept the
kernel, other assistants, or arbitrary I/O.

## Architecture

```
JupyterLab (browser)
  plugin (src/index.ts): commands + output-monitor + report panel
    -> BrokerClient (src/broker.ts, fetch, transport-injected)
        -> [recommended] same-host server extension  --(token)-->  loopback broker
        -> [desktop only] direct http://127.0.0.1:47321
                                             ^ ALL detectors/redaction/policy here
    -> ReportPanel (src/report.ts): redacted fields only
```

- **Thin adapter rule.** No detector/redaction/policy code in the extension.
  `BrokerClient` maps 1:1 onto the broker contract.
- **Transport injection.** `BrokerClient` takes a `BrokerTransport`. Two
  implementations: `ServerProxyTransport` (default) and `LocalLoopbackTransport`
  (opt-in). This is what makes the remote-vs-local topology explicit rather than
  assumed.

## Token & topology decision

Browser storage is unsuitable for the broker token, and remote Jupyter's
`localhost` is not the user's laptop. Therefore the **default** is a same-host
Jupyter server extension that holds the token and proxies to the loopback broker
(`server-extension/README.md`). Direct loopback is offered only for same-machine
desktop use, behind the `useServerProxy: false` setting. The adapter must not
claim remote support until the proxy path is built and tested.

## Commands and broker mapping

| Command | Source | Broker call |
|---|---|---|
| Scan Active Cell | active cell `sharedModel.getSource()` | `POST /v1/scan {content}` |
| Scan Selected Cells | selected cells joined | `POST /v1/scan {content}` |
| Redact Active Cell | active cell source | `POST /v1/redact {content}` -> `setSource` |
| Scan Notebook for Secrets | all cell sources joined | `POST /v1/scan {content}` |
| Safe Prompt Check | prompt string from dialog | `POST /v1/scan {messages}` |
| Toggle Output-Leak Monitor | new code-cell output text | `POST /v1/scan {content}` |
| Open Report | — | shows the panel |

`decision` is `allow | warn | redact | block | approval_required`. The adapter
displays it and surfaces a notification; it enforces nothing the broker did not
already decide.

## Output-leak monitor

Opt-in (off by default). When enabled, it connects to each code cell's
`outputs.changed` and sends extracted output **text** to `/v1/scan`. Only the
broker's redacted result is placed in the report panel. This is the privacy-
critical path: notebook outputs can be huge and contain secrets/PII, so raw
output must never appear in the panel, a log, or any cloud call.

## API-verification caveats (must resolve at build time)

The following @jupyterlab 4.2 APIs are used per docs but are **UNVERIFIED**
against an installed build and must be confirmed:

- `cell.model.sharedModel.getSource()` / `setSource()`.
- `Notebook.isSelectedOrActive(cell)` for selected-cell enumeration.
- `CodeCell.model.outputs` (`IOutputAreaModel`) `.changed`, `.get(i).toJSON()`.
- `MainAreaWidget` placement in the right area and settings-registry schema IDs.

## Packaging

Prefer a single pip-installable distribution bundling the prebuilt labextension
and the server extension, so `pip install` enables both. An npm source package is
optional. Publish only after the acceptance gates below pass.

## Known limitations (keep in the copy)

- No kernel/terminal interception; only explicit commands + opt-in output monitor.
- Remote/hosted Jupyter requires the server-extension proxy topology.
- Large outputs may need truncation/streaming limits before scanning.
