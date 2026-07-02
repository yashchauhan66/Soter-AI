import { genericEditorAdapter, type AiSiteAdapter } from "./generic-editor";
import { isLocalAIUrl } from "../../../../packages/shared/src/ai-destinations";
export function localhostAIAdapter(): AiSiteAdapter { return { ...genericEditorAdapter(), name: "localhost-ai", matches: isLocalAIUrl }; }
