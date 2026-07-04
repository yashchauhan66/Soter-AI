export class SoterExtensionApiClient {
    constructor(config) {
        this.config = config;
    }
    async fetchPolicy() {
        const url = new URL("/api/extension/policy", this.config.apiBaseUrl);
        url.searchParams.set("organizationId", this.config.organizationId);
        const response = await this.request(url, { method: "GET" });
        return response.json();
    }
    async fetchDestinations() {
        const url = new URL("/api/extension/destinations", this.config.apiBaseUrl);
        url.searchParams.set("organizationId", this.config.organizationId);
        const response = await this.request(url, { method: "GET" });
        const body = await response.json();
        return body.destinations;
    }
    async heartbeat(heartbeat) {
        const response = await this.request(new URL("/api/extension/heartbeat", this.config.apiBaseUrl), {
            method: "POST",
            body: JSON.stringify(heartbeat),
        });
        return response.json();
    }
    async scan(payload) {
        await this.request(new URL("/api/extension/scan", this.config.apiBaseUrl), {
            method: "POST",
            body: JSON.stringify({
                organizationId: this.config.organizationId,
                employeeId: this.config.employeeId,
                url: payload.url,
                riskScore: payload.result.riskScore,
                detectedDataTypes: payload.result.detectedDataTypes,
                action: payload.result.action,
                redactedPreview: payload.result.redactedText.slice(0, 500),
            }),
        });
    }
    async audit(event) {
        await this.request(new URL("/api/extension/audit-log", this.config.apiBaseUrl), {
            method: "POST",
            body: JSON.stringify(event),
        });
    }
    async requestApproval(payload) {
        const response = await this.request(new URL("/api/extension/approval-request", this.config.apiBaseUrl), {
            method: "POST",
            body: JSON.stringify({
                organizationId: this.config.organizationId,
                employeeId: this.config.employeeId,
                url: payload.url,
                justification: payload.justification,
                riskScore: payload.result.riskScore,
                detectedDataTypes: payload.result.detectedDataTypes,
                redactedPreview: payload.result.redactedText.slice(0, 1000),
            }),
        });
        return response.json();
    }
    request(url, init) {
        return fetch(url, {
            ...init,
            headers: {
                "content-type": "application/json",
                "x-soter-extension-token": this.config.deviceToken ?? "",
                ...(init.headers ?? {}),
            },
        }).then((response) => {
            if (!response.ok)
                throw new Error(`Soter API request failed: ${response.status}`);
            return response;
        });
    }
}
