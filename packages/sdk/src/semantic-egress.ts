export class SemanticEgressClient {
  constructor(private baseUrl: string, private apiKey: string) {}

  async fingerprintSource(input: { sourceId: string; sourceType: string; sensitivityLevel: string; content: string }) {
    const response = await fetch(`${this.baseUrl}/api/semantic-egress/source/fingerprint`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": this.apiKey },
      body: JSON.stringify(input),
    });
    return response.json();
  }

  async checkEgress(input: { destinationType: string; destinationName?: string; content: string; sourceIds?: string[] }) {
    const response = await fetch(`${this.baseUrl}/api/semantic-egress/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": this.apiKey },
      body: JSON.stringify(input),
    });
    return response.json();
  }
}
