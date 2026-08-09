/**
 * SoterAI Zapier App — main entry point.
 *
 * Registers authentication and all "Create" actions so Zapier
 * can discover and execute them.
 *
 * The 12 actions here are the same 12 operations the n8n node and the Make app
 * expose. That parity is deliberate: a customer should pick a platform on
 * workflow ergonomics, not on which one happens to carry the guard they need.
 */

import authentication from "./authentication";
import {
  inputGuard,
  outputGuard,
  piiRedactor,
  ragScanner,
} from "./creates/guardActions";
import {
  analyzeText,
  streamingGuard,
  universalGuard,
  workflowAudit,
} from "./creates/analysisActions";
import {
  agentActionCheck,
  agentDataCheck,
  agentOutputCheck,
  startAgentSession,
} from "./creates/agentActions";

const App = {
  // Resolved from the *compiled* dist/index.js, so "../" is the package root.
  version: require("../package.json").version,
  platformVersion: require("zapier-platform-core").version,
  flags: {
    cleanInputData: false,
  },
  authentication,

  creates: {
    [inputGuard.key]: inputGuard,
    [outputGuard.key]: outputGuard,
    [piiRedactor.key]: piiRedactor,
    [ragScanner.key]: ragScanner,
    [analyzeText.key]: analyzeText,
    [streamingGuard.key]: streamingGuard,
    [universalGuard.key]: universalGuard,
    [workflowAudit.key]: workflowAudit,
    [startAgentSession.key]: startAgentSession,
    [agentActionCheck.key]: agentActionCheck,
    [agentDataCheck.key]: agentDataCheck,
    [agentOutputCheck.key]: agentOutputCheck,
  },
};

export = App;
