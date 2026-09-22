import type { IExecuteFunctions } from "n8n-workflow";

import { executeSoterGuard } from "../nodes/SoterGuard/shared/execute";
import { withV3ParameterLayout } from "../nodes/SoterGuard/shared/parameterLayout";

/**
 * The whole transport, faked.
 *
 * `helpers.httpRequest` is the only route the node has to the network, so
 * replacing it gives the suite two things a mocked HTTP client would not: every
 * request body is inspectable (which is how the `sourceIds` and fingerprint
 * assertions are possible), and a test that accidentally reaches the real API
 * cannot pass.
 */
export type Recorded = { path: string; body: Record<string, unknown>; headers: Record<string, unknown> };
export type FakeResponse = { statusCode?: number; body?: unknown; headers?: Record<string, unknown> };

export type CtxOptions = {
  action: string;
  params?: Record<string, unknown>;
  respond?: (path: string, body: Record<string, unknown>) => FakeResponse;
  typeVersion?: number;
  /**
   * Which panel stored the parameters. "v2" (the default) reads a flat map keyed
   * by the parameter names execute.ts asks for. "v3" reads the same map through
   * `withV3ParameterLayout`, exactly as the SoterGuardV3 class does at runtime, so
   * a v3 test exercises the real name-remapping wrapper rather than a fake of it.
   * A v3 test therefore keys its params the way the v3 panel stores them:
   * `operation` in place of `action`, panel fields flat, and everything else
   * under an `options` object.
   */
  layout?: "v2" | "v3";
  continueOnFail?: boolean;
  items?: number;
  /** Set to fail credential resolution the way n8n does when none is selected. */
  credentials?: Record<string, unknown> | null;
  /** Throw instead of answering, for the transport-failure paths. */
  networkError?: string;
  /**
   * Per-item parameter overrides, keyed by item index. n8n resolves an
   * expression like `{{ $json.message }}` to a different value for each item;
   * this fake reads fixed params, so a test that needs a genuinely mixed batch
   * (a benign message, an attack, and a PII string in one execution) supplies
   * the per-item values here. Absent keys fall back to the shared `params`, so
   * every existing test is unaffected.
   */
  perItem?: Record<number, Record<string, unknown>>;
};

export function makeCtx(options: CtxOptions) {
  const calls: Recorded[] = [];
  const v3 = options.layout === "v3";
  // The v3 panel names the selector `operation`; v1/v2 name it `action`. The
  // saved `parameters` blob carries the same key, which the empty-batch fallback
  // in execute.ts reads directly.
  const selector = v3 ? "operation" : "action";
  const node = {
    id: "test-node",
    name: "SoterAI",
    type: "n8n-nodes-soterai.soterGuard",
    typeVersion: options.typeVersion ?? (v3 ? 3 : 2),
    position: [0, 0] as [number, number],
    parameters: { [selector]: options.action },
  };
  const params: Record<string, unknown> = { [selector]: options.action, ...options.params };

  const ctx = {
    getInputData: () => Array.from({ length: options.items ?? 1 }, () => ({ json: {} })),
    getNode: () => node,
    getCredentials: async () => {
      if (options.credentials === null) throw new Error("Node does not have any credentials set.");
      return options.credentials ?? { apiKey: "ck_test_key_0123456789abcdef", baseUrl: "https://guard.example" };
    },
    getNodeParameter: (name: string, itemIndex: number, fallback?: unknown) => {
      const override = options.perItem?.[itemIndex];
      if (override && Object.prototype.hasOwnProperty.call(override, name)) return override[name];
      return Object.prototype.hasOwnProperty.call(params, name) ? params[name] : fallback;
    },
    continueOnFail: () => options.continueOnFail === true,
    helpers: {
      httpRequest: async (request: { url: string; body: Record<string, unknown>; headers?: Record<string, unknown> }) => {
        const path = new URL(request.url).pathname;
        calls.push({ path, body: request.body, headers: request.headers ?? {} });
        if (options.networkError) throw new Error(options.networkError);
        const response = options.respond ? options.respond(path, request.body) : { body: {} };
        return {
          statusCode: response.statusCode ?? 200,
          body: response.body ?? {},
          headers: response.headers ?? {},
        };
      },
    },
  };

  return { ctx, calls };
}

export async function run(options: CtxOptions) {
  const { ctx, calls } = makeCtx(options);
  // A v3 node runs the engine through the name-remapping wrapper, so the test
  // does too — this is the exact call SoterGuardV3.execute makes.
  const target = options.layout === "v3" ? withV3ParameterLayout(ctx as unknown as IExecuteFunctions) : ctx;
  const outputs = await executeSoterGuard.call(target as unknown as IExecuteFunctions);
  return { outputs, calls, safe: outputs[0] ?? [], flagged: outputs[1] ?? [] };
}

export const cleanInputGuard = {
  allowed: true,
  action: "ALLOW",
  riskScore: 0,
  riskTypes: ["LOW_RISK"],
  reason: "No risk detected.",
  findings: [],
};

/** The layer results of a universalGuard output, by layer name. */
export function layer(result: Record<string, unknown>, name: string): Record<string, unknown> | undefined {
  return (result.checks as Array<Record<string, unknown>>).find((entry) => entry.layer === name);
}
