# Encryption And Key Management Policy

## Controls

- API keys and SCIM tokens are stored as hashes.
- Webhook signing secrets use managed secret storage paths where configured.
- Environment secrets are gitignored and must not be copied into docs or logs.
- Key rotation must be recorded with audit evidence.

## Evidence Required

- Production KMS configuration proof.
- Rotation logs.
- Access review for secret administrators.
