import type { IExecuteFunctions } from "n8n-workflow";

import { executeSoterGuard } from "../nodes/SoterGuard/shared/execute";

/**
 * The whole transport, faked.
 *
 * `helpers.httpRequest` is the only route the node has to the network, so
 * replacing it gives the suite two things a mocked HTTP client would not: every
 * request body is inspectable (which is how the `sourceIds` and fingerprint
 * assertions are possible), and a test that accidentally reaches the real API
 * cannot pass.
 */
export type Recorded = { path: string; body: Record<string, unknown> };
export type FakeResponse = { statusCode?: number; body?: unknown; headers?: Record<string, unknown> };

export type CtxOptions = {
  action: string;
  params?: Record<string, unknown>;
  respond?: (path: string, body: Record<string, unknown>) => FakeResponse;
  typeVersion?: number;
  continueOnFail?: boolean;
  items?: number;
  /** Set to fail credential resolution the way n8n does when none is selected. */
  credentials?: Record<string, unknown> | null;
  /** Throw instead of answering, for the transport-failure paths. */
  networkError?: string;
};

export function makeCtx(options: CtxOptions) {
  const calls: Recorded[] = [];
  const node = {
    id: "test-node",
    name: "SoterAI",
    type: "n8n-nodes-soterai.soterGuard",
    typeVersion: options.typeVersion ?? 2,
    position: [0, 0] as [number, number],
    parameters: { action: options.action },
  };
  const params: Record<string, unknown> = { action: options.action, ...options.params };

  const ctx = {
    getInputData: () => Array.from({ length: options.items ?? 1 }, () => ({ json: {} })),
    getNode: () => node,
    getCredentials: async () => {
      if (options.credentials === null) throw new Error("Node does not have any credentials set.");
      return options.credentials ?? { apiKey: "ck_test_key_0123456789abcdef", baseUrl: "https://guard.example" };
    },
    getNodeParameter: (name: string, _itemIndex: number, fallback?: unknown) =>
      Object.prototype.hasOwnProperty.call(params, name) ? params[name] : fallback,
    continueOnFail: () => options.continueOnFail === true,
    helpers: {
      httpRequest: async (request: { url: string; body: Record<string, unknown> }) => {
        const path = new URL(request.url).pathname;
        calls.push({ path, body: request.body });
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
  const outputs = await executeSoterGuard.call(ctx as unknown as IExecuteFunctions);
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
