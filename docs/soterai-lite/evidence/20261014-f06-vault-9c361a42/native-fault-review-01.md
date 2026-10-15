# F06 native source-write fault review 01

Date: 2026-10-15. Same-lineage read-only source/metadata review; independence LOW. This note is not an executed native PASS and does not certify OS key custody.

The original facade replacement is unavailable in actual Code 1.141.2. Preserved native attempt 03 proof:

- Path: `D:\SoterAI-Lite-test-profiles\f06-native-host-20261015T030919Z-87e07d0d\save-results.json.driver-error.json`.
- Size: 208 bytes; SHA-256: `18ea69b2158ec55dbd33636f364363b462ca94a3d7540513ffd45164561ae349`.
- Observed fields: status FAIL, stage beforeActivate, errorName TypeError; fixtureDiagnostic phase replace, name writeFile, frozen true, extensible false, own true, configurable false, writable false.
- This is a fixture activation failure before behavioral checks, not evidence that a vault migration, disk permission fault or recovery ran.

The installed executable's ProductVersion was read as `1.141.2`. The reviewed public application source is:

`C:\Users\USER\AppData\Local\Programs\Microsoft VS Code\16507d91be\resources\app\out\vs\workbench\api\node\extensionHostProcess.js`

Source SHA-256: `66b7ab0b229750f6950fa5986b5f8c98b4c0b49cc8a0da772dc391f0ba6b9b63`.

Bounded excerpts were read from this installed file. Offsets below are approximate UTF-16 string indices from .NET String.IndexOf, not file byte offsets; the entire minified lines were not emitted:

- Near 1,155,422: the extension-host filesystem consumer's `async writeFile(o,i)` delegates to an installed writable provider with `{create:!0,overwrite:!0}` or calls its main-thread proxy. The public consumer call supplies no unlock option.
- Near 2,173,842: the local disk provider wrapper explicitly delegates `writeFile(t,e,n){return this.impl.writeFile(t,e,{...n,unlock:!1,atomic:!1})}`. Both unlock and atomic replacement are false.
- Near 2,167,484: the disk provider passes `unlock:o.unlock` to its file-open helper.
- Near 2,168,029: the open helper changes owner-write mode only inside `if(iu(n)&&n.unlock)`. Otherwise the Windows write path tries `open(...,"r+")` and truncation, then a normal `open(...,"w")` fallback after an error. This path does not clear the readonly attribute when unlock is false.
- Near 2,173,101: write-error normalization can map NoPermissions to EntryWriteLocked when the target's owner-write bit is absent.

Inference for the owned synthetic fixture: after creating the regular D: `.env.crash` source, mark that exact file readonly before requesting migration, then restore its original writable mode in finally. Source capture can still read it; the actual native disk write should be denied after encrypted checkpoint/vault creation. This removes the impossible frozen-facade override and introduces no production backdoor or alternate vault implementation.

Acceptance must come from a fresh native observation: safe error reporting, an issued encrypted pending checkpoint and generation, unchanged original source digest, and successful registered recovery after restart. If the host does not reject the write, this strategy has not established the fault and must not be labelled PASS. This review performed no chmod, writes to the synthetic source, launches, tests, process termination or production changes.

Evidence preparation note: the first orchestration attempt raised ReferenceError because TextEncoder was unavailable before invoking any filesystem tool. This new file was then created exclusively from verified ASCII bytes; no previous evidence was overwritten.
