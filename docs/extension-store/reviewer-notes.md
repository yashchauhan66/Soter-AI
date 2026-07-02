# Reviewer Notes for Store Submission

Dear Reviewer,

**App Purpose:**
Soter Enterprise AI Guard is an enterprise security extension (DLP) designed to be deployed via MDM to corporate employees. It protects sensitive corporate data from being inadvertently leaked to public AI services like ChatGPT, Claude, and Gemini.

**Login/Test Account:**
This extension requires a valid enterprise enrollment token provided by a company's internal Soter Admin dashboard.
For the review process, we have provisioned a synthetic endpoint and token:
- **API Base URL:** `https://api.soter-test.com` (synthetic for review)
- **Enrollment Code:** `TEST-ENROLL-9999` (synthetic for review)

*(Note: In an actual enterprise deployment, these are configured by the admin).*

**Permission Explanations:**
- **Broad Host Permissions (`*://*/*` etc.):** Required to monitor copy events from internal systems (data lineage) and paste events into external AI tools. This is core to the DLP functionality.
- **Storage:** Required to store the local DLP policy, thresholds, and enrollment state.
- **ClipboardRead/Write:** Required to detect sensitive patterns in copied data before it is pasted into AI tools.

**Privacy and Data Handling:**
- The extension evaluates prompts LOCALLY in the browser.
- Raw prompts, files, or copied texts are NEVER sent to our servers.
- Only redacted previews, hashes, and metadata are sent to the enterprise admin's isolated tenant dashboard.

Thank you,
The Soter Security Team
