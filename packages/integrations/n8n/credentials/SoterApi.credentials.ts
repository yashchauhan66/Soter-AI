import type {
  ICredentialType,
  INodeProperties,
} from "n8n-workflow";

export class SoterApi implements ICredentialType {
  name = "soterApi";
  displayName = "SoterAI API";
  documentationUrl = "https://soterai.publicvm.com/docs";

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
      default: "http://13.200.123.232:3000",
      description: "SoterAI API base URL. Use the default until soterai.publicvm.com DNS is repaired.",
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
