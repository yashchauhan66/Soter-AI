import { randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, open, lstat } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { protectNewWindowsToken, validateWindowsPrivatePath } from "./WindowsAcl";

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

type TokenFile = "auth-token" | "control-auth-token";

export interface TokenPermissions {
    validate: (target: string, parent?: boolean) => Promise<void>;
    protectNew: (target: string) => Promise<void>;
}
const windowsPermissions: TokenPermissions = { validate: validateWindowsPrivatePath, protectNew: protectNewWindowsToken };

async function privateDirectory(storageDir: string, permissions: TokenPermissions): Promise<void> {
    await mkdir(storageDir, { recursive: true, mode: 0o700 });
    const info = await lstat(storageDir);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("Unsafe broker storage directory");
    if (process.platform !== "win32" && ((info.mode & 0o077) !== 0 || info.uid !== process.getuid?.())) {
        throw new Error("Broker storage directory must be private and owned by the current user");
    }
    if (process.platform === "win32") {
        await permissions.validate(storageDir);
        await permissions.validate(path.dirname(storageDir), true);
    }
}

function validateToken(token: string): void {
    if (token.length < 32 || token.length > 512 || !/^[\x21-\x7e]+$/.test(token)) throw new Error("Invalid broker token file");
}

/** No-follow, bounded read. Corruption and permission errors never rotate auth silently. */
async function readToken(tokenPath: string, permissions: TokenPermissions): Promise<string> {
    const before = await lstat(tokenPath, { bigint: true });
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== BigInt(1)) throw new Error("Unsafe broker token file");
    if (process.platform === "win32") await permissions.validate(tokenPath);
    const file = await open(tokenPath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    try {
        const info = await file.stat({ bigint: true });
        // Windows lstat can report dev=0 while fstat reports the actual volume ID.
        const deviceChanged = info.dev !== before.dev && !(process.platform === "win32" && before.dev === BigInt(0));
        if (!info.isFile() || info.nlink !== BigInt(1) || info.ino !== before.ino || deviceChanged || info.size > BigInt(512)) throw new Error("Unsafe broker token file");
        if (process.platform !== "win32" && ((info.mode & BigInt(0o077)) !== BigInt(0) || info.uid !== BigInt(process.getuid!()))) throw new Error("Broker token file must be private");
        if (process.platform === "win32") await permissions.validate(tokenPath);
        const buffer = Buffer.alloc(513);
        const { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
        if (bytesRead > 512) throw new Error("Invalid broker token file");
        const token = new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, bytesRead)).trim();
        validateToken(token);
        return token;
    } finally { await file.close(); }
}

/** Load or exclusively create auth; never overwrite a link, invalid file or unreadable file. */
export function createTokenStorage(permissions: TokenPermissions) {
return async function load(storageDir: string, name: TokenFile = "auth-token"): Promise<string> {
    await privateDirectory(storageDir, permissions);
    const tokenPath = path.join(storageDir, name);
    try { return await readToken(tokenPath, permissions); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    const token = generateBrokerToken();
    try {
        const file = await open(tokenPath, "wx", 0o600);
        try {
            if (process.platform === "win32") await permissions.protectNew(tokenPath);
            await file.writeFile(token, "utf8");
        } finally { await file.close(); }
        return token;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "EEXIST") return readToken(tokenPath, permissions);
        throw error;
    }
};
}
export const loadOrCreateBrokerToken = createTokenStorage(windowsPermissions);

export class BrokerCredentialError extends Error {}

/** Missing/unsafe controller storage cannot downgrade to the ordinary client credential. */
export function createBrokerCredentialLoader(permissions: TokenPermissions = windowsPermissions, enabled = true) {
    const load = createTokenStorage(permissions);
    return async (storageDir: string, supplied: { token?: string; controlToken?: string } = {}): Promise<{ token: string; controlToken: string }> => {
        if (!enabled) throw new BrokerCredentialError("Broker startup unavailable while credential hardening is disabled");
        const token = supplied.token ?? await load(storageDir, "auth-token");
        let controlToken: string;
        try { controlToken = supplied.controlToken ?? await load(storageDir, "control-auth-token"); }
        catch { throw new BrokerCredentialError("Controller credential unavailable; broker startup denied. Client credentials are never a fallback."); }
        if (token === controlToken) throw new BrokerCredentialError("Broker client and controller credentials must be distinct");
        return { token, controlToken };
    };
}
