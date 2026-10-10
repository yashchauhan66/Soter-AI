import type {
  Icon,
  ICredentialDataDecryptedObject,
  ICredentialTestRequest,
  ICredentialType,
  IDataObject,
  IHttpRequestHelper,
  INodeProperties,
} from "n8n-workflow";
import { validatedBaseUrl } from "../shared/baseUrl";

export class SoterApi implements ICredentialType {
  name = "soterApi";
  displayName = "SoterAI API";
  documentationUrl = "https://soterai.in/docs";
  icon: Icon = { light: "file:soterai.svg", dark: "file:soterai.dark.svg" };

  /**
   * Proves the key works without submitting anything to be analysed.
   *
   * This used to POST `"SoterAI connection test"` to `/api/guard/input`, which is
   * the detection endpoint — so pressing Test ran the full guard pipeline on that
   * sentence. The deployed ML classifier scores it as PROMPT_INJECTION with 0.90
   * attack probability (it is a bare imperative naming the system, which is the
   * shape the model learned), so every click wrote a false PROMPT_INJECTION
   * incident into the customer's own security log, spent a request from their
   * monthly quota, and added a reputation penalty to whatever session the
   * fingerprint landed in. A credential test that dirties the audit trail it is
   * meant to give you confidence in is worse than no test.
   *
   * `/api/workflow/audit` is the right shape for this: it authenticates with the
   * same `x-api-key` (so a pass really does mean the key is valid for this
   * deployment), and it is pure static analysis of the JSON in the body — no
   * model, no reputation, no incident row, and nothing persisted. An empty
   * workflow is the smallest valid input it accepts.
   *
   * It has been part of the API since 2026-08-15, which is before the first
   * release of this node, so any deployment new enough to serve this node serves
   * it. A trailing slash on the Base URL is harmless here: n8n joins `baseURL`
   * and `url` through axios, which collapses the separator.
   */
  test: ICredentialTestRequest = {
    request: {
      baseURL: `={{ (${validatedBaseUrl.toString()})($credentials.baseUrl) }}`,
      url: "/api/workflow/audit",
      method: "POST",
      disableFollowRedirect: true,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": "={{$credentials.apiKey}}",
        Origin: "={{($credentials.baseUrl || 'https://soterai.in').trim().match(/^https?:\\/\\/[^/]+/i)[0]}}",
      },
      body: {
        workflowJson: '{"nodes":[],"connections":{}}',
      },
    },
  };

  preAuthentication = async function (
    this: IHttpRequestHelper,
    credentials: ICredentialDataDecryptedObject,
  ): Promise<IDataObject> {
    validatedBaseUrl(String(credentials.baseUrl || "https://soterai.in"));
    return {};
  };

  properties: INodeProperties[] = [
    {
      displayName: "API Key",
      name: "apiKey",
      type: "string",
      typeOptions: { password: true },
      default: "",
      required: true,
      description: "Sent only in the x-api-key header. This credential never uses or reuses an Authorization: Bearer token.",
    },
    {
      displayName: "Base URL",
      name: "baseUrl",
      type: "string",
      default: "https://soterai.in",
      description: "SoterAI production API base URL. Change only for a self-hosted HTTPS deployment. A trailing slash is ignored.",
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
