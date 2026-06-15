# Data Flow Diagram

1. User or chatbot sends message to guard API.
2. API key/session guard validates caller.
3. Detectors score and redact content.
4. Safe result is returned to application.
5. Redacted log, usage counter, security event, and optional webhook are persisted.
6. Reports and exports use aggregate or redacted data.

Trust boundaries: browser, customer app, CyberRakshak API, database, Redis, secret store, vector provider, email provider, Razorpay, SIEM, and webhook receivers.

