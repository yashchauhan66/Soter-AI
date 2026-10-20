import { GatewayBoundary, GatewayPolicyError } from "../../../../apps/local-ai-broker/src/GatewayBoundary";
const original = GatewayBoundary.prototype.prepareRequest;
GatewayBoundary.prototype.prepareRequest = function (...args: Parameters<typeof original>) {
    const start = performance.now();
    try { const result = Reflect.apply(original, this, args); console.log("F20C_DIAGNOSTIC", JSON.stringify({ provider: args[0], result: "allowed", elapsedMs: performance.now() - start })); return result; }
    catch (e) { console.log("F20C_DIAGNOSTIC", JSON.stringify({ provider: args[0], result: e instanceof GatewayPolicyError ? e.code : "other", elapsedMs: performance.now() - start })); throw e; }
};
void import("../../../../packages/vscode-extension/src/__tests__/claudeConversationBudget.test");
