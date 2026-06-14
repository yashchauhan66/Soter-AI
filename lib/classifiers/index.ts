import { MultilingualClassifier } from "./multilingual";
import { RuleBasedFallbackClassifier } from "./ruleBasedFallback";
import { SemanticPromptInjectionClassifier } from "./semanticPromptInjection";
import type { ClassifierResult } from "./types";

const enabled = (name: string) => process.env[name]?.toLowerCase() === "true";

export async function classifyPrompt(text: string): Promise<ClassifierResult[]> {
  const fallback = new RuleBasedFallbackClassifier();
  const results: ClassifierResult[] = [await fallback.classify(text)];
  if (enabled("ENABLE_SEMANTIC_DETECTORS")) {
    try { results.push(await new SemanticPromptInjectionClassifier().classify(text)); } catch { /* rule result remains active */ }
  }
  if (enabled("ENABLE_MULTILINGUAL_DETECTORS") && enabled("ENABLE_HINDI_HINGLISH_DETECTION")) {
    try { results.push(await new MultilingualClassifier().classify(text)); } catch { /* rule result remains active */ }
  }
  return results;
}

export * from "./types";
export * from "./ruleBasedFallback";
export * from "./semanticPromptInjection";
export * from "./multilingual";
