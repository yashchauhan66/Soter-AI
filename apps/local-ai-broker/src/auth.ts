import { randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile, chmod } from "node:fs/promises";
import path from "node:path";

export function generateBrokerToken(): string {
    return randomBytes(32).toString("base64url");
}

export function tokenMatches(actual: string | undefined, expected: string): boolean {
    if (!actual) return false;
    const prefix = "Bearer ";
    if (!actual.startsWith(prefix)) return false;
    const supplied = Buffer.from(actual.slice(prefix.length));
    const wanted = Buffer.from(expected);
    return supplied.length === wanted.length && timingSafeEqual(supplied, wanted);
}

/** Load or create a local token file. The token itself is never logged. */
export async function loadOrCreateBrokerToken(storageDir: string): Promise<string> {
    await mkdir(storageDir, { recursive: true });
    const tokenPath = path.join(storageDir, "auth-token");
    try {
        const token = (await readFile(tokenPath, "utf8")).trim();
        if (token.length >= 32) return token;
    } catch {
        // First start: create below.
    }
    const token = generateBrokerToken();
    await writeFile(tokenPath, token, { encoding: "utf8", mode: 0o600 });
    try { await chmod(tokenPath, 0o600); } catch { /* Windows ACLs are inherited. */ }
    return token;
}

/** Persist a token supplied by a trusted local controller (for example VS Code SecretStorage). */
export async function persistBrokerToken(storageDir: string, token: string): Promise<void> {
    if (token.length < 32) throw new Error("Broker token must be at least 32 characters");
    await mkdir(storageDir, { recursive: true });
    const tokenPath = path.join(storageDir, "auth-token");
    await writeFile(tokenPath, token, { encoding: "utf8", mode: 0o600 });
    try { await chmod(tokenPath, 0o600); } catch { /* Windows ACLs are inherited. */ }
}
