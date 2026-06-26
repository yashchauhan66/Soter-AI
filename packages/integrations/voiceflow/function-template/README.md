# SoterAI — Voiceflow Function Templates

These are JavaScript snippets designed for Voiceflow's **Function step**. Each file contains a self-contained function that you can copy and paste directly into a Voiceflow Function block to add SoterAI security guards to your flows.

## How to Use

1. In your Voiceflow project, add a **Function** step to your flow.
2. Open the Function step editor.
3. Copy the contents of the desired `.js` file from this directory and paste it into the Function code editor.
4. Configure the **input variables** and **output variables** as listed below for each function.
5. Connect the Function step into your flow and use the output variables in subsequent steps.

---

## Available Function Templates

### 1. Input Guard (`soterai-input-guard.js`)

Scans user input for prompt injection, jailbreak attempts, toxic content, and other threats before passing it to your LLM.

**Input Variables:**
| Variable      | Type   | Description                |
|---------------|--------|----------------------------|
| `user_input`  | string | The raw user message to scan |

**Output Variables:**
| Variable           | Type    | Description                                  |
|--------------------|---------|----------------------------------------------|
| `soter_allowed`    | boolean | Whether the input passed security checks     |
| `soter_risk_score` | number  | Risk score from 0 (safe) to 1 (dangerous)    |
| `soter_safe_text`  | string  | Sanitized version of the input               |
| `soter_reason`     | string  | Reason if the input was flagged or blocked    |

---

### 2. Output Guard (`soterai-output-guard.js`)

Scans LLM-generated responses before they are sent to the user to prevent data leaks, harmful content, or policy violations.

**Input Variables:**
| Variable       | Type   | Description                      |
|----------------|--------|----------------------------------|
| `ai_response`  | string | The AI-generated response to scan |

**Output Variables:**
| Variable               | Type    | Description                                    |
|------------------------|---------|------------------------------------------------|
| `soter_output_allowed` | boolean | Whether the output passed security checks      |
| `soter_output_safe`    | string  | Sanitized version of the response              |
| `soter_output_reason`  | string  | Reason if the output was flagged or blocked     |
| `soter_output_risk`    | number  | Risk score from 0 (safe) to 1 (dangerous)      |

---

### 3. PII Redactor (`soterai-pii-redactor.js`)

Detects and redacts personally identifiable information (PII) such as emails, phone numbers, SSNs, and credit card numbers from text.

**Input Variables:**
| Variable          | Type   | Description                                         |
|-------------------|--------|-----------------------------------------------------|
| `text_to_redact`  | string | The text to scan for PII                            |
| `redaction_mode`  | string | Optional. One of `PARTIAL`, `FULL`, or `HASH`. Defaults to `PARTIAL`. |

**Output Variables:**
| Variable            | Type   | Description                                     |
|---------------------|--------|-------------------------------------------------|
| `redacted_text`     | string | Text with PII redacted                          |
| `pii_risk_score`    | number | Risk score indicating PII density               |
| `detected_entities` | array  | List of detected PII entity types               |

---

## Setup Instructions

1. Get your SoterAI API key from https://app.cybersecurityguard.com/dashboard
2. Replace `{your_api_key}` in the function code with your actual API key, or store it in a Voiceflow variable and reference it.
3. Copy the function code into a Voiceflow Function step.
4. Configure the input and output variables exactly as listed above.
5. Connect the Function step into your conversation flow.

## Security Notes

- Store your API key in Voiceflow's secure variable storage rather than hardcoding it.
- Use BALANCED mode for general chatbots; switch to STRICT for high-security use cases.
- Monitor the SoterAI dashboard at https://app.cybersecurityguard.com for threat analytics.

## Files in This Directory

| File                         | Description              |
|------------------------------|--------------------------|
| `soterai-input-guard.js`    | Input Guard function     |
| `soterai-output-guard.js`   | Output Guard function    |
| `soterai-pii-redactor.js`   | PII Redactor function    |
