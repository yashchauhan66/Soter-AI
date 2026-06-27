/**
 * Zapier authentication module for SoterAI.
 *
 * Uses API Key authentication via the x-api-key header,
 * matching the existing Soter REST API auth mechanism.
 */

const authentication = {
  type: "custom" as const,
  test: {
    url: "{{bundle.authData.baseUrl}}/api/guard/input",
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
      default: "https://soterai.publicvm.com",
      helpText: "SoterAI production API base URL. Change only for a self-hosted HTTPS deployment.",
    },
    {
      key: "projectId",
      label: "Project ID",
      type: "string" as const,
      required: false,
      helpText: "Default SoterAI project ID (optional).",
    },
  ],
};

export default authentication;
