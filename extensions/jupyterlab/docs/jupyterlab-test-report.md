# JupyterLab adapter test report (HONEST)

Run date: 2026-07-06
Host OS: Windows 11, x64
Artifact: none produced

## Verdict

**UNBUILT / PLANNED.** JupyterLab build tooling (`jlpm` / `jupyter labextension
build`) and a Jupyter runtime are not available in this repository. Nothing here
was compiled, packaged, installed, or exercised. This is a scaffold. Do not
describe JupyterLab as supported or publish-ready.

## Results

| Check | Target | Result | Notes |
|---|---|---|---|
| `jlpm install` | Dependencies | NOT RUN | No JupyterLab toolchain here |
| `tsc` build of `src/` | Frontend | NOT RUN | Requires installed `@jupyterlab/*` type packages |
| `jupyter labextension build` | Prebuilt extension | NOT RUN | Requires `@jupyterlab/builder` + jupyterlab |
| API signature verification | @jupyterlab 4.2 | NOT RUN | sharedModel/output-area/selected-cell APIs are UNVERIFIED (see plan) |
| Dev install + JupyterLab launch | `jupyter lab` | NOT RUN | No Jupyter runtime available |
| Command registration + palette | Running Lab | NOT RUN | Requires an install |
| Broker-backed scan/redact | Running Lab + broker | NOT RUN | Requires install + running broker |
| Server-extension token proxy | Same-host proxy | NOT RUN | Server extension not implemented (note only) |
| Output-leak monitor | Running Lab + broker | NOT RUN | Requires install + broker |
| Canary privacy test | Running Lab + broker | NOT RUN | Blocking; see acceptance below |

## Manual build + install procedure (to run on a real Jupyter machine)

1. Create a fresh env with JupyterLab 4.2+ (`pip install jupyterlab`).
2. From `extensions/jupyterlab`: `jlpm install` then `jlpm build`.
3. Resolve any API mismatches flagged in the plan against the installed
   `@jupyterlab/*` versions before proceeding.
4. Dev install: `jupyter labextension develop . --overwrite`.
5. (Recommended path) implement/enable the same-host server extension from
   `server-extension/README.md` so the broker token stays server-side; keep
   `useServerProxy: true`. For same-machine desktop testing only, you may set
   `useServerProxy: false` and supply the loopback token.
6. Start the SoterAI Local AI Broker locally; confirm `GET /health` returns 200.
7. `jupyter lab`, open a notebook, and exercise each command.

## Canary notebook test (expected results)

Create `canary.ipynb` seeded with fake-but-realistic secrets and PII, e.g.:

- a cell containing `AWS_SECRET = "AKIA...FAKE"` and `email = "jane.doe@example.com"`;
- a cell whose **output** prints a fake token (e.g. `print("sk-live-FAKE123...")`).

Expected:

- **Scan Active Cell / Notebook for Secrets** returns a non-`allow` `decision`
  with categories naming the secret/PII types; the report shows only the redacted
  `evidencePreview` and `contentHash` — never the raw canary values.
- **Redact Active Cell** replaces the secret with the broker's masked form; the
  cell no longer contains the raw canary value.
- **Safe Prompt Check** on a prompt containing the canary returns a non-`allow`
  decision.
- **Output-Leak Monitor** (enabled) flags the printed fake token from cell output
  and reports only the redacted result.
- With the broker stopped, every command fails with a clear "broker not
  reachable" message and does not crash JupyterLab.

## Acceptance criteria to record a PASS

- **Build PASS**: `jlpm build` and `jupyter labextension build` succeed; a
  prebuilt `labextension/` is produced.
- **Install PASS**: the extension appears in `jupyter labextension list` as
  enabled OK and all seven commands appear in the palette.
- **Scan/Redact PASS**: canary cell/notebook/prompt produce correct broker
  decisions and redaction as above.
- **Server-proxy PASS**: with `useServerProxy: true`, a remote-server smoke test
  shows the browser makes no direct `127.0.0.1` broker call and the token never
  appears in browser payloads or logs.
- **No-raw-output-leak PASS (blocking):** across every command and the output
  monitor, the report panel, browser console, Jupyter server log, and any cloud
  call contain **no** raw cell source, raw output, secret value, or bearer token
  — only redacted `evidencePreview`/`contentHash`. Verify with a loopback-only
  network capture. Until this row is PASS with a capture attached, no
  "local-first / no raw upload" guarantee may be stated for JupyterLab beyond
  "by design, unverified".
