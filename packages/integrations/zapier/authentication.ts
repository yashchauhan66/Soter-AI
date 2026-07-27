/**
 * Zapier authentication module for SoterAI.
 *
 * Uses API Key authentication via the x-api-key header,
 * matching the existing Soter REST API auth mechanism.
 */

const authentication = {
  type: "custom" as const,
  test: {
    url: "https://soterai.in/api/guard/input",
    method: "POST" as const,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": "{{bundle.authData.apiKey}}",
      "User-Agent": "soterai-zapier/1.0",
    },
    body: {
      message: "SoterAI connection test",
    },
  },
  connectionLabel: "SoterAI {{bundle.authData.project}}",
  fields: [
    {
      key: "apiKey",
      label: "SoterAI API Key",
      type: "password" as const,
      required: true,
      helpText: "Your SoterAI API key (starts with sk_). Get your key at [https://soterai.in/dashboard/settings](https://soterai.in/dashboard/settings).",
    },
    {
      key: "project",
      label: "Project ID",
      type: "string" as const,
      required: false,
      helpText: "Default SoterAI project ID (optional). Find it in your [dashboard](https://soterai.in/dashboard/settings).",
    },
  ],
};

export default authentication;
