import type { INodeTypeBaseDescription, IVersionedNodeType } from "n8n-workflow";
import { VersionedNodeType } from "n8n-workflow";

import { soterGuardBaseDescription } from "../../shared/description";
import { SoterGuardV1 } from "./v1/SoterGuardV1";
import { SoterGuardV2 } from "./v2/SoterGuardV2";
import { SoterGuardV3 } from "./v3/SoterGuardV3";

/**
 * SoterAI community node.
 *
 * Versioned rather than edited in place. Version 3 keeps v2's behaviour and
 * replaces its panel: a Resource → Operation pair instead of one flat twelve-item
 * Action dropdown, the fields an operation needs, and one Options button for
 * everything else. Version 2 routes items across Safe and Flagged outputs and
 * replaces the Security Context JSON blob with guided fields; version 1 keeps the
 * single output and the JSON field it was published with. n8n stores
 * `typeVersion` on every saved node, so an existing workflow keeps loading the
 * version it was built on and behaves identically, while new nodes get v3.
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
      3: new SoterGuardV3(baseDescription),
    };

    super(nodeVersions, baseDescription);
  }
}
