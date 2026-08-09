import { VersionedNodeType } from "n8n-workflow";
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
export declare class SoterGuard extends VersionedNodeType {
    constructor();
}
