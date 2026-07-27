# Public Security Testing Methodology

SoterAI internally tests OWASP web risks, OWASP LLM risks, tenant isolation, payment security, extension security, RAG/vector isolation, AI red-team corpora, webhook signatures, auth/session controls, dependency audit, and deployment headers/CORS. Internal tests include automated unit/regression suites, route inventory, dependency audit, permission validation, and deterministic AI red-team harnesses.

Known limits: internal tests are not independent validation; benchmark corpora cannot prove universal attack blocking; false positives remain; production traffic replay and third-party pentest evidence are still required. External validation status: package prepared, external pentest not completed.
