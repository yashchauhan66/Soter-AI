# F06 initial implementation review 02

Same-lineage adversarial review, independence **LOW**. Read-only production inspection; no tests or native host were executed by this reviewer. Only this new evidence file was written. No real secrets or normal editor profile were read.

Observed SHA-256 identities during follow-up inspection:

- VaultManager.ts: `addd8f1d648c03735f8b05dbbc2e80b37296b59323ad798d635a3c02f530d020`
- VaultStorage.ts: `a451e2d2cb154a55eb2462398928fed1b933944e8e0452c1accc7228c73ec2bc`
- VaultMigrationPlan.ts: `dbe3b45646d3751c927680ca31001897faa3885aca23c9ef84695f114ed94505`
- vault-commands.ts: `1349234d89c7c79d80071674289a9d082cdc7b220eb521e254bec4b9755e85c4`

Root was implementing corrections concurrently. These identities describe observed intermediate source, not the final artifact, and no execution result is assigned to them.

## Concrete findings and observed corrections

1. Initial VaultStorage.read called verifyExistingPath for an absent target; that helper wraps missing-file errors without an ENOENT code, preventing first migration in an existing empty storage directory. Root added an initial target lstat. The observed follow-up still catches ENOENT around the entire operation: an already observed target disappearing during the subsequent bounded read can be reinterpreted as absent. Only the initial existence check should map absence to undefined; failures after observing an existing ciphertext must remain unavailable. This preserves the existing-store contract without claiming an OS race veto.

2. Initial public status removed hash but retained buildVaultMetadata's id, which includes a raw-value hash prefix. Root removed both id and hash from public status metadata. The status HTML already excludes these fields. Matching metadata regression execution remains required.

3. Initial in-place source-write faults could leave bytes matching neither the original nor masked checkpoint. Safe completion correctly withholds that unknown state, but raw backup restoration originally rejected every pending checkpoint, making retained recovery unreachable through normal owner commands. Root added a separately disclosed, authenticated pending-checkpoint restoration route. Its private one-to-one latin1 representation binds exact damaged bytes, including malformed UTF-8, without loosening ordinary capture validation. Existing source TextDocuments are refused for that damaged-byte disclosure. Pending pointer and vault pre/post image checks remain. Test prefix-write-then-throw, invalid UTF-8, decline, cross-source pointer and source changes during disclosure; no automatic plaintext rollback is permitted.

4. Initial standalone writeEnvExample did not acquire the cross-window lock or verify the key. Root moved pending/key/source checks and exclusive example creation inside storage.lock. This closes that alternate mutation route; matched execution remains required.

5. At the observed VaultManager identity, writeSource rereads the resulting text and canonical path after API I/O, but does not independently revalidate root/policy and existing editor state afterward. Migration completion subsequently captures again; standalone restore and restoreFromBackup do not. A source-write hook that changes team policy can therefore produce a successful raw-restoration acknowledgement against an obsolete reviewed policy. Add post-I/O root/policy validation before success, preserving encrypted recovery and reporting unavailable if a drift happened after bytes were already written. Do not silently roll back to plaintext or claim the mutation never occurred.

## Preserved narrow controls

The plan now keeps exact private replacementText separately from logical decoded values; examples derive only unique supported field names and empty assignments. Generated placeholders are generation-qualified. Pending global generation blocks later whole-vault mutation replay; restoration filters absolute source and root rather than legacy relative names. Canonical bounded regular-file reads, verified key readback, authenticated checkpoints, native manager-owned reviews and conservative live/uncertain lock withholding are present in the inspected implementation. Their matching fault tests, restart/native API checks and final artifact acceptance remain necessary.

No F03 or F05 guard was modified by this reviewer. No broader containment, OS custody or universal same-user protection claim is made.
