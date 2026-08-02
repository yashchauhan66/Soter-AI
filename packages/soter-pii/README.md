# soter-pii

A lightweight, **zero-dependency** PII & secret redactor for Node.js, browsers,
Deno, and Bun. Deterministic regex-based detection with **checksum validation**
(Luhn for cards, Verhoeff for Aadhaar) so naive 13–19-digit false positives are
eliminated.

> Sponsored by [SoterAI](https://soterai.in).
> For full AI-security — prompt-injection defense, jailbreak detection, context
> firewalls — use the SoterAI Command Layer. This package is the fast local PII
> redaction primitive.

## Install

```bash
npm install soter-pii
```

## Quick start

```ts
import { redactPII, containsPII, redactDeep } from "soter-pii";

const r = redactPII("Email priya@example.com or call +1 (555) 123-4567.");
console.log(r.hasPII);        // true
console.log(r.detectedTypes); // [ 'Email', 'Phone' ]
console.log(r.redactedText);  // Email [REDACTED_EMAIL] or call [REDACTED_PHONE].
console.log(r.matchCount);    // 2
console.log(r.counts);        // { Email: 1, Phone: 1 }

// Gate only on a boolean
containsPII("order #4242 4242 4242 4242"); // true

// Redact every string in a nested object
redactDeep({ a: "e@x.com", n: [{ b: "AKIAIOSFODNN7EXAMPLE" }] });
```

## What it detects

| Category | Entities |
|---|---|
| Contact | Email, Phone (E.164 / US parenthesized / international) |
| Network | IPv4 (octet-validated 0–255), IPv6, MAC |
| Financial | Credit/debit card (Luhn + IIN/BIN prefix), CVV in context, IBAN (mod-97), SWIFT/BIC, India PAN, India Aadhaar (Verhoeff) |
| Government ID | US SSN (structure-validated), Passport number |
| Secrets | AWS AKIA/ASIA, GitHub PAT/OAuth/fine-grained, OpenAI `sk-`, Anthropic `sk-ant-`, Slack `xox*`, Google `AIza`, JWT, PEM private-key headers, generic `api_key=…/secret=…/token=…/password=…` |
| Context-bound | Date of birth, postal address |

## Precision: checksums not just shapes

Naive regexes treat any 13–19 digit run as a card. `soter-pii` requires:

1. A **known IIN/BIN prefix** (Visa `4`, Mastercard `51–55`/`2221–2720`, Amex
   `34/37`, Discover `6011/65/644–649`, UnionPay `62`, RuPay `60/81/82`, JCB/Diners `35/36/38`).
2. A passing **Luhn checksum**.
3. Not all-same-digit.

`4111 1111 1111 1111` is redacted; `1234 5678 9012 3456` is left alone.
Aadhaar likewise requires a passing **Verhoeff checksum**.

## ReDoS safety

Every bundled pattern is built to run in linear time: no nested quantifiers,
no ambiguous alternation inside unbounded repeats, bounded character classes only.

Custom rules passed via `customRules` are screened at registration with a
conservative heuristic that rejects known catastrophic-backtracking shapes —
`(a+)+`, `(a|ab)+`, `.*+` overlaps, quantified alternation. A rejected rule
throws at registration time, never at scan time.

## Configuration

```ts
redactPII(text, {
  // run only these labels
  include: ["Email", "Phone"],

  // skip these labels
  exclude: ["IP Address"],

  // never redact these exact (case-insensitive) values
  allowlist: ["support@yourcompany.com", "8.8.8.8"],

  // swap labels for fixed-length masks
  mode: "masked",       // "[REDACTED_EMAIL]" -> "***************"
  maskChar: "*",

  // custom recognizers — ReDoS-screened at registration
  customRules: [{
    label: "Employee ID",
    pattern: /\bEMP-\d{6}\b/g,
    replacement: "[REDACTED_EMPLOYEE_ID]",
    validate: (m) => !m.endsWith("000000"),
  }],
});
```

## API

### `redactPII(text: string, options?: RedactionOptions): RedactionResult`

Returns:

```ts
{
  originalText: string;
  redactedText: string;
  hasPII: boolean;
  detectedTypes: string[];   // e.g. ["Email", "Phone"]
  matchCount: number;        // total spans replaced
  counts: Record<string, number>; // per-label counts
}
```

### `redactDeep<T>(value: T, options?: RedactionOptions): T`

Recursively redacts every string in a JSON-like value. Non-string leaves are
returned unchanged.

### `containsPII(text: string, options?: RedactionOptions): boolean`

Boolean gate (useful for routing / blocking before the full redact result is
needed).

### `luhnCheck(digits: string): boolean` / `verhoeffCheck(digits: string): boolean`

Exported for callers that need standalone checksum validation.

### `isReDoSSafe(pattern: RegExp): boolean`

Exposes the custom-rule safety screen.

## Comparison to cloud alternatives

| | soter-pii | Microsoft Presidio | AWS Comprehend DLP |
|---|---|---|---|
| Dependencies | 0 | >30 (Python / Docker) | AWS SDK |
| Offline | yes | yes (with models) | no |
| Latency per doc | micro-seconds | ms–10s of ms | network RTT |
| Setup | `npm i` | Docker + model warmup | IAM roles / endpoints |
| Determinism | exact | model version-dependent | version-dependent |
| ReDoS-safe | yes (by construction + screening) | n/a (Python `re`) | n/a |
| Checksum validation (Luhn / Verhoeff / IBAN) | yes | via custom validators | no |

For large-scale enterprise DLP with ML-based NER, use Presidio or a cloud DLP
service. For LLM-prompt pre-redaction, log sanitization, browser/CLI use, and
anywhere you need a fast deterministic layer, `soter-pii` is designed to be
the local first line of defense.

## License

Apache-2.0 — see `LICENSE`.
