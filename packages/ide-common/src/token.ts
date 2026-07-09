import { homedir } from "node:os";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { BROKER_TOKEN_RELATIVE_PATH } from "@soterai/ide-protocol";

/** Absolute path to the broker's local token file for the current user. */
export function brokerTokenPath(storageDir?: string): string {
    if (storageDir) return path.join(storageDir, "auth-token");
    return path.join(homedir(), ...BROKER_TOKEN_RELATIVE_PATH);
}

export interface TokenResolution {
    token: string;
    /** Where the token came from, for honest diagnostics — never the value. */
    source: "env" | "file" | "explicit";
}

/**
 * Resolve the broker bearer token without ever logging it. Priority:
 *   1. explicit argument (e.g. a host secret store)
 *   2. SOTERAI_BROKER_TOKEN env var
 *   3. the local token file written by the broker on first start
 *
 * Throws a message that names the file but never prints the token.
 */
export async function resolveBrokerToken(explicit?: string, storageDir?: string): Promise<TokenResolution> {
    if (explicit && explicit.trim().length >= 32) {
        return { token: explicit.trim(), source: "explicit" };
    }
    const fromEnv = process.env.SOTERAI_BROKER_TOKEN?.trim();
    if (fromEnv && fromEnv.length >= 32) {
        return { token: fromEnv, source: "env" };
    }
    const file = brokerTokenPath(storageDir);
    try {
        const contents = (await readFile(file, "utf8")).trim();
        if (contents.length >= 32) return { token: contents, source: "file" };
        throw new Error("short");
    } catch {
        throw new Error(
            `No Local AI Broker token found. Start the broker (soterai broker start) or set ` +
                `SOTERAI_BROKER_TOKEN. Expected token file: ${file}`,
        );
    }
}
