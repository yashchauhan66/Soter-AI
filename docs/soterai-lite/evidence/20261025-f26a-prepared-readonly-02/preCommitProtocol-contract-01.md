# F26a staged-listing parser fixture contract01

**TEST-ONLY / PREPARED / STATIC-ONLY / NOT-EXECUTED; independence LOW.** This freezes the adjacent `preCommitProtocol.test.ts` for root review/adoption after F25 byte barriers. No production module was added/imported/executed; no canonical test, queue, ledger, Git config/index/hooks/profile or process fixture changed. No tests, Git or hooks ran. This is a pure component protocol for the existing F26a card, not a replacement plan, acceptance or DONE claim.

Proposed canonical adoption path: `packages/vscode-extension/src/__tests__/preCommitProtocol.test.ts`. Proposed production API only:

```ts
export function parseStagedEntries(raw: Buffer): readonly {
  path: string;
  oid: string;
  mode: "100644" | "100755";
}[] | undefined;
```

Each test dynamically imports `../history-hooks/PreCommitProtocol` only when subsequently executed from the canonical test directory. The preparation author did not execute that import. A missing-module baseline is expected before implementation and is not a protection result.

The input is the exact binary output of the future finite `git ls-files --stage -z` operation against the separately validated actual effective index. Accepted rows use exact framing `<mode> SP <40-lowercase-hex-oid> SP 0 TAB <UTF8-path> NUL`. Empty Buffer is an empty proposed tree. Return each exact input path spelling/OID/mode in input order, with no extra fields. Repeated OIDs under different paths remain separate parser contexts. Framing does not prove object existence: an all-zero40-hex OID passes this parser and must fail later missing-object/identity admission; it is not an ALLOW decision.

Bounds are128 entries, a129th sentinel refuses the **whole** input, and262144 raw listing bytes inclusive. The fixture additionally proposes full path≤2048 UTF8 bytes and component≤255 UTF16 code units, so the exact listing-boundary test uses128 safe1997-byte paths:128 × (50-byte header +1997 path bytes +1 NUL)=262144. A single extra valid path byte isolates the listing overflow. The exact128/129 entry tests independently isolate the count boundary. These path bounds are explicit suggested component scope; root must review them before adopting the fixture rather than silently changing assertions later.

Paths are canonical relative slash paths. Reject empty/absolute/drive/UNC/backslash/ADS paths; empty, dot or parent components; trailing dot/ASCII space in any component; Windows-invalid `<>:"\\|?*`; Unicode Cc/Cf controls and U+2028/U+2029; reserved Windows device basenames (case-insensitive, including extensions and COM/LPT superscript1–3 forms); short-name-looking component aliases such as SAFE~1.TXT; any `.git` component (case-insensitive). `.gitignore` remains ordinary text. No filesystem or short-name resolution occurs.

For collision admission, compare NFC-normalized lowercase path keys, while retaining original accepted spelling. Reject exact/case/normalization duplicates and file/ancestor conflicts in either record order. NFC collision refusal is conservative; it does not claim NTFS normalizes distinct names. Noncolliding decomposed Unicode remains accepted. Ordinary spaces, Unicode, leading dashes and `a..b.txt` are positive controls.

Fatal UTF8 decoding covers headers and paths; malformed sequences, encoded surrogates, overlong bytes and a path BOM are not replaced/stripped into admitted names. Only regular100644/100755 stage0 entries pass. Any malformed later row, wrong stage/mode/OID, missing delimiter, extra record separator, trailing bytes or overflow returns undefined, never an accepted prefix and never an input-bearing exception.

Only genuine Buffer byte views pass input admission. Non-Buffer primitives/objects/Uint8Array/ArrayBuffer, accessor-coercion objects, forged Buffer prototypes and proxied Buffers return undefined without invoking their property/coercion traps. A genuine Buffer subarray parses only its own byte range. Caller bytes are unchanged on both success and refusal. The parser is synchronous and pure: no filesystem/Git/config/history/registry access, child, logging, console or stdout/stderr write. The sink test intercepts only the synchronous parser calls and restores every output method before assertions; it captures counts, not raw inputs.

The fixture contains32 top-level tests (count to be byte-verified by root before execution). It does not test owner flags, install/backup/undo, object-body analysis, effective-index authority or actual owner-hook invocation. Those remain separate F26a gates described in `protocol-01.md` and the existing card. No coverage or native/feature claim follows from this prepared file.
