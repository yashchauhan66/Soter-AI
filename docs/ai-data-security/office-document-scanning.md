# Office Document Scanning

**Status: DEFERRED WITH CLEAR LIMITATION in v0.1.0 beta**

## Current Implementation
In v0.1.0 beta, PDF, DOCX, XLSX, and PPTX files are treated as metadata-only. When a user uploads one of these files to an external AI site, the Soter Extension extracts:
- Filename
- File size
- File extension/MIME type

This metadata is logged to the enterprise dashboard for audit purposes. 

## Limitations
- **No deep text extraction:** The extension does not currently extract the internal text of these documents locally.
- **No binary payload scanning:** We do not scan the binary payload against regex or PII rules.

## Future Plans (GA Readiness)
For future releases, local-only parsing libraries (e.g., pdf.js or sheetjs) will be evaluated to safely extract text within the browser context and apply DLP rules, without uploading the raw document to our backend.
