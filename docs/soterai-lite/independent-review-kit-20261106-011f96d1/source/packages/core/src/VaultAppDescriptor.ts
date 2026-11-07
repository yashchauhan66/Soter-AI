import * as path from "node:path";
import { isPathWithin } from "./pathContainment";

export const VAULT_RUNTIME_LIMITS = Object.freeze({ maxArgs: 16, maxArgBytes: 1024, maxArgumentBytes: 8192,
    maxSelections: 32, maxDescriptors: 16, maxJobs: 4, maxRuntimeMs: 300000, stopGraceMs: 1000, maxDescriptorBytes: 32768 });
export interface VaultAppDescriptor {
    readonly schemaVersion: 1; readonly id: string; readonly root: string; readonly program: string; readonly cwd: string;
    readonly source: string; readonly programDigest: string; readonly args: readonly string[];
    readonly selections: readonly Readonly<{ name: string; placeholder: string }>[];
}
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const CONTROLS = /[\x00-\x1f\x7f-\x9f]/u;
const RESERVED = /^(?:PATH|PATHEXT|HOME|USERPROFILE|APPDATA|LOCALAPPDATA|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|TMPDIR|BASH_ENV|ENV|ZDOTDIR|PSMODULEPATH|CLASSPATH|HTTP_PROXY|HTTPS_PROXY|ALL_PROXY|NO_PROXY)$|^(?:NODE_|ELECTRON_|LD_|DYLD_|PYTHON|RUBY|PERL|JAVA|JDK|SOTERAI_)/i;
export function vaultEnvironmentNameAllowed(name: string): boolean {
    return typeof name === "string" && /^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(name) && !RESERVED.test(name);
}
function record(value: unknown, keys: readonly string[]): Record<string, unknown> {
    if (!value || typeof value !== "object" || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new Error();
    const descriptors = Object.getOwnPropertyDescriptors(value), own = Reflect.ownKeys(descriptors);
    if (own.length !== keys.length || own.some(key => typeof key !== "string" || !keys.includes(key)
        || !Object.hasOwn(descriptors[key], "value") || !descriptors[key].enumerable)) throw new Error();
    return Object.fromEntries(keys.map(key => [key, descriptors[key].value]));
}
function array(value: unknown, max: number): unknown[] {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > max) throw new Error();
    const fields = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(fields);
    if (keys.length !== value.length + 1) throw new Error();
    const result: unknown[] = [];
    for (let i = 0; i < value.length; i++) {
        const field = fields[String(i)]; if (!field || !Object.hasOwn(field, "value") || !field.enumerable) throw new Error(); result.push(field.value);
    }
    return result;
}
function text(value: unknown, max: number): string {
    if (typeof value !== "string" || value.length > max || CONTROLS.test(value) || Buffer.from(value, "utf8").toString("utf8") !== value) throw new Error();
    return value;
}
function localPath(value: unknown): string {
    const result = text(value, 4096);
    if (!path.isAbsolute(result) || result.startsWith("\\\\") || result.startsWith("//") || path.resolve(result) !== result
        || process.platform === "win32" && (!/^[a-z]:\\/i.test(result) || result.slice(2).includes(":"))) throw new Error();
    return result;
}
/** Validate public metadata without getters, interpolation or filesystem access.
 * Canonical ownership and entry identity are checked by the launcher at I/O. */
export function parseVaultAppDescriptor(value: unknown): VaultAppDescriptor | undefined {
    try {
        const d = record(value, ["schemaVersion", "id", "root", "program", "cwd", "source", "programDigest", "args", "selections"]);
        if (d.schemaVersion !== 1 || !UUID.test(text(d.id, 36)) || !/^[a-f0-9]{64}$/.test(text(d.programDigest, 64))) throw new Error();
        const root = localPath(d.root), program = localPath(d.program), cwd = localPath(d.cwd), source = localPath(d.source);
        if (![program, cwd, source].every(p => isPathWithin(root, p)) || !/\.(?:js|cjs|mjs)$/.test(program)) throw new Error();
        let bytes = 0;
        const args = array(d.args, VAULT_RUNTIME_LIMITS.maxArgs).map(value => {
            const arg = text(value, VAULT_RUNTIME_LIMITS.maxArgBytes), size = Buffer.byteLength(arg, "utf8"); bytes += size;
            if (size > VAULT_RUNTIME_LIMITS.maxArgBytes || bytes > VAULT_RUNTIME_LIMITS.maxArgumentBytes || /\$\{|\$\(|`/.test(arg)) throw new Error(); return arg;
        });
        const names = new Set<string>(), placeholders = new Set<string>();
        const selections = array(d.selections, VAULT_RUNTIME_LIMITS.maxSelections).map(value => {
            const s = record(value, ["name", "placeholder"]), name = text(s.name, 128), placeholder = text(s.placeholder, 80);
            const token = /^\[SOTERAI_PROTECTED_[A-F0-9]{32}_(0|[1-9]\d{0,2})\]$/.exec(placeholder);
            if (!vaultEnvironmentNameAllowed(name) || !token || Number(token[1]) > 255 || names.has(name.toUpperCase()) || placeholders.has(placeholder)) throw new Error();
            names.add(name.toUpperCase()); placeholders.add(placeholder); return Object.freeze({ name, placeholder });
        });
        if (!selections.length) throw new Error();
        const result: VaultAppDescriptor = { schemaVersion: 1, id: d.id as string, root, program, cwd, source,
            programDigest: d.programDigest as string, args: Object.freeze(args), selections: Object.freeze(selections) };
        // Serialize only bounded, copied own-data primitives; never input.toJSON.
        if (Buffer.byteLength(JSON.stringify(result), "utf8") > VAULT_RUNTIME_LIMITS.maxDescriptorBytes) throw new Error();
        return Object.freeze(result);
    } catch { return undefined; }
}
