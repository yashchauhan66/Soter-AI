# Local AI Broker Threat Model

## Assets

Source code, secrets, customer/PII data, provider keys, the local broker token, policy, approvals, memory metadata, and model responses.

## Adversaries and entry points

- Malicious or compromised workspace content influencing prompts/tools
- A browser page attempting a localhost request
- Another local process without the broker token
- A compromised or misconfigured model provider
- Dangerous or secret-bearing model output
- A user accidentally approving changed content
- Oversized input intended to exhaust the extension host or broker

## Controls

| Threat | Controls | Residual risk |
| --- | --- | --- |
| Secret sent to model | detectors, mandatory scan, fail-closed redaction, Safe Mode | novel secret formats can evade signatures |
| Protected canary sent/echoed | registered canary match on request and response; block | unregistered canaries are treated only as ordinary secrets |
| Local unauthorized use | loopback bind, 256-bit bearer token, timing-safe comparison, rotation | same-user credential theft remains possible |
| Browser localhost attack | Origin rejection, no CORS, bearer auth | non-browser local malware is outside CORS protections |
| SSRF through provider route | provider URLs only from trusted configuration | a malicious configured provider still receives allowed traffic |
| Approval replay | content/session binding, TTL, once consumption | workspace/session approvals intentionally have broader lifetime |
| Unsafe output | secret/canary/exfiltration/command/code scan before return | semantic harms beyond detectors may remain |
| Audit leakage | sanitization on write/export, hashes and redacted evidence | paths/model labels can be operationally sensitive |
| Resource exhaustion | body, rate, timeout limits | many local source addresses/processes can still consume resources |

## Out of scope

Traffic that bypasses the broker, arbitrary reads by other VS Code extensions, kernel compromise, malware with the user's credential access, and provider-side storage after the broker legitimately forwards allowed content.
