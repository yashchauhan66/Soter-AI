# F10 Git final review — observed focused receipt disposition

Immutable follow-up to `source-review-git-final-01.md`, same-lineage reviewer `/root/git_design`, independence LOW. This note closes that review's pending focused/Unicode receipt disposition. No source/test edit or test/process execution was performed by the reviewer; existing root-run files were read and hashed. Source review and receipt inspection do not replace independent or human evidence.

Observed `final-focused-03.txt` summary: **411 tests, 22 suites, 411 PASS, zero FAIL/cancel/SKIP**. Its runner receipt records exit0 at `2026-10-17T02:13:01.3550164Z` and the exact Node/tsx serial test argv. Freshly computed raw SHA256 is `d966cf7107d83fa74f7f1b5c826fc2fe185d3958cb00c0d0b72def954de85b15`, matching `final-focused-03.txt.result.json`. The TAP `1..357` is the top-level test count; the actual nested total is the explicit 411-test summary, not 357.

The raw result explicitly records successful GA01-GA08 installed Git/PS controls, GAT01-GAT06 attribute/refusal controls, GNE01 fixed environment control, GOI01-GOI07 object-info/link controls and all three new Unicode filename controls: GQN01-status, GQN01-diff-stat and GQN02-public. The Unicode masking/default-quoting controls now PASS after their retained 3-FAIL baseline (`git-quoted-names-before-01.txt`, raw SHA256 `8a69becf81e9c45b0b29c2a89eef1ff2e2d2109e6e9faf6a9003615f25271e42`). This is the observed exact installed-runtime disposition for those fixtures; it is not an assertion that arbitrary Git escaping/fragments or every configuration are covered.

The same three source files were freshly rehashed after reading the receipt and match the completed static review exactly:

| Source | SHA256 |
| --- | --- |
| `packages/vscode-extension/src/terminal/CheckedGitMetadata.ts` | `f330b8fd1fcb2ef870cf200c4bc78f860e88788f68b1522dc92a27a60ca38c9f` |
| `packages/vscode-extension/src/terminal/PowerShell51Worker.ts` | `855993e83ceb104fe776405174175994879fb08db0c1c2c1861cb547c030b024` |
| `packages/vscode-extension/src/terminal/CheckedPowerShellSession.ts` | `22031dd55d2cac00554e1c91e668da04ec11628ccdd4b51fc5cf121d51c9e150` |

Final scoped review disposition: **no additional open source blocker identified; declared focused Git fixtures PASS on the reviewed bytes**. Broader full-suite/compiler/package identity/native/affected-host/ledger/commit/byte-verification gates remain root acceptance work. In particular native extension host acceptance was not run or certified by this reviewer. Earlier failures/service errors/artifacts remain historical and retained; this follow-up does not rewrite them, promote catalog coverage, assign a rating or authorize the next feature before the serial barrier.
