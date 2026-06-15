# Secrets Handling Review

Raw API keys, webhook secrets, SCIM tokens, invite tokens, and password reset tokens must be displayed once and stored only as hashes or encrypted envelopes.

Production hard-fails when required secret material is missing or mock providers are enabled.

