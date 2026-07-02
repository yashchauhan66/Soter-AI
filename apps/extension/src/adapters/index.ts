import { boltAdapter } from "./bolt";
import { chatgptAdapter } from "./chatgpt";
import { claudeAdapter } from "./claude";
import { codesandboxAdapter } from "./codesandbox";
import { geminiAdapter } from "./gemini";
import { githubCodespacesAdapter } from "./github-codespaces";
import { genericAIChatAdapter } from "./generic-ai-chat";
import { localhostAIAdapter } from "./localhost-ai";
import { lovableAdapter } from "./lovable";
import { openWebUIAdapter } from "./openwebui";
import { perplexityAdapter } from "./perplexity";
import { replitAdapter } from "./replit";
import { stackblitzAdapter } from "./stackblitz";
import { v0Adapter } from "./v0";

export const destinationAdapters = () => [
  chatgptAdapter(), claudeAdapter(), geminiAdapter(), perplexityAdapter(), replitAdapter(), stackblitzAdapter(),
  codesandboxAdapter(), githubCodespacesAdapter(), boltAdapter(), v0Adapter(), lovableAdapter(), openWebUIAdapter(),
  localhostAIAdapter(), genericAIChatAdapter(),
];
export * from "./generic-editor";
