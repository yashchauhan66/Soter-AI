# F09 descriptor fixtures 01 - initial author freeze

Date: 2026-10-15. Independence: LOW. Descriptor-only tests were authored after design-01.md was frozen and before parent-owned baseline execution. No production files or existing fixtures were changed. No tests, builds, Node apps, task/debug sessions, filesystem project samples, credential-store calls, real environment files or real values were executed/read.

Frozen fixture: packages/vscode-extension/src/__tests__/vaultAppDescriptor.test.ts
Bytes: 15678
SHA-256: 702dece257e99c8ba2848e796ed3c84c50aebf029d81fa48f6fe0b9a0bdb9abe

Import: ../../../core/src/VaultAppDescriptor (actual host-free module path).
Public API: parseVaultAppDescriptor, VAULT_RUNTIME_LIMITS, vaultEnvironmentNameAllowed.

Declared cases: 30 expanded Node tests across D01-D25. D19 contributes six reserved-name family tests instead of one. Every assertion uses synthetic public descriptors and placeholders in memory. The parser's lexical paths deliberately identify no files that are opened by these tests.

Coverage:
- Exact frozen runtime constants; public own-data descriptor shape; deep-frozen object/arrays/selections.
- Supported JS/CJS/MJS entrypoints, literal Unicode paths and preserved Unicode identity.
- Required/unknown fields, schema/type negatives, non-record/custom-prototype input, non-enumerable/symbol/accessor fields, sparse/extended/accessor arrays, and nonexecuted hostile toJSON.
- UUIDv4, lowercase public program digest, normalized local absolute paths, containment and sibling-prefix/traversal negatives; exact 4096 UTF-16 path limit. This is lexical parsing coverage, not filesystem canonicalization or ownership proof.
- Literal argv controls and shell-punctuation positives; interpolation/control/type negatives; exact argument count, per-argument UTF-8 bytes and aggregate bytes.
- Environment identifier grammar and length; case-insensitive reserved path/runtime/native-loader/shell/language/proxy/SoterAI families with public allowed-name controls.
- Nonempty selections, exact count, case-insensitive duplicate names, duplicate placeholders and strict F06 generated tokens. Only uppercase 32-hex generation plus ordinal 0..255 is accepted; leading-zero ordinals, legacy key-name tokens and altered/prefixed/suffixed values are rejected.
- An exact 32768-byte UTF-8 JSON descriptor and a 32769-byte negative remain inside individual path/argument/name/selection bounds. No reduced or guessed budget is used.

Not claimed: runtime selection storage cap, job concurrency/lifetime/stop mechanics, real vault key/source/policy leases, child environment contents, F08 sinks, Task/Debug behavior or native-host evidence. Those belong to parent/other fixtures. Descriptor constants for those features are checked as frozen exports only.

Execution status at this note: NOT_EXECUTED. The parent owns missing-module baseline capture and later implementation runs. If the module import is absent, all 30 declared cases are NOT_EXECUTED rather than individual feature FAIL results; no shell module was created to manufacture failing assertions. Additional later coverage or fixture corrections require a new immutable note and hash, preserving this initial author basis.