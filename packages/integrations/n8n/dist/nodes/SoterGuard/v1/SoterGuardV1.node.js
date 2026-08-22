"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SoterGuardV1 = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const properties_1 = require("../shared/properties");
const execute_1 = require("../shared/execute");
/**
 * The originally published node: one output, every item on it.
 *
 * This exists unchanged so that saved workflows keep behaving exactly as they did
 * when they were built. A node whose output count changes underneath a live
 * workflow would silently drop items, which for a security node means either a
 * broken automation or an unprotected one.
 */
class SoterGuardV1 {
    constructor(baseDescription) {
        this.description = {
            ...baseDescription,
            version: 1,
            subtitle: '={{$parameter["action"]}}',
            defaults: {
                name: "SoterAI",
            },
            usableAsTool: true,
            inputs: [n8n_workflow_1.NodeConnectionTypes.Main],
            outputs: [n8n_workflow_1.NodeConnectionTypes.Main],
            credentials: [
                {
                    // Optional so Local mode and the workflow audit can run without an
                    // account. Existing v1 workflows already have a credential selected,
                    // so relaxing this cannot change how any of them behave — and Cloud
                    // mode still fails with a named error when the credential is missing.
                    name: "soterApi",
                    required: false,
                },
            ],
            properties: properties_1.soterGuardProperties,
        };
    }
    async execute() {
        return execute_1.executeSoterGuard.call(this);
    }
}
exports.SoterGuardV1 = SoterGuardV1;
