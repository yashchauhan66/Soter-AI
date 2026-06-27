import type {
  ICredentialTestRequest,
  ICredentialType,
  INodeProperties,
} from "n8n-workflow";

export class SoterApi implements ICredentialType {
  name = "soterApi";
  displayName = "SoterAI API";
  documentationUrl = "https://soterai.publicvm.com/docs";

  test: ICredentialTestRequest = {
    request: {
      baseURL: "={{$credentials.baseUrl}}",
      url: "/api/guard/input",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": "={{$credentials.apiKey}}",
      },
      body: {
        message: "SoterAI connection test",
      },
    },
  };

  properties: INodeProperties[] = [
    {
      displayName: "API Key",
      name: "apiKey",
      type: "string",
      typeOptions: { password: true },
      default: "",
      required: true,
      description: "Your SoterAI API key (sk_...)",
    },
    {
      displayName: "Base URL",
      name: "baseUrl",
      type: "string",
      default: "https://soterai.publicvm.com",
      description: "SoterAI production API base URL. Change only for a self-hosted HTTPS deployment.",
    },
    {
      displayName: "Project ID",
      name: "projectId",
      type: "string",
      default: "",
      description: "Default project ID for all requests (optional, can be set per node)",
    },
  ];
}
