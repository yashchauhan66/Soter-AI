# Cline integration assessment

Reviewed: 2026-10-11. Target: VS Code on Windows 11, Cline. This is a static integration assessment; Cline was not launched or reconfigured.

## Evidence and decision

FACT (local manifest inspected read-only, 2026-10-11): `C:/Users/USER/.vscode/extensions/saoudrizwan.claude-dev-4.1.23/package.json` declares `saoudrizwan.claude-dev` 4.1.23 and editor eligibility `^1.101.0`. Its declared commands cover Cline UI/context actions; they do not declare a SoterAI reader or permission interception API. Installed metadata does not prove which bundle an active editor has loaded.

| Installed artifact | SHA-256 |
|---|---|
| Cline package.json | cadf5ce57489295d4b8bc947fe3d7ee5f017aa4ca31f1f7f76e2946169e3c8e8 |
| Cline dist/extension.js | 9251e17d93bb57da24f3e801e1f3e50e58e362286d2eace35b5aec3ab40cad3e |

FACT (current vendor documentation checked 2026-10-11): Cline describes `.clineignore` as automatic-context filtering, with explicit mentions and shell access outside that restriction, and announces deprecation. Its sample hook documents shell-parsing and symlink limits and CLI YOLO disabling hooks. These are documentation statements, not results for the installed version. [Cline .clineignore documentation](https://docs.cline.bot/customization/clineignore).

FACT (vendor repository checked 2026-10-11): the legacy extension hook README lists Windows as unsupported. It says injected context affects later model decisions and cannot change the current tool parameters. A cancellation mechanism therefore does not establish transparent masked substitution. [Cline hook README](https://github.com/cline/cline/blob/main/.clinerules/hooks/README.md).

FACT (vendor documentation checked 2026-10-11): Cline's Auto Approve settings include reads, commands and MCP. Its safe-command classification uses a model-supplied flag; YOLO approves all categories. These controls belong to Cline. [Cline approvals](https://docs.cline.bot/features/auto-approve).

FACT (vendor documentation checked 2026-10-11): Cline supports additional tools through local or remote MCP servers. [Cline MCP](https://docs.cline.bot/mcp/mcp-overview).

INFERENCE / DECISION: keep the new reader as an explicit SoterAI workflow. Do not label Cline's own reads, terminal commands, uploads or approvals as intercepted. No hook, ignore file, MCP registration, provider rewrite or Cline setting was installed. The existing advisory MCP tools do not supply the new approved file-read operation.

## Integration choices

| Candidate | Contribution | Remaining limit | Decision |
|---|---|---|---|
| Ignore-file synchronisation | INFERENCE: may reduce accidental automatic context on compatible releases | Native processes and other read routes retain original access; deprecation/version differences need verification | Auxiliary control only; not implemented |
| Legacy file hook | INFERENCE: cooperative cancellation on supported runtimes | Windows support and exact tool coverage unresolved; parameter replacement is unavailable in the cited contract | Not selected for this Windows build |
| Approved-read MCP adapter | INFERENCE: provides an explicit names-only or redacted tool response through the reader | Adding a safe tool does not remove Cline's other tools or filesystem authority; UI bridge needs independent tests | Future bounded integration, not registered |
| Isolated Cline workspace plus approved-read broker | INFERENCE: originals can be withheld from the agent runtime while selected safe content crosses a controlled channel | Mounts, history, inherited credentials, host bridges, network authority and trusted editing must be verified | Required direction for the complete contract; deployment DEFERRED |

## Acceptance and evidence gates for a later adapter

INFERENCE / EXPECTED RESULTS:

- Pin the supported Cline release, operating environment and artifact hashes; establish the actually loaded artifacts without changing a live session.
- A Cline tool request for an environment file produces no content before approval; cancellation returns no text; approval returns names and `[MASKED]` only.
- An ordinary denied file returns one redacted saved-file view after approval and remains denied to default managed collection.
- A changed file, policy, project, disabled reader or expired review returns no text.
- An agent's direct filesystem, child-process and Git-history reads in the selected compartment receive access denied or find no protected original. This is separate evidence from a safe MCP tool test.
- The agent compartment has no original project history, secret mounts, host credential environment, shared clipboard or authority to change host policy. Model/tool traffic uses the selected mandatory route.

UNTESTED: all live Cline adapter assertions, Windows hook behaviour for 4.1.23, Cline context persistence, actual native terminal mediation, OS isolation and mandatory egress. Full G1-G6 claim remains BLOCKED.

INCOMPLETE (version-pinned source retrieval): the web tool returned `Failed to fetch https://raw.githubusercontent.com/cline/cline/v4.1.23/src/core/ignore/ClineIgnoreController.ts: Cache miss` and the same `Cache miss` for `src/core/hooks/index.ts`. This is a retrieval gap, not a safety-filter refusal. Current documentation has not been substituted for a version-specific runtime result.
