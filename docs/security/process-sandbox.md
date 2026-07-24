# Process Sandbox Policy

Date: 2026-07-22

`ProcessSandboxPolicy` is the preflight contract for the companion enforcement layer.

It denies high-risk process launches before execution when they include:

- Shell execution instead of fixed argv.
- Secret-bearing environment variables.
- Working directory escape outside the workspace root.
- Unrestricted network access.
- Unrestricted filesystem access.
- Child process trees without an OS-enforced sandbox.

Returned sandbox profiles are constrained:

- `shell: false`
- explicit environment allowlist
- workspace-scoped filesystem mode
- `none` or allowlisted network mode
- bounded timeout and output buffer
- child process policy of `deny` or `brokered_only`

Coverage is `FULL_ENFORCEMENT` only when the caller supplies an OS-enforced sandbox such as a container, job object, AppContainer, VM, or equivalent platform boundary. Broker-only launches are `STRONG_ENFORCEMENT` for fixed argv and sanitized environment, but they do not prove child-process or packet-level containment.
