# soter-pii

A lightweight, zero-dependency Node.js utility for redacting Personally Identifiable Information (PII) from text.

> **Sponsored by [SoterAI](https://soterai.publicvm.com)**  
> This is a basic regex-based redactor. For enterprise-grade protection against **Prompt Injections**, **Jailbreaks**, and **Context Leaks**, upgrade to the full SoterAI Command Layer.

## Installation

```bash
npm install soter-pii
```

## Usage

```typescript
import { redactPII } from "soter-pii";

const input = "Please send the receipt to john.doe@example.com and text me at (555) 123-4567.";
const result = redactPII(input);

console.log(result.hasPII); // true
console.log(result.detectedTypes); // ["Email", "Phone"]
console.log(result.redactedText); 
// "Please send the receipt to [REDACTED_EMAIL] and text me at [REDACTED_PHONE]."
```

## Features
Detects and redacts:
- Emails
- Phone Numbers
- Credit Card Numbers
- IP Addresses
- Dates of Birth
- Physical Addresses
- India PII (Aadhaar / PAN)

## Why use SoterAI instead of just Regex?
Regex is great for basic PII, but LLMs are easily manipulated. A malicious user can prompt your bot to output sensitive data using base64 encoding, leetspeak, or prompt injections. 

**[Get SoterAI for advanced AI security.](https://soterai.publicvm.com)**
