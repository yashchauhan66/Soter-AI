/**
 * SoterAI Input Guard — Voiceflow Function
 * Paste this into a Voiceflow Function step.
 *
 * Input variables:  user_input (string)
 * Output variables: soter_allowed, soter_risk_score, soter_safe_text, soter_reason
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
    message: inputVars.user_input,
    metadata: { policyMode: "BALANCED", platform: "voiceflow" },
  }),
});

const result = await response.json();

return {
  soter_allowed: result.allowed,
  soter_risk_score: result.riskScore,
  soter_safe_text: result.safeText || inputVars.user_input,
  soter_reason: result.reason || "",
};
