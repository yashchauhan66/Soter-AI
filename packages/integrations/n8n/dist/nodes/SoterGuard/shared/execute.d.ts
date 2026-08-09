import type { IExecuteFunctions, INodeExecutionData } from "n8n-workflow";
export declare const PACKAGE_VERSION = "0.5.0";
/**
 * Actions that route their items across the Safe/Flagged outputs on node
 * version 2. "Redact Secrets or PII" is deliberately absent: it never rejects
 * anything, it just returns a cleaned copy, so a second output would always be
 * empty. This mirrors n8n's own Guardrails node, where the classify operation
 * branches and the sanitize operation does not.
 */
export declare const SINGLE_OUTPUT_ACTIONS: string[];
export declare function outputCountForAction(action: string): number;
export declare function executeSoterGuard(this: IExecuteFunctions): Promise<INodeExecutionData[][]>;
