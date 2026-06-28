# SoterAI Voiceflow Templates

Voiceflow can call SoterAI through API Step blocks. This package contains copy-ready templates for the core AI security checks:

- Input Guard: block prompt injection, jailbreaks, and malicious user input.
- Output Guard: inspect assistant output before it is shown to users.
- PII Redactor: redact sensitive data before storing or sending text.
- RAG Document Scanner: score documents before retrieval ingestion.

## Files

- `api-template/README.md`: setup guide for Voiceflow API Steps.
- `api-template/input-guard.json`: API Step template for `/api/guard/input`.
- `api-template/output-guard.json`: API Step template for `/api/guard/output`.
- `api-template/pii-redactor.json`: API Step template for redaction through `/api/guard/input`.
- `api-template/rag-scanner.json`: API Step template for `/api/rag/document/trust-score`.

## Required Variables

Create these Voiceflow variables before importing or recreating the steps:

- `{soter_api_key}`: SoterAI project API key.
- `{soter_base_url}`: SoterAI API base URL, for example `https://soterai.dev`.
- `{project_id}`: optional SoterAI project ID.
- `{last_user_message}`: latest user input.
- `{assistant_output}`: latest assistant response.

Keep the API key in Voiceflow's secret or environment variable storage where available.
