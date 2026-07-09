/**
 * @soterai/ide-common
 *
 * Shared TypeScript helpers for Node-capable SoterAI IDE adapters and the CLI:
 * an authenticated, loopback-only Local AI Broker client, token resolution
 * that never logs the secret, adapter capability profiles, and test fixtures.
 * Re-exports the protocol so adapters need a single import.
 */

export * from "@soterai/ide-protocol";
export * from "./BrokerClient";
export * from "./token";
export * from "./featureFlags";
export * from "./fixtures";

export const IDE_COMMON_VERSION = "0.1.0" as const;
