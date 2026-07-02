# AI File Content Scanner

Soter scans supported file content locally before upload to configured AI destinations.

## Phase 1 Supported Files

Text and source files are read locally up to the configured scan window:

`.txt`, `.log`, `.env`, `.json`, `.csv`, `.sql`, `.md`, `.yaml`, `.yml`, `.xml`, `.js`, `.ts`, `.tsx`, `.jsx`, `.py`, `.java`, `.go`, `.rs`, `.php`, `.rb`, `.cs`, `.cpp`, `.c`, `.h`, `.sh`, `.ps1`.

Default scan limit is 1 MB.

## Metadata-Only Files

PDF, DOCX, XLSX, and PPTX are currently metadata-only because no real parser has been implemented in the extension. Soter does not claim rich parsing for these formats yet.

## Actions

- `allow`: file remains selected.
- `warn`: user sees an overlay but can proceed.
- `block`: file input is cleared.
- `require_approval`: file input is cleared and approval can be requested.
- `require_justification`: file input is cleared until justification flow accepts it.
- `redact`/`rewrite`: for files, Soter shows redacted preview/safe context; it does not modify the original file in place.

## Privacy

File content is scanned locally. Backend event logs receive hashed filename, extension, MIME type, size, scanned bytes, detected data types, risk score, action, and redacted preview only.
