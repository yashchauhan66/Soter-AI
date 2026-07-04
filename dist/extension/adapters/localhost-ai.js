import { genericEditorAdapter } from "./generic-editor.js";
import { isLocalAIUrl } from "../packages/shared/src/ai-destinations.js";
export function localhostAIAdapter() { return { ...genericEditorAdapter(), name: "localhost-ai", matches: isLocalAIUrl }; }
