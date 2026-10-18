#!/usr/bin/env node
import path from "node:path";
import os from "node:os";
import { BrokerServer, DEFAULT_BROKER_PORT } from "./BrokerServer";
import { createBrokerCredentialLoader, BrokerCredentialError } from "./auth";

async function main(): Promise<void> {
    const ownerSession = process.env.SOTERAI_BROKER_SESSION;
    if (ownerSession !== undefined && (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(ownerSession)
        || !process.send || !process.connected || process.env.SOTERAI_BROKER_PORT !== "0"
        || !process.env.SOTERAI_BROKER_TOKEN || !process.env.SOTERAI_BROKER_CONTROL_TOKEN)) throw new Error("Owned startup unavailable");
    let requestedStop = false, stopOwned: (() => void) | undefined;
    if (ownerSession) {
        process.on("message", (value: unknown) => {
            if (!value || typeof value !== "object" || Array.isArray(value)) return;
            const row = value as Record<string, unknown>;
            if (Object.keys(row).sort().join(",") === "session,type,version" && row.type === "SOTERAI_BROKER_STOP" && row.version === 1 && row.session === ownerSession) { requestedStop = true; stopOwned?.(); }
        });
        process.once("disconnect", () => { requestedStop = true; stopOwned?.(); });
    }
    const storageDir = process.env.SOTERAI_BROKER_STORAGE ?? path.join(os.homedir(), ".soterai", "broker");
    const { token, controlToken } = await createBrokerCredentialLoader(undefined, process.env.SOTERAI_HARDEN_CREDENTIAL_STARTUP !== "0")(
        storageDir, { token: process.env.SOTERAI_BROKER_TOKEN, controlToken: process.env.SOTERAI_BROKER_CONTROL_TOKEN });
    const port = ownerSession ? 0 : parsePort(process.env.SOTERAI_BROKER_PORT);
    if (requestedStop || ownerSession && !process.connected) { if (process.connected) process.disconnect(); return; }
    const broker = new BrokerServer({
        token,
        controlToken,
        port,
        ownerSession,
        jsonBodies: process.env.SOTERAI_GATEWAY_JSON_BODIES !== "0",
        gzipBodies: process.env.SOTERAI_GATEWAY_GZIP_BODIES !== "0",
        brotliBodies: process.env.SOTERAI_GATEWAY_BROTLI_BODIES !== "0",
        deflateBodies: process.env.SOTERAI_GATEWAY_DEFLATE_BODIES !== "0",
        chunkedBodies: process.env.SOTERAI_GATEWAY_CHUNKED_BODIES !== "0",
        framedBodies: process.env.SOTERAI_GATEWAY_FRAMED_BODIES !== "0",
        multipartBodies: process.env.SOTERAI_GATEWAY_MULTIPART_BODIES !== "0",
        base64Bodies: process.env.SOTERAI_GATEWAY_BASE64_BODIES !== "0",
        requireCanarySync: process.env.SOTERAI_REQUIRE_CANARY_SYNC === "1",
        openAIProviderUrl: process.env.SOTERAI_OPENAI_PROVIDER_URL,
        anthropicProviderUrl: process.env.SOTERAI_ANTHROPIC_PROVIDER_URL,
        providerApiKey: process.env.SOTERAI_PROVIDER_API_KEY,
        logger: (message, metadata) => console.log(JSON.stringify({ timestamp: new Date().toISOString(), message, ...metadata })),
    });
    let shutdownPromise: Promise<void> | undefined;
    const shutdown = (): Promise<void> => {
        requestedStop = true;
        return shutdownPromise ??= broker.stop().then(() => { if (process.connected) process.disconnect(); });
    };
    stopOwned = () => { void shutdown(); };
    process.on("SIGINT", () => void shutdown());
    process.on("SIGTERM", () => void shutdown());
    const address = await broker.start();
    if (requestedStop) { await broker.stop(); if (process.connected) process.disconnect(); return; }
    if (ownerSession) {
        try { process.send!({ type: "SOTERAI_BROKER_READY", version: 1, session: ownerSession, port: address.port }, (error: Error | null) => { if (error) void shutdown(); }); }
        catch { await shutdown(); }
    }
    else console.log(JSON.stringify({ status: "ready", url: address.url, localOnly: true, auth: "required", tokenStoredAt: path.join(storageDir, "auth-token") }));
}

function parsePort(value: string | undefined): number {
    if (!value) return DEFAULT_BROKER_PORT;
    const port = Number(value);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("SOTERAI_BROKER_PORT must be between 1 and 65535");
    return port;
}

void main().catch((error: unknown) => {
    console.error(JSON.stringify({ status: "failed", message: error instanceof BrokerCredentialError ? error.message
        : "Broker failed to start; check private storage, distinct auth credentials, port and provider configuration." }));
    process.exitCode = 1;
    if (process.connected) process.disconnect();
});
