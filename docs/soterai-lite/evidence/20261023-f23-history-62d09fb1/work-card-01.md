# F23 — bounded read-only Git history scanner

This executes the existing F23 card in IMPLEMENTATION-PLAN.md; it does not replace or reorder the plan. F22h and parent F22 are scoped DONE only after actual source and transition byte proofs. Start parent: `a06d436df82c507faa8c642a8b2ec23f6b27119e`, local branch `soterai-lite-f22h-resume-20261023`.

User requirement: original U7 read-only history scanning with rotation/removal guidance, never automatic history rewriting. Frozen mappings: LS-25 and LS-26. Existing terminal refusal of generic `git show`, `log -p` and arbitrary Git grammar stays unchanged; this scanner does not promote those routes or make historical objects inaccessible.

Flag: proposed strict machine/restricted `soterai.lite.historyScanner`, default true, owner review required. Trusted single local Windows workspace only; no startup history read, Git child or analyzer key creation. Public command arguments supply no path, ref, approval or authority. Native cancellation, disable, trust/root/policy/key drift and disposal withdraw pending work. No current-file vault/edit/restore operation is attached to historical findings.

Implementation uses the existing CheckedGitMetadata descriptor, canonical root/policy guards, safe Git environment and hygiene analyzer/exposure ledger. New modules under `packages/vscode-extension/src/history/`: `GitHistoryProtocol.ts`, `HistoryGitProcess.ts`, `HistoryScanner.ts`, `HistoryController.ts`, `HistoryFlags.ts`, `commands.ts`. Registration changes `extension.ts`; both extension manifests and READMEs plus Lite changelog document exact scope. Existing reader/terminal authorization is not relaxed.

The fixed private Git command set is version, reachable commit IDs (`rev-list --max-count=33 --all`), NUL-framed recursive trees (`ls-tree -r -z --full-tree --long <validated object ID> --`) and raw `cat-file --batch` with validated object IDs on stdin. No caller refs, path arguments, shell, hooks, filters, textconv, pager, network, lazy fetch, replacements or credential helper. Reuse the pinned supported installed Git runtime and descriptor's sticky metadata checks; unsupported repository structure remains unavailable.

Limits: 32 reachable commits plus a sentinel, 128 unique regular blobs, 64 KiB per blob, 1 MiB admitted blob content, 256 KiB per tree response, 4 KiB commit list, 8 KiB stderr, 60 seconds total. Also bound aggregate metadata/process output and entry counts in the scanner. Explicit PARTIAL/withheld outcomes describe caps, binaries and unsupported entries; a bounded prefix never becomes a clean whole-history result. Linked/worktree/shallow/alternate/replacement repository restrictions come from the existing descriptor. Unreachable objects, reflogs, messages/authors and unsupported repositories remain outside the scan.

Every child uses fixed argument arrays, shell false, a fresh minimal isolated environment and hidden windows. No timeout/AbortSignal that sends a signal, process killing, signal zero or pipe destruction to force closure. Timeout/withdrawal stops scheduling and suppresses results while retaining busy/unconfirmed ownership until real close and both EOFs. Buffer caps apply before retention; raw stdout/stderr/errors, original values, paths, messages, authors or branch names are not UI/log/result fields.

History findings reuse keyed canonical hygiene metadata with a fixed historical source domain and manual rotation/removal guidance. Heuristics and opaque references do not establish credential validity, actual AI access, complete detection, removal, rewrite, remote-copy revocation or a same-user OS boundary. Any location usability limitations stay explicit.

Meaningful verification:

- Test first: protocol, finite process lifecycle and scanner/controller/native-command controls; retain missing-implementation failures before production edits. Parallel protocol test authoring/read-only review is LOW independence.
- Actual synthetic Git repositories: public-only and unborn controls; secret committed, renamed, then deleted; merge-parent history and repeated-blob deduplication; malformed frames, object identity/size, binary/Unicode/path controls; all bounds including sentinels and aggregate output; no canary in results, UI, ledger, export or errors.
- Cancellation before key/process, disable/drift at await boundaries, timeout/overflow/spawn error/nonzero close/incomplete EOF, sticky withdrawal and re-enable without stale authority; no writes/rewrite/hooks/network and no process signals.
- Focused new and affected canonical Git/hygiene tests, current typecheck/full suite, unique newly built VSIX with actual content/hash inspection. Current exact-artifact native history controls, affected hygiene, retained broker/MCP and existing functional/security comparison; affected native Git execution must use isolated synthetic repositories.
- Safe withdrawal, all owned phase exit/EOF evidence, ledger receipt, explicit scoped local source and transition commits and exhaustive actual-byte proofs before F24. Original L6 still requires HUMAN-ACTIONS and STOP; no interim rating.

No real workspace history scan is authorized for agent verification. All verification data and profiles are synthetic and retained. No download/login/normal profile/process termination/OS change/push/publish/tag. The waived 20 GB threshold is not reintroduced.
