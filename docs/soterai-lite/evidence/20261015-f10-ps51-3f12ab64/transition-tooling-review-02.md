# Transition pre-staging guard correction, authored not executed

The read-only review found that the original commit script compared the prepared
index and allowlist before staging, while explicit allowed-path membership and
source proof checks happened only in the staged verifier. A malformed matching
index/allowlist could therefore stage an unrelated relative file before the
later verifier rejected it. No such staging was observed or executed.

The root authorized this evidence-tooling-only correction before the F10 source
index is frozen. `verify-transition-01.cjs --prepared` now validates the current
working-tree index, every explicit indexed file's bytes, the source-byte PASS and
its exact successful run receipt, source HEAD/empty staging, artifact/runtime,
queue/ledger state and unchanged unrelated queue rows. It reconstructs changed
paths only from the fixed related-path set and rejects index/allowlist paths
outside it. This mode writes no file and performs no staging or commit.

`commit-transition-01.ps1` calls this prepared verifier before `git add`. It
retains `--staged` after add to verify actual indexed Git blobs before commit,
then the separate committed-byte verifier still requires the exact parent,
changed paths, every transition blob/current byte and fresh physical artifact.
Only the final postcommit mode may create the immutable transition-byte PASS.

No production, queue or ledger edits, Git mutation, compiler or script execution
were performed by this author. This is authored control flow awaiting the root's
actual evidence workflow, not an executed PASS. Same-lineage review is LOW.
