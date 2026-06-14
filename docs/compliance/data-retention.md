# Data retention

Guard, retrieval, security-event, and audit retention must be configured by deployment policy and contract. Recommended defaults are 30 days for detailed guard/retrieval events, 90 days for operational delivery records, and 365 days for administrative audit evidence where legally appropriate.

Raw OCR secrets are not persisted. Only redacted text, hashes, risk types, and bounded metadata are stored. Deletion jobs should remove expired events, exports, documents, vector points, and related backups according to tenant and legal-hold policy.
