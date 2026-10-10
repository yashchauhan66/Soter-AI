# Protect workspace secrets

SoterAI can find raw secrets in sensitive project files such as `.env`, private-key files, and cloud credential files.

Review every finding before any change is made. When you approve migration, SoterAI stores encrypted recovery data outside your project and replaces raw values on disk with safe placeholders.

That means AI tools and CLI agents that read files directly see placeholders instead of secret values.