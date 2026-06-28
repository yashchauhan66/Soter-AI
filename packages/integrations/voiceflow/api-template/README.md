# Voiceflow API Step Templates

Use these templates to add SoterAI checks to a Voiceflow assistant without a custom integration runtime.

## Setup

1. Create project variables:
   - `{soter_api_key}`
   - `{soter_base_url}`
   - `{project_id}`
   - `{last_user_message}`
   - `{assistant_output}`
2. Add an API Step before sending user text to an LLM.
3. Copy the method, URL, headers, and body from `input-guard.json`.
4. Save response fields into Voiceflow variables such as `{soter_allowed}`, `{soter_risk_score}`, `{soter_safe_text}`, and `{soter_reason}`.
5. Add a condition step:
   - Continue when `{soter_allowed}` is `true`.
   - Route to a safe fallback when `{soter_allowed}` is `false`.

## Recommended Flow

User input -> SoterAI Input Guard -> LLM prompt -> SoterAI Output Guard -> Reply to user.

For knowledge base workflows, run `rag-scanner.json` before documents are added to retrieval storage.
