/**
 * SoterAI PII Redactor — Voiceflow Function
 * Paste this into a Voiceflow Function step.
 *
 * Input variables:  text_to_redact (string), redaction_mode (string, optional: PARTIAL|FULL|HASH)
 * Output variables: redacted_text, pii_risk_score, detected_entities
 */

const SOTER_API_KEY = "{your_api_key}"; // Set via Voiceflow variable or environment
const SOTER_BASE_URL = "https://api.cybersecurityguard.com";

const response = await fetch(`${SOTER_BASE_URL}/api/guard/input`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": SOTER_API_KEY,
    "User-Agent": "soterai-voiceflow/1.0",
  },
  body: JSON.stringify({
    message: inputVars.text_to_redact,
    metadata: {
      _redactionMode: inputVars.redaction_mode || "PARTIAL",
      platform: "voiceflow",
    },
  }),
});

const result = await response.json();

return {
  redacted_text: result.safeText || inputVars.text_to_redact,
  pii_risk_score: result.riskScore,
  detected_entities: result.detectedEntities || [],
};
