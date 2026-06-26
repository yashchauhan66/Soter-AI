import type {
  ICredentialType,
  INodeProperties,
} from "n8n-workflow";

export class SoterApi implements ICredentialType {
  name = "soterApi";
  displayName = "SoterAI API";
  documentationUrl = "https://docs.soterai.dev/integrations/n8n";

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
      default: "https://api.soterai.dev",
      description: "SoterAI API base URL. Change only for self-hosted deployments.",
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
