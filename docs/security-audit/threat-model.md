# Threat Model

Primary assets: API keys, webhook secrets, prompt versions, guard logs, RAG documents, vector chunks, billing state, tenant data, and admin actions.

Primary attack surfaces: public auth/forms, guard APIs, dashboard APIs, webhooks, RAG ingestion, vector retrieval, SAML/SCIM, billing webhooks, integrations, and worker endpoints.

Controls include tenant guards, RBAC, redaction, rate limits, signed webhooks, encrypted secrets, RAG quarantine, vector ACLs, audit exports, and fail-closed production config.

