import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import type { BrokerServer, BrokerServerOptions } from "./BrokerServer";
import type { GatewayPolicy } from "./GatewayPolicy";
/** Actual finite loopback transport, current private snapshot plus one synthetic value. */
export async function gatewaySelfTest(policy: GatewayPolicy, build: (options: BrokerServerOptions) => BrokerServer): Promise<Record<string, unknown>> {
    const secret = "synthetic_selftest_registered_value_f16";
    return policy.withSynthetic(secret, async boundary => {
        let received = 0, outputProbe = false;
        const provider = createServer((req, res) => { req.resume();req.once("end", () => { received++;res.setHeader("content-type", "application/json");res.end(JSON.stringify({ choices: [{ message: { content: outputProbe ? secret : "Public selftest output" } }] })); }); });
        await new Promise<void>(done => provider.listen(0, "127.0.0.1", done));
        const address = provider.address();if (!address || typeof address === "string") throw Error("Selftest unavailable");
        const token = randomBytes(32).toString("base64url"), control = randomBytes(32).toString("base64url"), target = `http://127.0.0.1:${address.port}`;
        const options: BrokerServerOptions = { token, controlToken: control, port: 0, gatewayPolicy: true, gatewayBoundary: boundary, gatewayGuard: async () => { try { await policy.fresh();return true; } catch { return false; } }, providerApiKey: "synthetic-selftest-provider-f16", openAIProviderUrl: target };
        const broker = build(options), checks: Array<{ id: string; status: "PASS" | "FAIL" }> = [];
        const check = async (id: string, run: () => Promise<boolean>) => { let passed = false;try { passed = await run(); } catch { /* No error/input details in report. */ }checks.push({ id, status: passed ? "PASS" : "FAIL" }); };
        const route = "/v1/ai/openai-compatible/chat/completions", chat = (content: string) => ({ model: "selftest", messages: [{ role: "user", content }] });
        let disabled: BrokerServer | undefined;
        try {
            const { url } = await broker.start();
            const post = async (body: unknown, headers = {}) => { const response = await fetch(url + route, { method: "POST", headers: { authorization: "Bearer " + token, "content-type": "application/json", ...headers }, body: JSON.stringify(body) });const text = await response.text();return { status: response.status, text }; };
            await check("public_receiver_positive", async () => (await post(chat("Public selftest input"))).status === 200 && received === 1);
            await check("registered_split_withheld", async () => { const before = received, result = await post({ messages: [{ role: "user", content: secret.slice(0, 12) }, { role: "assistant", content: secret.slice(12) }] });return result.status >= 400 && received === before; });
            await check("registered_encoding_withheld", async () => { const before = received, result = await post(chat(Buffer.from(secret).toString("base64")));return result.status >= 400 && received === before; });
            await check("unknown_profile_withheld", async () => { const before = received, result = await post(chat("Public selftest input"), { "x-soterai-tool": "unknown" });return result.status >= 400 && received === before; });
            await check("provider_output_withheld", async () => { const before = received;outputProbe = true;try { const result = await post(chat("Public output probe"));return received === before + 1 && result.status === 422 && !result.text.includes(secret); } finally { outputProbe = false; } });
            await check("disabled_routing_withheld", async () => { disabled = build({ ...options, gatewayPolicy: false, gatewayBoundary: undefined });const { url: off } = await disabled.start(), before = received;const response = await fetch(off + route, { method: "POST", headers: { authorization: "Bearer " + token, "content-type": "application/json" }, body: JSON.stringify(chat("Public selftest input")) });await response.arrayBuffer();return response.status === 503 && received === before; });
        } finally { await disabled?.stop();await broker.stop();await new Promise<void>(done => { provider.close(() => done());provider.closeIdleConnections(); }); }
        return { status: checks.length === 6 && checks.every(row => row.status === "PASS") ? "PASS" : "FAIL", version: 1, checks, scope: "Current private snapshot with synthetic registration; actual isolated loopback collector and broker transport only", independence: "LOW", verifiedAt: new Date().toISOString() };
    });
}
