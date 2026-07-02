# Company Data Fingerprint Vault

Soter's Company Data Fingerprint Vault lets admins register confidential reference material so the extension and backend can detect when similar company data is being sent to AI destinations.

## What Is Stored

- Normalized text chunks hashed with SHA-256.
- Word-shingle hashes for fuzzy overlap matching.
- Document metadata: name, category, sensitivity, owner department, policy action, source type, retention days, and match timestamps.
- Match logs with destination, source app metadata when available, similarity score, action taken, and redacted preview.

Raw document text is not stored by default. The default and implemented storage mode is `hashed_only`.

## What Is Not Stored

- Raw source document text.
- Raw prompt/file content in match logs.
- Secrets discovered inside source documents.
- Cross-tenant fingerprint bundles.

## Admin Workflow

Use `/admin/fingerprint-vault` or the API:

- `GET /api/admin/fingerprint-vault`
- `POST /api/admin/fingerprint-vault`
- `GET /api/admin/fingerprint-vault/:id`
- `PATCH /api/admin/fingerprint-vault/:id`
- `DELETE /api/admin/fingerprint-vault/:id`
- `POST /api/admin/fingerprint-vault/:id/test`
- `GET /api/admin/fingerprint-vault/:id/matches`

Supported categories include customer lists, legal contracts, investor decks, salary sheets, source code, roadmaps, policies, support exports, financial reports, database exports, confidential notes, and custom.

## Matching

Exact matches use SHA-256 hashes of normalized chunks. Fuzzy matches use hashed 5-word shingles and overlap scoring. Semantic/embedding matching is marked as planned and is not enabled because no third-party embedding provider should receive sensitive text by default.

## Security

All APIs require admin or extension authentication and are organization-scoped. Deleted fingerprint sets are disabled and ignored during matching.
