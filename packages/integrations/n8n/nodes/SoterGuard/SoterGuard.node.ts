import type { INodeTypeBaseDescription, IVersionedNodeType } from "n8n-workflow";
import { VersionedNodeType } from "n8n-workflow";

import { soterGuardBaseDescription } from "./shared/description";
import { SoterGuardV1 } from "./v1/SoterGuardV1.node";
import { SoterGuardV2 } from "./v2/SoterGuardV2.node";

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
export class SoterGuard extends VersionedNodeType {
  constructor() {
    const baseDescription: INodeTypeBaseDescription = soterGuardBaseDescription;

    const nodeVersions: IVersionedNodeType["nodeVersions"] = {
      1: new SoterGuardV1(baseDescription),
      2: new SoterGuardV2(baseDescription),
    };

    super(nodeVersions, baseDescription);
  }
}
