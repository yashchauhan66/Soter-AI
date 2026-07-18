"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SemanticEgressClient = void 0;
class SemanticEgressClient {
    constructor(baseUrl, apiKey) {
        this.baseUrl = baseUrl;
        this.apiKey = apiKey;
    }
    async fingerprintSource(input) {
        const response = await fetch(`${this.baseUrl}/api/semantic-egress/source/fingerprint`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-api-key": this.apiKey },
            body: JSON.stringify(input),
        });
        return response.json();
    }
    async checkEgress(input) {
        const response = await fetch(`${this.baseUrl}/api/semantic-egress/check`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-api-key": this.apiKey },
            body: JSON.stringify(input),
        });
        return response.json();
    }
}
exports.SemanticEgressClient = SemanticEgressClient;
