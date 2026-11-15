# Portable vault recovery envelope

`src/RecoveryEnvelope.ts` provides a filesystem-free envelope for a 32-byte vault key and an opaque archive of encrypted vault records. It never writes a plaintext key or archive, logs material, accesses SecretStorage or installs a vault. The host must supply only the intended encrypted records, validate their schema and decrypt/authenticate the restored vault before installation.

The interface is:

```ts
createRecoveryEnvelope({ vaultKey, archive }, passphrase): Promise<Uint8Array>
inspectRecoveryEnvelope(envelope): { version: 1, envelopeSha256, byteLength }
openRecoveryEnvelope(envelope, passphrase, expectedEnvelopeSha256):
  Promise<{ vaultKey, archive, archiveSha256 }>
```

Inspection checks the format and hashes its exact bytes. It does not authenticate the file. The owner review must retain that digest separately; opening rejects any change from the reviewed bytes. Creation and opening copy input bytes before asynchronous work, so later mutations of caller buffers cannot replace the reviewed payload. Shared-memory inputs are refused. Returned material belongs to trusted host code and must never become command output or UI data. Its wrapper is frozen; its arrays remain mutable so the host can clear them after use.

Every export uses a fresh cryptographic 16-byte salt and 12-byte nonce. The only accepted KDF is scrypt with N=32768, r=8 and p=1, a 32-byte derived key and a 64 MiB memory ceiling. At most two derivations can run concurrently in this module instance; excess calls are refused without queueing. AES-256-GCM authenticates the ciphertext and canonical header, using a 16-byte tag. The encrypted binary payload contains a format marker, the archive length, the vault key, a SHA-256 digest of the exact archive and the archive bytes. The digest is an integrity binding, not a substitute for authenticated encryption.

The archive is limited to 8 MiB and the UTF-8 JSON envelope to 12 MiB. Version, purpose, algorithms, KDF parameters, field names, canonical Base64 and canonical JSON spelling/order are fixed. Unknown or duplicate fields, alternate serialization, malformed UTF-8, truncated material and oversized input are refused. Wrong passwords and authentication failures produce the same generic error without attacker-controlled exception text.

Use a password-manager-generated recovery password with at least 128 bits of randomness, kept separately from the export. The enforced minimum of 16 Unicode characters and maximum of 1024 UTF-8 bytes bound inputs; they do not prove entropy. A human phrase or a repeated character string can meet those limits and still be weak. Someone who obtains the export can guess passwords offline; scrypt only raises the cost of guesses. Passphrases are used exactly as entered, without Unicode normalization. Losing the recovery password and the original vault key makes this export unrecoverable. There is no reset or backdoor.

Possession of both the export and its password gives access to the enclosed vault key and all included records. The envelope does not protect against a compromised host, malicious same-user process, keylogger, memory inspection, or a host that installs the wrong archive. Temporary password, key and plaintext buffers are cleared on a best-effort basis. JavaScript strings, runtime copies and crypto internals prevent a guaranteed memory-erasure claim.

The host owns restore semantics: acquire its exclusive mutation lock, require an empty destination including SecretStorage keys, live vault, generations, pointers and pending/recovery records, validate the authenticated archive, and install the key plus ciphertext with crash-consistent recovery. Recheck emptiness under that lock immediately before writing. Never overwrite or silently merge an existing store. This pure module neither implements nor attests those transactional guarantees.

Tests use invented key material and archives. They establish the local format/crypto contracts, not a native key-loss recovery drill or independent cryptographic review.
