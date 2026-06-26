/**
 * Zapier authentication module for SoterAI.
 *
 * Uses API Key authentication via the x-api-key header,
 * matching the existing Soter REST API auth mechanism.
 */

const authentication = {
  type: "custom" as const,
  test: {
    url: "{{bundle.authData.baseUrl}}/api/health",
    method: "GET" as const,
    headers: {
      "x-api-key": "{{bundle.authData.apiKey}}",
      "User-Agent": "soterai-zapier/1.0",
    },
  },
  fields: [
    {
      key: "apiKey",
      label: "SoterAI API Key",
      type: "password" as const,
      required: true,
      helpText: "Your SoterAI API key (starts with sk_).",
    },
    {
      key: "baseUrl",
      label: "Base URL",
      type: "string" as const,
      required: false,
      default: "https://api.cybersecurityguard.com",
      helpText: "SoterAI API base URL. Change only for self-hosted deployments.",
    },
    {
      key: "projectId",
      label: "Project ID",
      type: "string" as const,
      required: false,
      helpText: "Default SoterAI project ID (optional).",
    },
  ],
  connectionLabel: "SoterAI ({{bundle.authData.projectId}})",
};

export default authentication;
