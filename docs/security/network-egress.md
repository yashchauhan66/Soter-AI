# Network Egress

Date: 2026-07-22

## Implemented controls

`NetworkEgressPolicy` provides deterministic preflight decisions for supported outbound requests:

- URL parsing and protocol validation.
- Cloud metadata, localhost, private IPv4, link-local, and obvious private IPv6 blocking.
- Redirect-chain validation when the caller supplies redirects.
- Allowed-host matching.
- Secret-payload detection and redacted payload preview.
- Strict-mode unknown-destination escalation through `RuntimePolicyEngine`.

Coverage: `STRONG_ENFORCEMENT` only for requests routed through this policy before network execution.

The local broker now exposes this as an authenticated route:

- `POST /v1/preflight/network-egress`

The route returns a decision and redacted payload preview; it does not perform the network request.

## Unsupported claims

SoterAI does not currently install an OS firewall, transparent proxy, DNS resolver, kernel driver, browser-wide network monitor, or packet filter. Therefore arbitrary terminal/process network egress remains `UNSUPPORTED`.

## Next required component

A true local egress firewall requires a companion network proxy or OS-level enforcement layer with DNS resolution, redirect verification, upload classification, per-process attribution, and fail-closed routing.
