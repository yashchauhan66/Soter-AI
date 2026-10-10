#!/usr/bin/env node
import path from "node:path";
import os from "node:os";
import { BrokerServer, DEFAULT_BROKER_PORT } from "./BrokerServer";
import { createBrokerCredentialLoader, BrokerCredentialError } from "./auth";

async function main(): Promise<void> {
    const storageDir = process.env.SOTERAI_BROKER_STORAGE ?? path.join(os.homedir(), ".soterai", "broker");
    const { token, controlToken } = await createBrokerCredentialLoader(undefined, process.env.SOTERAI_HARDEN_CREDENTIAL_STARTUP !== "0")(
        storageDir, { token: process.env.SOTERAI_BROKER_TOKEN, controlToken: process.env.SOTERAI_BROKER_CONTROL_TOKEN });
    const port = parsePort(process.env.SOTERAI_BROKER_PORT);
    const broker = new BrokerServer({
        token,
        controlToken,
        port,
        requireCanarySync: process.env.SOTERAI_REQUIRE_CANARY_SYNC === "1",
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
    console.error(JSON.stringify({ status: "failed", message: error instanceof BrokerCredentialError ? error.message
        : "Broker failed to start; check private storage, distinct auth credentials, port and provider configuration." }));
    process.exit(1);
});
