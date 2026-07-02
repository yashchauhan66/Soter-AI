# Customer Limitations

Please note the following limitations for Soter Enterprise AI Guard **v0.1.0 beta**:

1. **PDF/DOCX/XLSX/PPTX parsing is metadata-only**: The extension currently extracts metadata (filename, size, type) for these formats. Real text extraction and deep scanning inside these binary document types is deferred to future releases.
2. **Semantic fingerprinting not implemented**: Advanced semantic similarity and embedding-based fingerprinting is planned but not available in v0.1.0 beta. Current matching relies on rules, regex, and exact lineage hashes.
3. **External AI site DOM reliance**: The extension hooks into the UI of external AI sites (ChatGPT, Claude, Gemini, etc.). If these sites change their DOM structures, prompt interception may temporarily degrade until an extension update is pushed.
4. **Broad Permissions**: The required host permissions are broad in order to monitor across AI tools and corporate platforms. Enterprise justification is required.
5. **Beta Status**: v0.1.0 beta is NOT General Availability (GA). It is intended for controlled paid pilot environments only.
