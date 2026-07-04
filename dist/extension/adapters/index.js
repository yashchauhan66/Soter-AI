import { boltAdapter } from "./bolt.js";
import { chatgptAdapter } from "./chatgpt.js";
import { claudeAdapter } from "./claude.js";
import { codesandboxAdapter } from "./codesandbox.js";
import { geminiAdapter } from "./gemini.js";
import { githubCodespacesAdapter } from "./github-codespaces.js";
import { genericAIChatAdapter } from "./generic-ai-chat.js";
import { localhostAIAdapter } from "./localhost-ai.js";
import { lovableAdapter } from "./lovable.js";
import { openWebUIAdapter } from "./openwebui.js";
import { perplexityAdapter } from "./perplexity.js";
import { replitAdapter } from "./replit.js";
import { stackblitzAdapter } from "./stackblitz.js";
import { v0Adapter } from "./v0.js";
export const destinationAdapters = () => [
    chatgptAdapter(), claudeAdapter(), geminiAdapter(), perplexityAdapter(), replitAdapter(), stackblitzAdapter(),
    codesandboxAdapter(), githubCodespacesAdapter(), boltAdapter(), v0Adapter(), lovableAdapter(), openWebUIAdapter(),
    localhostAIAdapter(), genericAIChatAdapter(),
];
export * from "./generic-editor.js";
