/**
 * MCP Gateway — Barrel exports
 */
export { MCPJsonRpcGateway, type GatewayDeps } from "./MCPJsonRpcGateway";
export { MCPServer, type MCPServerOptions } from "./MCPServer";
export { SessionManager, type SessionManagerOptions } from "./MCPSessionManager";
export { ApprovalManager, type ApprovalManagerOptions, type ApprovalScope } from "./MCPApprovalManager";
export { MCPResultInspector, type InspectionResult, type InspectionFinding, type ResultInspectorOptions } from "./MCPResultInspector";
export { mapGuardActionToEnforcement, mapEnforcementToGuardAction, buildEvidenceEnvelope, safeDiagnosticLog } from "./MCPGatewayAdapter";
export { DEFAULT_GATEWAY_CONFIG, defaultBlockedResult } from "./MCPGatewayConfig";
export type { MCPGatewayConfig } from "./MCPGatewayConfig";
export * from "./MCPJsonRpcTypes";
