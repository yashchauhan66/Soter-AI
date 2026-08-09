"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SoterGuard = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const description_1 = require("./shared/description");
const SoterGuardV1_node_1 = require("./v1/SoterGuardV1.node");
const SoterGuardV2_node_1 = require("./v2/SoterGuardV2.node");
/**
 * SoterAI community node.
 *
 * Versioned rather than edited in place. Version 2 routes items across Safe and
 * Flagged outputs and replaces the Security Context JSON blob with guided
 * fields; version 1 keeps the single output and the JSON field it was published
 * with. n8n stores `typeVersion` on every saved node, so an existing workflow
 * keeps loading v1 and behaves identically, while new nodes get v2.
 *
 * Only this class is exported from the file listed in package.json's `n8n.nodes`
 * — the loader registers every node-like export it finds, so the version classes
 * deliberately live in their own directories.
 */
class SoterGuard extends n8n_workflow_1.VersionedNodeType {
    constructor() {
        const baseDescription = description_1.soterGuardBaseDescription;
        const nodeVersions = {
            1: new SoterGuardV1_node_1.SoterGuardV1(baseDescription),
            2: new SoterGuardV2_node_1.SoterGuardV2(baseDescription),
        };
        super(nodeVersions, baseDescription);
    }
}
exports.SoterGuard = SoterGuard;
