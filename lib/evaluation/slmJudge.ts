/**
 * SLM-as-Judge — Core Evaluation Engine
 *
 * Evaluates LLM outputs using a configurable SLM (Small Language Model)
 * via an OpenAI-compatible API endpoint. Supports multiple evaluation
 * criteria with weighted scoring.
 *
 * Usage:
 *   const judge = new SlmJudge();
 *   const result = await judge.evaluate({
 *     projectId: "proj_123",
 *     promptText: "What is the capital of France?",
 *     responseText: "The capital of France is Paris.",
 *   });
 */

import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import {
  type EvaluationCriterion,
  type EvaluateInput,
  type EvaluationResult,
  type SlmProviderConfig,
  type CriterionScore,
  DEFAULT_SLM_CONFIG,
} from "./types";
import { EVALUATION_CRITERIA, calculateOverallScore, DEFAULT_EVALUATION_CRITERIA } from "./criteria";

export class SlmJudge {
  private config: SlmProviderConfig;

  constructor(config?: Partial<SlmProviderConfig>) {
    this.config = { ...DEFAULT_SLM_CONFIG, ...config };
  }

  /**
   * Evaluate a single response against one or more criteria.
   * Calls the configured SLM provider for each criterion and
   * aggregates the scores into an overall evaluation.
   */
  async evaluate(input: EvaluateInput): Promise<EvaluationResult> {
    const criteria = input.criteria ?? DEFAULT_EVALUATION_CRITERIA;
    const startedAt = Date.now();

    // Evaluate each criterion in parallel for speed
    const scorePromises = criteria.map((criterion) =>
      this.evaluateCriterion(criterion, input)
    );
    const scores = await Promise.all(scorePromises);

    const latencyMs = Date.now() - startedAt;
    const { overallScore, overallPassed } = calculateOverallScore(scores);

    const id = `eval_${randomUUID()}`;

    // Persist to database
    await this.persistEvaluation({
      id,
      projectId: input.projectId,
      promptText: input.promptText,
      responseText: input.responseText,
      contextText: input.contextText ?? null,
      scores,
      overallScore,
      overallPassed,
      modelUsed: this.config.model,
      latencyMs,
      rawResponse: null,
      createdAt: new Date(),
    });

    return {
      id,
      projectId: input.projectId,
      promptText: input.promptText,
      responseText: input.responseText,
      contextText: input.contextText ?? null,
      scores,
      overallScore,
      overallPassed,
      modelUsed: this.config.model,
      latencyMs,
      rawResponse: null,
      createdAt: new Date(),
    };
  }

  /**
   * Evaluate a single criterion by calling the SLM provider.
   */
  private async evaluateCriterion(
    criterion: EvaluationCriterion,
    input: EvaluateInput
  ): Promise<CriterionScore> {
    const definition = EVALUATION_CRITERIA[criterion];
    if (!definition) {
      return {
        criterion,
        score: 0,
        reason: `Unknown criterion: ${criterion}`,
        passed: false,
      };
    }

    try {
      const userPrompt = definition.userPromptTemplate
        .replace(/\{prompt\}/g, input.promptText)
        .replace(/\{response\}/g, input.responseText)
        .replace(
          /\{context\}/g,
          input.contextText
            ? `CONTEXT:\n"""\n${input.contextText}\n"""`
            : "No context provided."
        );

      const response = await this.callSlmProvider(
        definition.systemPrompt,
        userPrompt
      );

      const parsed = this.parseResponse(response, criterion);
      return {
        criterion,
        score: parsed.score,
        reason: parsed.reason,
        passed: parsed.score >= definition.passThreshold,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        criterion,
        score: 0,
        reason: `Evaluation failed: ${message}`,
        passed: false,
      };
    }
  }

  /**
   * Call the configured SLM provider with the given system and user prompts.
   */
  private async callSlmProvider(
    systemPrompt: string,
    userPrompt: string
  ): Promise<string> {
    const url = `${this.config.apiUrl.replace(/\/+$/, "")}/chat/completions`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.config.apiKey
          ? { Authorization: `Bearer ${this.config.apiKey}` }
          : {}),
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: this.config.maxTokens ?? 512,
        temperature: this.config.temperature ?? 0.1,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(this.config.timeoutMs ?? 15_000),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `SLM provider returned ${response.status}: ${body.slice(0, 200)}`
      );
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("SLM provider returned empty response");
    }

    return content;
  }

  /**
   * Parse the JSON response from the SLM provider into a score object.
   * Tries to extract score and reason, falling back to defaults on parse failure.
   */
  private parseResponse(
    raw: string,
    criterion: EvaluationCriterion
  ): { score: number; reason: string } {
    try {
      // Try to extract JSON from the response (handle markdown code blocks)
      const cleaned = raw
        .replace(/```json\s*/gi, "")
        .replace(/```\s*$/g, "")
        .trim();
      const parsed = JSON.parse(cleaned) as {
        score?: number;
        reason?: string;
      };

      const score =
        typeof parsed.score === "number"
          ? Math.max(0, Math.min(100, Math.round(parsed.score)))
          : 0;
      const reason =
        typeof parsed.reason === "string"
          ? parsed.reason
          : `Scored ${score}/100`;

      return { score, reason };
    } catch {
      // If parsing fails, try regex extraction
      const scoreMatch = raw.match(/"score":\s*(\d+)/i);
      const reasonMatch = raw.match(/"reason":\s*"([^"]+)"/i);
      const score = scoreMatch
        ? Math.max(0, Math.min(100, parseInt(scoreMatch[1], 10)))
        : 50;
      const reason = reasonMatch
        ? reasonMatch[1]
        : `Parsed score: ${score}/100`;

      return { score, reason };
    }
  }

  /**
   * Persist the evaluation result to the database.
   */
  private async persistEvaluation(result: EvaluationResult): Promise<void> {
    try {
      await db.$executeRaw`
        INSERT INTO "SlmEvaluation" (
          "id", "projectId", "promptText", "responseText", "contextText",
          "scoresJson", "overallScore", "overallPassed", "modelUsed",
          "latencyMs", "createdAt"
        )
        VALUES (
          ${result.id},
          ${result.projectId},
          ${result.promptText},
          ${result.responseText},
          ${result.contextText},
          ${JSON.stringify(result.scores)}::jsonb,
          ${result.overallScore},
          ${result.overallPassed},
          ${result.modelUsed},
          ${result.latencyMs},
          ${result.createdAt}
        )
      `;
    } catch (error) {
      console.error("[SlmJudge] Failed to persist evaluation:", error);
      // Don't throw — the evaluation result is still returned to the caller
    }
  }
}
