# Review secrets in project files

SoterAI can detect recognized secrets in supported sensitive files, including `.env`, private-key and cloud-credential files.

1. Choose **Protect Workspace Secrets**.
2. Review the detected files and proposed changes.
3. Approve only the values you intend to replace.
4. Keep the encrypted recovery records and their keys.

Approved migration replaces selected values in the current saved files with placeholders and retains encrypted recovery outside the project. It does not silently approve every finding.

Other copies, Git history, unknown values and inherited environments remain separate exposure paths. Review recovery before removing the extension.
