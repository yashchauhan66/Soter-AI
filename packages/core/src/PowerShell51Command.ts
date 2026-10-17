export const PS51_LIMITS = Object.freeze({ maxCommandBytes: 4096, maxTokens: 32, maxTokenBytes: 1024, maxSearchBytes: 256,
    maxLines: 100, maxSleepMs: 2000, maxListEntries: 256, maxWorkers: 2, maxRuntimeMs: 30000, stopGraceMs: 1000, maxRequestBytes: 16384 });
export type PowerShell51Command = { readonly kind: "PUBLIC"; readonly action: "location" | "version" | "date" | "write" | "list" | "sleep"; readonly args: readonly string[] }
    | { readonly kind: "READ"; readonly path: string; readonly lines?: Readonly<{ side: "first" | "last"; count: number }> }
    | { readonly kind: "SEARCH"; readonly path: string; readonly needle: string }
    | { readonly kind: "COPY"; readonly path: string; readonly destination: string }
    | { readonly kind: "ENV"; readonly name?: string }
    | { readonly kind: "GIT"; readonly action: "status" | "diff-stat" };
const CONTROL = /[\x00-\x1f\x7f-\x9f\u2028\u2029]/u;
export function powerShell51Literal(value: unknown): value is string {
    return typeof value === "string" && value.length <= PS51_LIMITS.maxTokenBytes && !CONTROL.test(value)
        && Buffer.from(value, "utf8").toString("utf8") === value && Buffer.byteLength(value, "utf8") <= PS51_LIMITS.maxTokenBytes;
}
export function powerShell51RelativePath(value: unknown, directory = false): value is string {
    if (!powerShell51Literal(value) || !value || /^[\\/]/.test(value) || /[:*?\[\]]/.test(value)) return false;
    if (value === ".") return directory;
    return value.split(/[\\/]/).every(part => !!part && part !== "." && part !== ".." && !part.endsWith(" ") && !part.endsWith("."))
        && !value.startsWith("-");
}
function decimal(value: string | undefined, max: number, min = 0): number | undefined {
    if (value === undefined || !/^(?:0|[1-9]\d*)$/.test(value) || value.length > 6) return undefined;
    const count = Number(value); return count >= min && count <= max ? count : undefined;
}
function tokens(input: string): string[] {
    const result: string[] = []; let cursor = 0;
    while (cursor < input.length) {
        if (input[cursor] === " ") { cursor++; continue; }
        const quote = input[cursor] === "'" || input[cursor] === '"' ? input[cursor++] : undefined;
        if (!result.length && quote) throw new Error();
        let value = "", closed = !quote;
        while (cursor < input.length) {
            const char = input[cursor];
            if (quote) {
                if (char === quote) {
                    if (quote === "'" && input[cursor + 1] === "'") { value += "'"; cursor += 2; continue; }
                    cursor++; closed = true; if (cursor < input.length && input[cursor] !== " ") throw new Error(); break;
                }
                if (char === "`" || quote === '"' && char === "$") throw new Error();
            } else {
                if (char === " ") break;
                if (/[;'"|&><(){}@$`]/.test(char)) throw new Error();
            }
            value += char; cursor++;
        }
        if (!closed || !powerShell51Literal(value) || value === "--%" || result.length >= PS51_LIMITS.maxTokens) throw new Error();
        result.push(value);
    }
    return result;
}
const pub = (action: Extract<PowerShell51Command, { kind: "PUBLIC" }>["action"], args: string[] = []): PowerShell51Command =>
    Object.freeze({ kind: "PUBLIC", action, args: Object.freeze(args) });
/** Whole-input parser for the cooperative finite-command dispatcher. Returned
 * literals are data; they are never reparsed as a PowerShell expression. */
export function parsePowerShell51Command(input: unknown): PowerShell51Command | undefined {
    try {
        if (typeof input !== "string" || input.length > PS51_LIMITS.maxCommandBytes || CONTROL.test(input) || Buffer.byteLength(input, "utf8") > PS51_LIMITS.maxCommandBytes
            || Buffer.from(input, "utf8").toString("utf8") !== input) return undefined;
        const line = input.trim();
        if (/^\$PSVersionTable\.PSVersion$/i.test(line)) return pub("version");
        const env = /^\$env:([A-Za-z_][A-Za-z0-9_]{0,127})$/i.exec(line);
        if (env) return Object.freeze({ kind: "ENV", name: env[1] });
        const all = tokens(line); if (!all.length) return undefined;
        const name = all[0].toLowerCase(), args = all.slice(1), lower = args.map(arg => arg.toLowerCase());
        if (["get-location", "pwd", "get-date", "version"].includes(name)) return args.length ? undefined : pub(name === "get-date" ? "date" : name === "version" ? "version" : "location");
        if (["echo", "write-output"].includes(name)) return pub("write", args);
        if (["get-childitem", "ls", "dir"].includes(name)) {
            if (args.length > 1) return undefined;
            if (lower[0] === "env:") return Object.freeze({ kind: "ENV" });
            const directory = args[0] ?? "."; return powerShell51RelativePath(directory, true) ? pub("list", [directory]) : undefined;
        }
        if (["sleep", "start-sleep"].includes(name)) return args.length === 2 && lower[0] === "-milliseconds" && decimal(args[1], PS51_LIMITS.maxSleepMs) !== undefined ? pub("sleep", [args[1]]) : undefined;
        if (["cat", "type", "gc", "get-content"].includes(name)) {
            const target = args.length === 1 ? args[0] : args.length === 2 && ["-literalpath", "-path"].includes(lower[0]) ? args[1] : undefined;
            return powerShell51RelativePath(target) ? Object.freeze({ kind: "READ", path: target }) : undefined;
        }
        if (["head", "tail"].includes(name)) {
            const target = args.length === 1 ? args[0] : args.length === 3 && lower[0] === "-n" ? args[2] : undefined;
            const count = args.length === 1 ? 10 : decimal(args[1], PS51_LIMITS.maxLines, 1);
            return powerShell51RelativePath(target) && count !== undefined ? Object.freeze({ kind: "READ", path: target,
                lines: Object.freeze({ side: name === "head" ? "first" : "last", count }) }) : undefined;
        }
        if (["select-string", "sls", "grep", "rg"].includes(name)) {
            let needle: string | undefined, target: string | undefined;
            if (args.length === 2 && !args[0].startsWith("-")) [needle, target] = args;
            else if (["select-string", "sls"].includes(name) && args.length === 5 && lower[0] === "-simplematch" && lower[1] === "-pattern" && lower[3] === "-literalpath") [needle, target] = [args[2], args[4]];
            return needle !== undefined && Buffer.byteLength(needle, "utf8") <= PS51_LIMITS.maxSearchBytes && powerShell51RelativePath(target)
                ? Object.freeze({ kind: "SEARCH", path: target, needle }) : undefined;
        }
        if (["copy-item", "copy", "cp"].includes(name)) {
            let from: string | undefined, destination: string | undefined;
            if (args.length === 2) [from, destination] = args;
            else if (args.length === 4 && lower[0] === "-literalpath" && lower[2] === "-destination") [from, destination] = [args[1], args[3]];
            return powerShell51RelativePath(from) && powerShell51RelativePath(destination) && from.replace(/\\/g, "/").toLowerCase() !== destination.replace(/\\/g, "/").toLowerCase()
                ? Object.freeze({ kind: "COPY", path: from, destination }) : undefined;
        }
        if (["env", "set", "printenv"].includes(name)) {
            if (!args.length) return Object.freeze({ kind: "ENV" });
            return name === "printenv" && args.length === 1 && /^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(args[0]) ? Object.freeze({ kind: "ENV", name: args[0] }) : undefined;
        }
        if (name === "get-item" && args.length === 1 && /^env:[A-Za-z_][A-Za-z0-9_]{0,127}$/i.test(args[0])) return Object.freeze({ kind: "ENV", name: args[0].slice(4) });
        if (name === "git") {
            if (lower[0] === "status" && (args.length === 1 || args.length === 2 && lower[1] === "--short")) return Object.freeze({ kind: "GIT", action: "status" });
            if (args.length === 2 && lower[0] === "diff" && lower[1] === "--stat") return Object.freeze({ kind: "GIT", action: "diff-stat" });
        }
        return undefined;
    } catch { return undefined; }
}
