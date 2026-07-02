"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SoterApi = void 0;

// Compatibility mirror for n8n Creator Portal's repository-root source check.
class SoterApi {
    constructor() {
        this.name = "soterApi";
        this.displayName = "SoterAI API";
        this.documentationUrl = "https://soterai.publicvm.com/docs";
        this.test = {
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
        this.properties = [
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
}
exports.SoterApi = SoterApi;
