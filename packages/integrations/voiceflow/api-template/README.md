# Soter Guard — Voiceflow API Step Templates

Use these templates as custom **API Step** configurations in Voiceflow
to protect your voice/chatbot flows with Soter Guard.

## Architecture

```
User Message → [Soter Input Guard API Step] → LLM / Dialog → [Soter Output Guard API Step] → Reply
```

---

## 1. Input Guard API Step

**Method:** POST  
**URL:** `https://api.cybersecurityguard.com/api/guard/input`

**Headers:**
```
Content-Type: application/json
x-api-key: {your_soter_api_key}
```

**Body (JSON):**
```json
{
  "message": "{user_input}",
  "metadata": {
    "projectId": "{your_project_id}",
    "policyMode": "BALANCED",
    "platform": "voiceflow",
    "sessionId": "{session_id}"
  }
}
```

**Response Mapping:**
| Voiceflow Variable | JSON Path           |
|--------------------|---------------------|
| `soter_allowed`    | `response.allowed`  |
| `soter_risk`      | `response.riskScore`|
| `soter_safe_text` | `response.safeText` |
| `soter_reason`    | `response.reason`   |

**Condition After Step:**
- If `{soter_allowed}` is `false` → Block / show warning message
- If `{soter_allowed}` is `true` → Continue to LLM with `{soter_safe_text}`

---

## 2. Output Guard API Step

**Method:** POST  
**URL:** `https://api.cybersecurityguard.com/api/guard/output`

**Headers:**
```
Content-Type: application/json
x-api-key: {your_soter_api_key}
```

**Body (JSON):**
```json
{
  "aiResponse": "{ai_response}",
  "metadata": {
    "projectId": "{your_project_id}",
    "policyMode": "BALANCED",
    "platform": "voiceflow"
  }
}
```

**Response Mapping:**
| Voiceflow Variable      | JSON Path           |
|-------------------------|---------------------|
| `soter_output_allowed`  | `response.allowed`  |
| `soter_output_safe`     | `response.safeText` |
| `soter_output_reason`   | `response.reason`   |

**Condition After Step:**
- If `{soter_output_allowed}` is `false` → Replace with safe fallback message
- If `{soter_output_allowed}` is `true` → Send `{soter_output_safe}` to user

---

## 3. PII Redactor API Step

**Method:** POST  
**URL:** `https://api.cybersecurityguard.com/api/guard/input`

**Headers:**
```
Content-Type: application/json
x-api-key: {your_soter_api_key}
```

**Body (JSON):**
```json
{
  "message": "{text_to_redact}",
  "metadata": {
    "projectId": "{your_project_id}",
    "_redactionMode": "PARTIAL"
  }
}
```

**Response Mapping:**
| Voiceflow Variable | JSON Path              |
|--------------------|------------------------|
| `redacted_text`    | `response.safeText`    |
| `pii_risk`        | `response.riskScore`   |

---

## Example: Protected Chatbot Flow

```
[Start] → [Capture User Input]
        → [API Step: Soter Input Guard]
        → [Condition: soter_allowed?]
            ├─ No → [Speak: "I cannot process that request."] → [End]
            └─ Yes → [AI Step: GPT/Claude with soter_safe_text]
                   → [API Step: Soter Output Guard]
                   → [Condition: soter_output_allowed?]
                       ├─ No → [Speak: "Let me rephrase..."] → [End]
                       └─ Yes → [Speak: soter_output_safe] → [End]
```

---

## Setup Instructions

1. Get your Soter API key from https://app.cybersecurityguard.com/dashboard
2. Create a project and note the Project ID
3. In Voiceflow, add an API Step block
4. Configure the URL, headers, and body as shown above
5. Map the response variables
6. Add condition blocks to handle threats

## Security Notes

- Store your API key in Voiceflow's secure variable storage
- Never expose the API key in client-side code
- Use BALANCED mode for most chatbots; STRICT for high-security use cases
- Monitor the Soter dashboard for threat analytics
