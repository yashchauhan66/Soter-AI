# Native09 JSON builtin admission diagnostic

Read-only same-lineage inspection; no candidate/helper/source edits, tests, builds, native retry, Git action or approval request. **The four candidate JSON hashes/sizes are already current; the bootstrap application-root literal is stale.** No new vendor pin is needed for those four unchanged files, subject to the existing exact admission remaining valid.

Current reviewed application root:

`C:\Users\USER\AppData\Local\Programs\Microsoft VS Code\2c33b50b16\resources\app`

Its JSON builtin root is that path plus `\extensions\json-language-features`. Actual file size/SHA256 reads matched these existing facts:

| Relative file under JSON builtin root | Bytes | SHA256 |
| --- | ---: | --- |
| `package.json` | 3934 | `9cd153a0d6bd8f8058b5f57c3f11c203228b102ec95e7a025d0e2a5448d662d3` |
| `client\dist\node\jsonClientMain.js` | 653282 | `6471beebe24498a7d7c7d1803b08c475b0cf88115cf9999905a7890d3a9d75ca` |
| `server\package.json` | 1154 | `9f89ec8214ef426f93002d427f1669027f41bece3a2f7f23787df45d58e237c4` |
| `server\dist\node\jsonServerMain.js` | 357534 | `b5425799cbb01710aa2f1ca48fd215d16e9c0d0d6f86447e2faeeaf5582d61e6` |

All four facts appear in `20261029-f26b-prepush-70e1c9a4/host-version-review-code1144-01.json.jsonBuiltinPins` and as absolute paths in `20261101-f28-reliability-9a4c2e71/native-binding-03.json.vendorFacts` (lines205–223). `current-native-admission-05.cjs.binding()` pins every vendor fact, and current F26a admission delegates to that exact binding. The separate11-pin accessibility tooling inventory does not contain these four JSON rows; its absence there does not mean they are unreviewed. No blanket vendor/link/path exception is proposed.

`native09-current-candidate-01.ps1.txt` lines237–257 already contain the four exact current size/hash pairs above. Its line259 instead declares `jsonBuiltinAppRoot` under old version directory **`e646868227`**. The first guard inside `joinPinnedJsonBuiltin()` at line266 requires `same(vscode.env.appRoot, jsonBuiltinAppRoot)`. For the current reviewed2c33 root, `same` cannot equate the two distinct version-directory paths. The later extension-root guard derives `expectedRoot` from the same stale literal. Merely retaining correct hash rows therefore does not admit the current builtin path.

The actual attempt `f26a-precommit-native-20261102T125205Z-7fc4ed5d` retained startup sequence `activation-enter → activation-error → close-start → close-end`; no `actual-require-start` or driver result appears in that startup record. `primary.driver-error.json` reports only stage`activate`/errorName`Error`, without a failed predicate/message. Actual stdout names current2c33 packaged-cache resources, and stderr's mainImpl location is also2c33. These records support the current installed-root mismatch; they do **not** directly record the native `vscode.env.appRoot` getter or prove that this is the sole failed condition in the compound trust/profile/root guard. Other conditions and later stages still require component checks and any separately approved actual retry.

The actual current JSON manifest retains publisher`vscode`, name`json-language-features`, version`10.0.0`, main`./client/dist/node/jsonClientMain`, matching the candidate's identity checks. Existing trust, exact synthetic marker/profile/root, actual extension identity/path/realpath, four file hashes, schema-download-off, activation and ownership/deadline checks should remain; the original34 assertions are not regraded. All native34 coverage remains UNVERIFIED for this failed attempt. Root agent owns closure reconciliation and any future proposal/approval.
