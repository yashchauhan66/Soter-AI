/**
 * SoterAI Output Guard — Voiceflow Function
 * Paste this into a Voiceflow Function step.
 *
 * Input variables:  ai_response (string)
 * Output variables: soter_output_allowed, soter_output_safe, soter_output_reason, soter_output_risk
 */

const SOTER_API_KEY = "{your_api_key}"; // Set via Voiceflow variable or environment
const SOTER_BASE_URL = "https://api.cybersecurityguard.com";

const response = await fetch(`${SOTER_BASE_URL}/api/guard/output`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": SOTER_API_KEY,
    "User-Agent": "soterai-voiceflow/1.0",
  },
  body: JSON.stringify({
    aiResponse: inputVars.ai_response,
    metadata: { policyMode: "BALANCED", platform: "voiceflow" },
  }),
});

const result = await response.json();

return {
  soter_output_allowed: result.allowed,
  soter_output_safe: result.safeText || inputVars.ai_response,
  soter_output_reason: result.reason || "",
  soter_output_risk: result.riskScore,
};
