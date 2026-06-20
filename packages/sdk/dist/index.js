"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CybersecurityGuard = exports.CyberRakshakGuard = exports.normalizeDecision = exports.createClient = exports.createCybersecurityGuardClient = exports.createAgentFirewallClient = exports.SoterClient = exports.GuardClient = exports.CyberRakshakClient = void 0;
exports.startAgentSession = startAgentSession;
exports.checkAgentAction = checkAgentAction;
exports.checkToolUse = checkToolUse;
exports.checkDataLeak = checkDataLeak;
exports.checkDataEgress = checkDataEgress;
exports.checkAgentOutput = checkAgentOutput;
exports.resolveAgentApproval = resolveAgentApproval;
exports.scanMcpTools = scanMcpTools;
exports.checkBrowserForm = checkBrowserForm;
exports.checkMemory = checkMemory;
exports.scoreRagDocument = scoreRagDocument;
exports.createCanary = createCanary;
exports.checkCanaryLeak = checkCanaryLeak;
exports.getAgentReplay = getAgentReplay;
exports.wrapTool = wrapTool;
exports.wrapMcpTool = wrapMcpTool;
exports.createOpenClawAdapter = createOpenClawAdapter;
exports.createLangChainToolWrapper = createLangChainToolWrapper;
exports.createExpressAgentMiddleware = createExpressAgentMiddleware;
exports.createGenericChatbotWrapper = createGenericChatbotWrapper;
exports.registerContextSource = registerContextSource;
exports.checkContextFlow = checkContextFlow;
exports.getLineageSession = getLineageSession;
exports.listLineageIncidents = listLineageIncidents;
exports.simulateBlastRadius = simulateBlastRadius;
exports.runBlastRadiusScenario = runBlastRadiusScenario;
exports.checkMemoryPoisoning = checkMemoryPoisoning;
exports.storeSafeMemory = storeSafeMemory;
exports.quarantineMemory = quarantineMemory;
exports.registerMcpServer = registerMcpServer;
exports.snapshotMcpTools = snapshotMcpTools;
exports.listMcpDrifts = listMcpDrifts;
exports.checkLegalBoundary = checkLegalBoundary;
exports.createNextAgentHandler = createNextAgentHandler;
__exportStar(require("./types"), exports);
__exportStar(require("./errors"), exports);
__exportStar(require("./agent-passport"), exports);
__exportStar(require("./agent-intent"), exports);
__exportStar(require("./tool-chain"), exports);
__exportStar(require("./escrow"), exports);
__exportStar(require("./dry-run"), exports);
__exportStar(require("./semantic-egress"), exports);
__exportStar(require("./evidence-vault"), exports);
__exportStar(require("./soter"), exports);
var client_1 = require("./client");
Object.defineProperty(exports, "CyberRakshakClient", { enumerable: true, get: function () { return client_1.CyberRakshakClient; } });
Object.defineProperty(exports, "GuardClient", { enumerable: true, get: function () { return client_1.GuardClient; } });
Object.defineProperty(exports, "SoterClient", { enumerable: true, get: function () { return client_1.SoterClient; } });
Object.defineProperty(exports, "createAgentFirewallClient", { enumerable: true, get: function () { return client_1.createAgentFirewallClient; } });
Object.defineProperty(exports, "createCybersecurityGuardClient", { enumerable: true, get: function () { return client_1.createCybersecurityGuardClient; } });
Object.defineProperty(exports, "createClient", { enumerable: true, get: function () { return client_1.createClient; } });
Object.defineProperty(exports, "normalizeDecision", { enumerable: true, get: function () { return client_1.normalizeDecision; } });
const client_2 = require("./client");
function startAgentSession(options, input) {
    return (0, client_2.createAgentFirewallClient)(options).startAgentSession(input);
}
function checkAgentAction(options, input) {
    return (0, client_2.createAgentFirewallClient)(options).checkAgentAction(input);
}
function checkToolUse(options, input) {
    return (0, client_2.createAgentFirewallClient)(options).checkToolUse(input);
}
function checkDataLeak(options, input) {
    return (0, client_2.createAgentFirewallClient)(options).checkDataLeak(input);
}
function checkDataEgress(options, input) {
    return (0, client_2.createAgentFirewallClient)(options).checkDataEgress(input);
}
function checkAgentOutput(options, input) {
    return (0, client_2.createAgentFirewallClient)(options).checkAgentOutput(input);
}
function resolveAgentApproval(options, input) {
    return (0, client_2.createAgentFirewallClient)(options).resolveAgentApproval(input);
}
function scanMcpTools(options, input) {
    return (0, client_2.createAgentFirewallClient)(options).scanMcpTools(input);
}
function checkBrowserForm(options, input) {
    return (0, client_2.createAgentFirewallClient)(options).checkBrowserForm(input);
}
function checkMemory(options, input) {
    return (0, client_2.createAgentFirewallClient)(options).checkMemory(input);
}
function scoreRagDocument(options, input) {
    return (0, client_2.createAgentFirewallClient)(options).scoreRagDocument(input);
}
function createCanary(options, input) {
    return (0, client_2.createAgentFirewallClient)(options).createCanary(input);
}
function checkCanaryLeak(options, input) {
    return (0, client_2.createAgentFirewallClient)(options).checkCanaryLeak(input);
}
function getAgentReplay(options, sessionId) {
    return (0, client_2.createAgentFirewallClient)(options).getAgentReplay(sessionId);
}
function wrapTool(options, context, executor) {
    return (0, client_2.createAgentFirewallClient)(options).wrapTool(context, executor);
}
function wrapMcpTool(options, toolName, executor, defaults = {}) {
    return (0, client_2.createAgentFirewallClient)(options).wrapMcpTool(toolName, executor, defaults);
}
function createOpenClawAdapter(options, adapterOptions) {
    return (0, client_2.createAgentFirewallClient)(options).createOpenClawAdapter(adapterOptions);
}
function createLangChainToolWrapper(options, toolName, executor, defaults = {}) {
    return (0, client_2.createAgentFirewallClient)(options).createLangChainToolWrapper(toolName, executor, defaults);
}
function createExpressAgentMiddleware(options) {
    return (0, client_2.createAgentFirewallClient)(options).createExpressAgentMiddleware();
}
function createGenericChatbotWrapper(options, wrapperOptions = {}) {
    return (0, client_2.createAgentFirewallClient)(options).createGenericChatbotWrapper(wrapperOptions);
}
function registerContextSource(options, input) {
    return (0, client_2.createAgentFirewallClient)(options).registerContextSource(input);
}
function checkContextFlow(options, input) {
    return (0, client_2.createAgentFirewallClient)(options).checkContextFlow(input);
}
function getLineageSession(options, sessionId) {
    return (0, client_2.createAgentFirewallClient)(options).getLineageSession(sessionId);
}
function listLineageIncidents(options, status) {
    return (0, client_2.createAgentFirewallClient)(options).listLineageIncidents(status);
}
function simulateBlastRadius(options, input) {
    return (0, client_2.createAgentFirewallClient)(options).simulateBlastRadius(input);
}
function runBlastRadiusScenario(options, input) {
    return (0, client_2.createAgentFirewallClient)(options).runBlastRadiusScenario(input);
}
function checkMemoryPoisoning(options, input) {
    return (0, client_2.createAgentFirewallClient)(options).checkMemoryPoisoning(input);
}
function storeSafeMemory(options, input) {
    return (0, client_2.createAgentFirewallClient)(options).storeSafeMemory(input);
}
function quarantineMemory(options, memoryRecordId) {
    return (0, client_2.createAgentFirewallClient)(options).quarantineMemory(memoryRecordId);
}
function registerMcpServer(options, input) {
    return (0, client_2.createAgentFirewallClient)(options).registerMcpServer(input);
}
function snapshotMcpTools(options, input) {
    return (0, client_2.createAgentFirewallClient)(options).snapshotMcpTools(input);
}
function listMcpDrifts(options, status) {
    return (0, client_2.createAgentFirewallClient)(options).listMcpDrifts(status);
}
function checkLegalBoundary(options, input) {
    return (0, client_2.createAgentFirewallClient)(options).checkLegalBoundary(input);
}
function createNextAgentHandler(options) {
    return (0, client_2.createAgentFirewallClient)(options).createNextAgentHandler();
}
/** @deprecated Use Soter for new integrations. */
class CyberRakshakGuard extends client_2.GuardClient {
    constructor(options) {
        super(options);
    }
}
exports.CyberRakshakGuard = CyberRakshakGuard;
/** @deprecated Use Soter for new integrations. */
class CybersecurityGuard extends client_2.GuardClient {
    constructor(options) {
        super(options);
    }
}
exports.CybersecurityGuard = CybersecurityGuard;
