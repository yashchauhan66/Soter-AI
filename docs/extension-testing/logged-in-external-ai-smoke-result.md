# Logged-in External AI Smoke Tests

## Status: ENV_BLOCKED

- ChatGPT: ENV_BLOCKED
- Claude: ENV_BLOCKED
- Gemini: ENV_BLOCKED
- Perplexity: ENV_BLOCKED

**Reason:** Docker daemon is not running on the environment. Without the backend API, the extension cannot properly enroll and fetch the DLP policies required to execute the smoke tests. Therefore, these tests are blocked by the environment.
