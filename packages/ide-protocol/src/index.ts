/**
 * @soterai/ide-protocol
 *
 * The shared, dependency-free contract every SoterAI IDE adapter and the CLI
 * agree on: command names, feature flags, the Local AI Broker HTTP contract,
 * and policy/memory/approval/telemetry schemas. Detector and policy logic
 * live in @soterai/guard-core and the Local AI Broker, never here.
 */

export * from "./commands";
export * from "./broker";
export * from "./schemas";

export const IDE_PROTOCOL_VERSION = "0.1.0" as const;
