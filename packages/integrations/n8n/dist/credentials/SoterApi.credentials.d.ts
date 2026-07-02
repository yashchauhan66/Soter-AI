import type { ICredentialTestRequest, ICredentialType, INodeProperties } from "n8n-workflow";
export declare class SoterApi implements ICredentialType {
    name: string;
    displayName: string;
    documentationUrl: string;
    test: ICredentialTestRequest;
    properties: INodeProperties[];
}
