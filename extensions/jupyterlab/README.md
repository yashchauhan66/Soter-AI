# SoterAI IDE Guard for JupyterLab (PLANNED / UNBUILT)

A thin JupyterLab 4 adapter for SoterAI IDE Guard. It routes cells, notebooks,
prompts, and (optionally) outputs that you explicitly act on to the authenticated
loopback **Local AI Broker**, and shows the broker's redacted findings in a side
panel. All detection and redaction logic lives in the shared broker — this
extension reimplements no detector.

> **Status: scaffold only.** This directory has **not** been built or installed.
> JupyterLab build tooling (`jlpm`/`jupyter labextension build`) and a Jupyter
> runtime are not available in this repository, so there is no compiled
> `lib/`, no prebuilt `labextension/`, and no runtime evidence. "JupyterLab
> supported" is **not** claimed. See `docs/jupyterlab-test-report.md` for the
> exact gates and the manual build/install/canary procedure.

## Commands (planned)

- **Scan Active Cell** — `POST /v1/scan` on the active cell source.
- **Scan Selected Cells** — scan all selected cells together.
- **Redact Active Cell for AI** — replace the cell source with `POST /v1/redact`.
- **Scan Notebook for Secrets** — scan the whole notebook's source.
- **Safe Prompt Check** — scan a prompt string via `POST /v1/scan {messages}`.
- **Toggle Output-Leak Monitor** — scan new code-cell output text; report only
  redacted findings.
- **Open SoterAI Guard Report** — the redacted report side panel.

## What it deliberately does not do

- It does not classify, score, or redact content itself — the broker does.
- It does not intercept other AI assistants or arbitrary kernel/terminal I/O; it
  only sees what its own commands and the opt-in output monitor pass to it.
- It does not upload raw source, secrets, prompts, or outputs to SoterAI Cloud by
  default. The report panel shows only redacted, display-safe fields.
- It makes no "100% secure" claim.

## Token & topology (important)

A browser is not a safe place to hold a long-lived broker token, and a **remote /
hosted Jupyter server cannot reach a developer's `127.0.0.1` broker**. The
recommended real build (default `useServerProxy: true`) routes broker calls
through a same-host Jupyter **server extension** that reads
`~/.soterai/broker/auth-token` and proxies to the loopback broker, so the token
never enters the browser. A direct loopback mode exists for same-machine desktop
use only. See `server-extension/README.md` and the plan doc.

## Planned build (on a real Jupyter machine)

```bash
jlpm install
jlpm build
jupyter labextension develop . --overwrite   # dev install
jupyter lab
```

## Layout

```
extensions/jupyterlab/
  package.json            JupyterLab 4 extension manifest (deps as plan)
  tsconfig.json
  schema/plugin.json      settings (proxy vs loopback, port, output monitor)
  style/index.css         themed report-panel styles
  src/index.ts            plugin: commands + output-leak monitor + panel wiring
  src/broker.ts           fetch-based broker client (transport-injected)
  src/report.ts           redacted-only report panel
  server-extension/       note on the planned same-host token-proxy extension
  docs/                   plan + honest test report
```
