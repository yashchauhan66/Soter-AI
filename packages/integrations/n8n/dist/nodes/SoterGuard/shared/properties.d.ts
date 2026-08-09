import type { INodeProperties } from "n8n-workflow";
/**
 * Shared property list for every SoterAI node version.
 *
 * Version-specific fields are gated with the reserved `@version` key in
 * `displayOptions` rather than by keeping two divergent property arrays. That
 * matters for a security node: one array means a field cannot accidentally exist
 * on one version and be missing on the other, and the execute path reads the
 * same parameter names either way.
 *
 * The rule for `@version`:
 *   [1]    -> only the original single-output node
 *   [2]    -> only the branching node
 *   absent -> both
 */
export declare const soterGuardProperties: INodeProperties[];
