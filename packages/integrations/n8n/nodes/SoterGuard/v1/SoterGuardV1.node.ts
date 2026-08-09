import type {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeBaseDescription,
  INodeTypeDescription,
} from "n8n-workflow";
import { NodeConnectionTypes } from "n8n-workflow";

import { soterGuardProperties } from "../shared/properties";
import { executeSoterGuard } from "../shared/execute";

/**
 * The originally published node: one output, every item on it.
 *
 * This exists unchanged so that saved workflows keep behaving exactly as they did
 * when they were built. A node whose output count changes underneath a live
 * workflow would silently drop items, which for a security node means either a
 * broken automation or an unprotected one.
 */
export class SoterGuardV1 implements INodeType {
  description: INodeTypeDescription;

  constructor(baseDescription: INodeTypeBaseDescription) {
    this.description = {
      ...baseDescription,
      version: 1,
      subtitle: '={{$parameter["action"]}}',
      defaults: {
        name: "SoterAI",
      },
      usableAsTool: true,
      inputs: [NodeConnectionTypes.Main],
      outputs: [NodeConnectionTypes.Main],
      credentials: [
        {
          name: "soterApi",
          required: true,
        },
      ],
      properties: soterGuardProperties,
    };
  }

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    return executeSoterGuard.call(this);
  }
}
