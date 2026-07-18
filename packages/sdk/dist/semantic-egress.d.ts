export declare class SemanticEgressClient {
    private baseUrl;
    private apiKey;
    constructor(baseUrl: string, apiKey: string);
    fingerprintSource(input: {
        sourceId: string;
        sourceType: string;
        sensitivityLevel: string;
        content: string;
    }): Promise<any>;
    checkEgress(input: {
        destinationType: string;
        destinationName?: string;
        content: string;
        sourceIds?: string[];
    }): Promise<any>;
}
//# sourceMappingURL=semantic-egress.d.ts.map