import type { Icon, ICredentialTestRequest, ICredentialType, INodeProperties } from "n8n-workflow";
export declare class SoterApi implements ICredentialType {
    name: string;
    displayName: string;
    documentationUrl: string;
    icon: Icon;
    test: ICredentialTestRequest;
    properties: INodeProperties[];
}
