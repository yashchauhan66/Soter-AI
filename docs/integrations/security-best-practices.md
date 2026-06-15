# Security Best Practices

CyberRakshak Guard is OWASP LLM Top 10 aligned and built for defense-in-depth:
**detect, block, redact, monitor, and report**. It reduces risk. It does **not**
guarantee complete protection, and false positives and false negatives are
possible. Treat it as one layer alongside secure development practices.

## Keep the API key server-side only

- Never embed `CYBERRAKSHAK_API_KEY` in browser/client code, mobile apps, or any
  artifact shipped to users.
- In Next.js, do **not** prefix it with `NEXT_PUBLIC_`. Read it only in route
  handlers, server actions, or server components.
- In WordPress, the key lives in the options table and is used only from PHP.
  The frontend calls the local REST proxy.
- The browser should talk to **your** server, which talks to the Guard.

## Rotate keys

- Rotate API keys on a schedule and immediately if one may have leaked.
- Use separate `ck_test_…` and `ck_live_…` keys per environment.
- Use distinct keys per project so a single leak has a limited blast radius.

## Always run the output guard

- Guarding input is not enough. Run `guardOutput` / `guard_output` on every LLM
  response to catch leaked secrets, PII, system-prompt leakage, and unsafe
  output.
- For RAG, also verify grounding so answers stay attributable to authorized
  sources.

## Redact logs

- Do not log raw prompts or completions in your application.
- The SDKs never log the API key or raw text, even in debug mode; keep that
  property in your own code.
- When you must persist examples for debugging, store the **redactedText** /
  **safe_text**, not the original.

## Configure retention

- Keep stored guard events only as long as you need them.
- Prefer storing hashes/redacted text over raw content.
- Align retention with your privacy obligations (e.g. data-subject requests).

## Sign and verify webhooks

- If you consume Guard webhooks, verify the HMAC signature before trusting the
  payload, using a constant-time comparison:

```ts
import { createHmac, timingSafeEqual } from "crypto";

function verify(rawBody: string, header: string, secret: string) {
  const m = /t=(\d+),v1=([0-9a-f]+)/.exec(header);
  if (!m) return false;
  const [, t, sig] = m;
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(sig, "hex"));
}
```

- Reject stale timestamps to prevent replay.

## Timeout and fail behavior

- Set a sensible `timeoutMs` / `timeout` (5s is a good default).
- Decide your failure mode deliberately:
  - **Fail open** (proceed if the Guard is unreachable) favors availability.
  - **Fail closed** (block if the Guard is unreachable) favors safety.
- For high-risk surfaces, prefer fail-closed on the **output** path so unsafe
  content is never returned when the guard cannot run.
- Use the SDK `retries` option for transient 5xx/network errors, but cap it so
  you do not stack latency.

## Rate limiting and abuse

- Respect `429` and the `Retry-After` header; back off rather than hammering.
- Add your own per-IP/per-user limits in front of public chat endpoints.
- The WordPress proxy includes a per-IP transient rate limit; tune it for your
  traffic.

## Never claim 100% security

- Do not market or describe the Guard as guaranteeing complete protection.
- Use honest wording: *OWASP LLM Top 10 aligned*, *risk reduction*,
  *defense-in-depth*, *detect/block/redact/monitor/report*.
- Combine the Guard with least-privilege design, input validation, output
  encoding, secrets management, and monitoring.
