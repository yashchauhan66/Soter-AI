# Finite isolated Node session

The new CLI supports `isolate plan` and `isolate run`. The owner selects explicit
relative files and a reviewed Node-compatible immutable image reference. The
plan captures only clean, bounded shared-scanner bytes; recognized secrets in
filenames also prevent admission. The approved digest binds privately retained
bytes. Re-running the CLI after a source edit computes a different proposal and
refuses the previous approval.

```powershell
node packages/soterai-cli/dist/cli.js isolate plan --root <sanitized-project> --image <name@sha256:reviewed-digest> --file app.js
node packages/soterai-cli/dist/cli.js isolate run --root <sanitized-project> --image <same-image> --file app.js --approve-proposal <approvalSha256-from-plan> --entry app.js
```

The fixed Program Files Docker CLI addresses only the local Docker Desktop Linux
pipe, with a minimal environment and no inherited Docker/credential/proxy
settings. Images must already exist locally; no pull occurs. Image volumes are
refused. Creation fixes UID/GID 10001, no network, read-only root, only bounded
tmpfs, all capabilities dropped, no-new-privileges and resource limits. The
image's entrypoint is replaced by a fixed Node keepalive. The approved snapshot
is transferred as a bounded JSON/base64 envelope to a fixed non-root loader over
stdin, with no archive extraction or host mount.

Owner approval binds the immutable image reference, scan policy digest and
snapshot digest through the plan's `approvalSha256`. Changing the image requires
fresh approval even when the selected files have identical bytes. The
`snapshotSha256` remains the file-payload integrity check. Rerun `isolate plan`
for earlier approvals: snapshot-only digests are refused. The legacy
`--approve-snapshot` option remains an alias but also requires `approvalSha256`.

Effective image/container/settings are inspected before transfer and execution.
The positive canary verifies public bytes, UID and writable scratch space. The
negative canaries verify zero capabilities, no-new-privileges, seccomp filtering,
failed root escalation, forbidden root writes, metadata-only absence of host
credential/socket locations, and failed outbound connection. The selected Node
entry executes only in that container for at most 30 seconds, with bounded
output checked by the shared secret scanner. Only the exact created container ID
is removed; no project files or historical evidence are deleted. A cleanup
failure remains unavailable.

The Docker daemon, host administrator and reviewed base image are trusted. This
is a guest execution boundary, not an assertion that a host coding agent cannot
read the original workspace. It supports a finite Node application, not a full
interactive agent/network/package-install environment. Unknown private data in
an unreviewed image is not made safe by a digest alone.

Current native proof is **pending**: the sandbox denied the local pipe; the
approved read-only outside-sandbox check did not return and was interrupted.
Synthetic orchestration tests do not prove effective isolation. No container or
daemon installation/start action is claimed.
