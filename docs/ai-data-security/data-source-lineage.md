# Data Source Lineage Guard

Data Source Lineage Guard records privacy-safe source-to-destination movement for company data sent to AI tools.

## What Is Monitored

Only configured enterprise source apps and configured AI destinations should participate in lineage tracking. Source app configs are managed through:

- `GET /api/admin/source-apps`
- `POST /api/admin/source-apps`
- `PATCH /api/admin/source-apps/:id`
- `DELETE /api/admin/source-apps/:id`
- `GET /api/extension/source-apps`

Supported categories are email, document, spreadsheet, source code, ticketing, CRM, chat, knowledge base, internal app, and unknown.

## What Is Stored

Lineage events store high-level metadata:

- Source app/category/domain.
- Redacted or hashed source URL.
- Destination AI app/category/domain.
- Data types, risk score, severity, action, approval/fingerprint references.
- Redacted preview only.

Raw clipboard text is not stored by default.

## Admin View

`/admin/data-lineage` shows recent AI data movement events. API access:

- `POST /api/extension/lineage-event`
- `GET /api/admin/data-lineage`
- `GET /api/admin/data-lineage/:id`

## Current Limitation

The backend model and APIs are implemented. Full source-page copy tracking requires deploying content scripts or dynamic scripting to configured enterprise source domains after host permissions are approved. The current extension change focuses on AI destination scanning and file upload inspection.
