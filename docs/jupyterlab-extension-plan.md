# JupyterLab extension plan

See `extensions/jupyterlab/docs/jupyterlab-extension-plan.md` for the full design record.

Status: PLANNED / UNBUILT. Source scaffold is at `extensions/jupyterlab/`. Nothing has been built, installed, or tested. JupyterLab is Tier 3 (later support) per `docs/cross-ide-support-tiering.md`.

## Quick reference

- Adapter: `extensions/jupyterlab/` (TypeScript, JupyterLab 4.x extension API)
- Commands: Scan Active Cell, Scan Selected Cells, Redact Active Cell, Scan Notebook for Secrets, Safe Prompt Check, Toggle Output-Leak Monitor, Open Report
- Transport: `ServerProxyTransport` (default, same-host server extension) or `LocalLoopbackTransport` (desktop only, opt-in)
- Build: `jlpm install && jlpm run build:prod`
- Distribution: pip-installable Python package (prebuilt labextension + server extension)

## Critical topology note

Remote Jupyter servers cannot reach a developer's local loopback broker without explicit pairing. The server-extension proxy path must be built and tested before any remote-Jupyter support claim. Do not claim remote support until this is resolved.

## Acceptance gate

Extension builds, installs in a local JupyterLab instance, completes a broker-backed cell scan, passes the canary privacy test (raw output never in the report panel), and the pip package is distributable. See `extensions/jupyterlab/docs/jupyterlab-test-report.md` for the test procedure.
