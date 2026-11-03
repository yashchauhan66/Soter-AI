# Protect workspace secrets

SoterAI can find raw secrets in sensitive project files such as `.env`, private-key files, and cloud credential files.

Review every finding before any change is made. When you approve migration, SoterAI stores encrypted recovery data outside your project and replaces raw values on disk with safe placeholders.

After a successful migration, direct readers see placeholders for the selected migrated values in those current saved files. Other copies, values not detected or selected, inherited environments and independent same-user processes remain outside this protection.