import type { IExecuteFunctions, INodeExecutionData, INodeType, INodeTypeBaseDescription, INodeTypeDescription } from "n8n-workflow";
/**
 * The originally published node: one output, every item on it.
 *
 * This exists unchanged so that saved workflows keep behaving exactly as they did
 * when they were built. A node whose output count changes underneath a live
 * workflow would silently drop items, which for a security node means either a
 * broken automation or an unprotected one.
 */
export declare class SoterGuardV1 implements INodeType {
    description: INodeTypeDescription;
    constructor(baseDescription: INodeTypeBaseDescription);
    execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]>;
}
