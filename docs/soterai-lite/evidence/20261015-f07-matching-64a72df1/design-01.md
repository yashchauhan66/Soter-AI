# F07 frozen contract 01 — before fixtures and implementation

Only F07 is active. Reuse the existing OutputFilter → EnforcedApiCapability response path and canonical SecretDetector provider rules. No F08 byte-stream pipeline or F16 gateway claim. No automatic project/environment scans or persistent plaintext registry.

## Public host-free API

`packages/core/src/RegisteredSecretMatcher.ts`, exported from core/index:

`new RegisteredSecretMatcher(values: readonly string[])` and `inspectRequest(parts: readonly string[]): MatchDecision`.

Decision: `{status: "CLEAN" | "MATCHED" | "WITHHELD", matches: readonly SecretMatch[], reason?: string}`. Match: `{kind: "registered" | "provider" | "entropy", representation: "raw" | "base64" | "base64url" | "hex" | "url" | "json", registrationId?: string, start: number, end: number, parts: readonly {index: number,start: number,end: number}[]}`. Offsets are original UTF-16, end exclusive. IDs are opaque ordinal `r1`, etc.; duplicates share their first ID. Results/errors never contain values, fragments, or value hashes. Invalid construction is retained as a typed WITHHELD decision, not a thrown value-bearing error or partially usable registry.

Join only the caller's explicit ordered request-local parts, without inserted separators. No cross-call history, permutation or whitespace removal. Validate joined Unicode, allowing a scalar to straddle parts. Exact registered values preserve case, whitespace and Unicode; no normalization. Empty values/lone surrogates are invalid. Values of 1–7 Unicode scalars match only an entire explicit part or the entire joined group/decoded semantic string; arbitrary short substrings are intentionally unsupported. Values of 8+ scalars match substrings. Explicit registrations override placeholder/entropy heuristics.

## Representations and recognition

One encoding layer: UTF-8 standard base64 and base64url, canonical padding or canonical unpadded spelling; even-length hex in either/mixed case; strict UTF-8 URL percent escapes (hex case insensitive, partial escaping supported, plus stays plus); valid JSON quoted strings and JSON string-body escapes, including partial Unicode escapes and surrogate pairs. No recursive transform chain, expression/cipher decoding or Unicode normalization claim. Malformed candidates are never repaired to replacement characters. A malformed unrelated escape does not suppress raw/canonical-form checks. Encoded source spans may conservatively cover their full encoded token/string; they must cover every original contributor and never report decoded offsets as source offsets.

Generated raw/canonical spelling search supplements strict decoded candidate views. URI and JSON decoding only search exact raw registrations and canonical provider/entropy rules in that view; never reapply encoded variants to a decoded view. JSON-leaf grouping in the existing OutputFilter is explicitly request-local, ordered values only, depth/node/part bounded.

Provider recognition reuses SecretDetector 1.5.0, excluding its broad `high_entropy_token` / `opaque_credential` findings in this new engine. Existing OutputFilter's legacy classifier remains a secondary defense. New entropy recognition requires an assignment key ending in secret/token/password/passwd/credential(s)/api_key/api-key/access_key/access-key/auth, optional quoted key/value, `:` or `=`, ASCII value alphabet A–Z a–z 0–9 + / = _ -, length 32–512 inclusive, at least three of upper/lower/digit/symbol classes, Shannon entropy >=4.3 bits/character. No free prose, UUID/checksum or ordinary public URL entropy inference. Provider and entropy findings are distinct from registered findings.

## Fixed budgets

128 unique registrations, 4096 UTF-8 bytes each, 64 KiB registered total; 32 explicit request parts, 128 KiB joined UTF-8 input; 1 MiB derived variant bytes; 128 decoded candidate views and 256 KiB total decoded bytes; 256 returned matches; 64 MiB charged search work (view UTF-16 length per needle/pattern pass). Exceeding any budget returns WITHHELD with no partial matches. Bounded JSON traversal in OutputFilter: depth32/nodes10000, then the same explicit-part/input budgets. Limits are inclusive. Frozen constants exported as `SECRET_MATCH_LIMITS`; entropy constants exported as `SECRET_ENTROPY_POLICY`.

## Existing consumer and withdrawal

OutputFilter constructor keeps existing classifier argument and adds options `{matchingEnabled?: () => boolean}` (default true for host-free callers). The actual singleton guard starts false until command registration binds machine setting `soterai.lite.secretMatching` (default true). Flag false/throw, invalid registry, work budget or parser budget withholds with constant safe text and `allowed:false`; never releases the original response. MATCHED yields the existing whole-response `[REDACTED_SECRET_OUTPUT]` / `secret_like_output_redacted`; CLEAN continues existing unsafe-request/classifier handling. Existing EnforcedApiCapability must honor `filtered.allowed`: no response body on withhold, audit records `sent` because the approved transport already ran, with a constant safe reason. F01–F06 deny/mask behavior remains active.

## Acceptance

Tests authored only after this document: paired positives/negatives per form, strict malformed encodings, exact Unicode/case, short values, all representative split positions and separate calls, overlaps/duplicates/safe coordinates, fixed thresholds, every budget, deterministic property/fuzz cases, actual OutputFilter/capability flag/budget/no-body behavior. Run failing baseline before production. Then focused/full/typecheck, matching artifact inspection, actual native packaged path plus affected hosts, scoped commit and byte verification before F08. Scripted native/API observations remain LOW independence. Frozen catalog44/actual external tools/human/platform gates and rating stay pending.
