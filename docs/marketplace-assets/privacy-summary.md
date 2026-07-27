# Privacy Summary

SoterAI Guard is designed around data minimization.

- Browser extension scans supported prompt and file content locally where possible.
- Clean prompts are not sent as raw text in default storage or backend audit paths.
- Audit events use hashes, lengths, destination metadata, finding types, and redacted previews.
- Secrets, private keys, and API tokens are redacted before user-facing previews and webhook/SIEM delivery.
- Source URLs are normalized and stripped of query parameters before hashing.
- Organization and tenant boundaries are enforced for policy bundles, enrollment, and fingerprint matching.

API and server-side integrations process content submitted by the customer application for the requested guard action. Customers should call SoterAI from server-side code when using API keys and should avoid embedding API keys in browser or mobile clients.

