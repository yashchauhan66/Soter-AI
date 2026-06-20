/**
 * SLM-as-Judge Evaluation Types
 *
 * Defines the core types for evaluating LLM outputs using
 * Small Language Models as judges — a cost-effective alternative
 * to Galileo's approach, supporting OpenAI-compatible APIs.
 */

/** Evaluation criteria dimensions */
export type EvaluationCriterion =
  | "factuality"
  | "hallucination"
  | "context_adherence"
  | "relevance"
  | "safety"
  | "tone"
  | "completeness"
  | "conciseness"
  | "coherence";

/** Score range for a single criterion */
export type CriterionScore = {
  criterion: EvaluationCriterion;
  score: number; // 0–100
  reason: string;
  passed: boolean;
};

/** Overall evaluation result */
export interface EvaluationResult {
  id: string;
  projectId: string;
  promptText: string;
  responseText: string;
  contextText?: string | null;
  scores: CriterionScore[];
  overallScore: number;
  overallPassed: boolean;
  modelUsed: string;
  latencyMs: number;
  rawResponse?: string | null;
  createdAt: Date;
}

/** SLM provider configuration */
export interface SlmProviderConfig {
  /** OpenAI-compatible API endpoint */
  apiUrl: string;
  /** Model name to use for evaluation */
  model: string;
  /** API key for the provider */
  apiKey?: string;
  /** Maximum tokens for evaluation response */
  maxTokens?: number;
  /** Temperature for evaluation (lower = more deterministic) */
  temperature?: number;
  /** Timeout in milliseconds */
  timeoutMs?: number;
}

/** Input for running an evaluation */
export interface EvaluateInput {
  projectId: string;
  promptText: string;
  responseText: string;
  contextText?: string;
  criteria?: EvaluationCriterion[];
}

/** Default SLM provider configuration */
export const DEFAULT_SLM_CONFIG: SlmProviderConfig = {
  apiUrl: process.env.SLM_API_URL ?? "https://api.openai.com/v1",
  model: process.env.SLM_MODEL ?? "gpt-4o-mini",
  apiKey: process.env.SLM_API_KEY,
  maxTokens: 512,
  temperature: 0.1,
  timeoutMs: 15_000,
};

/** Mapping of provider env vars to config */
export const SLM_ENV_VARS = {
  SLM_API_URL: "SLM_API_URL",
  SLM_API_KEY: "SLM_API_KEY",
  SLM_MODEL: "SLM_MODEL",
} as const;
