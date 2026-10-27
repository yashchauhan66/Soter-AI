import * as path from "node:path";
import { TextDecoder, types } from "node:util";

const byteLength = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype), "byteLength")!.get!;
// Native Node environments have a runtime-specific prototype. Only the exact
// genuine object receives this exception; copied prototypes and proxies refuse.
const nativeEnvironment = process.env;
const unsafe = /[\p{Cc}\p{Cf}<>:"|?*\\]/u;
function components(value: string, separator: string): boolean {
    return value.split(separator).every(part => !!part && part !== "." && part !== ".." && part.length <= 255
        && !unsafe.test(part) && !/[. ]$|~[0-9]+(?:\.|$)/i.test(part)
        && !/^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³]|conin\$|conout\$|clock\$)(?:\.|$)/i.test(part));
}
function absolute(value: unknown): value is string {
    return typeof value === "string" && value.length <= 2048 && /^[A-Za-z]:\\/.test(value)
        && path.win32.normalize(value) === value && components(value.slice(3), "\\");
}
/** Only the witnessed owner projection, never the scanner's overridden config.
 * This parses metadata; it cannot establish filesystem or installer authority. */
export function parseOwnerHookConfig(raw: Buffer, root: string): Readonly<{ hooksRelative: string }> | undefined {
    try {
        if (!absolute(root) || !types.isUint8Array(raw) || !Buffer.isBuffer(raw)) return undefined;
        const size: number = byteLength.call(raw); if (size > 65536) return undefined;
        const copy = new Uint8Array(size); Uint8Array.prototype.set.call(copy, raw);
        const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(copy);
        if (!text) return Object.freeze({ hooksRelative: ".git/hooks" });
        const fields = text.split("\0");
        if (fields.length !== 4 || fields[3] !== "" || fields[0] !== "local"
            || !["file:.git/config", "file:" + root + "\\.git\\config"].includes(fields[1])) return undefined;
        const row = /^core\.hookspath\n([^\n]+)$/.exec(fields[2]); if (!row) return undefined;
        const relative = row[1];
        if (Buffer.byteLength(relative, "utf8") > 2048 || relative.startsWith("~") || relative.includes("%(")
            || !components(relative, "/")) return undefined;
        return Object.freeze({ hooksRelative: relative });
    } catch { return undefined; }
}
const discovery = ["HOME", "USERPROFILE", "XDG_CONFIG_HOME", "SystemRoot", "WINDIR", "COMSPEC", "HOMEDRIVE", "HOMEPATH",
    "GIT_CONFIG_GLOBAL", "GIT_CONFIG_SYSTEM", "GIT_CONFIG_NOSYSTEM"];
const names = new Map(discovery.map(name => [name.toUpperCase(), name]));
const controls = Object.freeze({ GIT_TERMINAL_PROMPT: "0", GCM_INTERACTIVE: "never", GIT_OPTIONAL_LOCKS: "0", GIT_PAGER: "", PAGER: "",
    GIT_NO_LAZY_FETCH: "1", GIT_NO_REPLACE_OBJECTS: "1", GIT_PROTOCOL_FROM_USER: "0", LC_ALL: "C", LANG: "C" });
/** Preserve only witnessed owner configuration discovery, with no inherited
 * startup preload, credential, command injection or repository selector. */
export function buildOwnerHookEnvironment(ambient: NodeJS.ProcessEnv): Readonly<NodeJS.ProcessEnv> | undefined {
    try {
        if (!ambient || typeof ambient !== "object" || types.isProxy(ambient)
            || ambient !== nativeEnvironment && ![Object.prototype, null].includes(Object.getPrototypeOf(ambient))) return undefined;
        const keys = Reflect.ownKeys(ambient);
        if (keys.some(key => typeof key !== "string") || keys.length > 4096) return undefined;
        const fields = Object.getOwnPropertyDescriptors(ambient);
        if (Object.values(fields).some(field => field.get || field.set || !field.enumerable)) return undefined;
        const projected: NodeJS.ProcessEnv = {}, seen = new Set<string>();
        for (const key of keys as string[]) {
            const canonical = key.toUpperCase(), name = names.get(canonical), value: unknown = fields[key].value;
            if (canonical.startsWith("GIT_") && !name) return undefined;
            if (!name) continue;
            if (seen.has(canonical) || typeof value !== "string") return undefined; seen.add(canonical);
            if (name === "GIT_CONFIG_NOSYSTEM") { if (value !== "1") return undefined; }
            else if (name === "HOMEDRIVE") { if (!/^[A-Za-z]:$/.test(value)) return undefined; }
            else if (name === "HOMEPATH") { if (!/^\\[^\\]/.test(value) || !absolute("C:" + value)) return undefined; }
            else if (!absolute(value)) return undefined;
            projected[name] = value;
        }
        if (!projected.HOME && !projected.USERPROFILE) return undefined;
        return Object.freeze({ ...projected, ...controls });
    } catch { return undefined; }
}
