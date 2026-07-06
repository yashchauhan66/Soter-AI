#!/usr/bin/env node
import path from "node:path";
import os from "node:os";
import { BrokerServer, DEFAULT_BROKER_PORT } from "./BrokerServer";
import { loadOrCreateBrokerToken, persistBrokerToken } from "./auth";

async function main(): Promise<void> {
    const storageDir = process.env.SOTERAI_BROKER_STORAGE ?? path.join(os.homedir(), ".soterai", "broker");
    const suppliedToken = process.env.SOTERAI_BROKER_TOKEN;
    const token = suppliedToken ?? await loadOrCreateBrokerToken(storageDir);
    if (suppliedToken) await persistBrokerToken(storageDir, suppliedToken);
    const port = parsePort(process.env.SOTERAI_BROKER_PORT);
    const broker = new BrokerServer({
        token,
        port,
        openAIProviderUrl: process.env.SOTERAI_OPENAI_PROVIDER_URL,
        anthropicProviderUrl: process.env.SOTERAI_ANTHROPIC_PROVIDER_URL,
        providerApiKey: process.env.SOTERAI_PROVIDER_API_KEY,
        logger: (message, metadata) => console.log(JSON.stringify({ timestamp: new Date().toISOString(), message, ...metadata })),
    });
    const address = await broker.start();
    console.log(JSON.stringify({ status: "ready", url: address.url, localOnly: true, auth: "required", tokenStoredAt: path.join(storageDir, "auth-token") }));
    const shutdown = async () => { await broker.stop(); process.exit(0); };
    process.on("SIGINT", () => void shutdown());
    process.on("SIGTERM", () => void shutdown());
}

function parsePort(value: string | undefined): number {
    if (!value) return DEFAULT_BROKER_PORT;
    const port = Number(value);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("SOTERAI_BROKER_PORT must be between 1 and 65535");
    return port;
}

void main().catch((error: unknown) => {
    console.error(JSON.stringify({ status: "failed", message: error instanceof Error ? error.message : "Broker failed to start" }));
    process.exit(1);
});
