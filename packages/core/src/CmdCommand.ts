import { PS51_LIMITS, powerShell51Literal, powerShell51RelativePath, type PowerShell51Command } from "./PowerShell51Command";
export const CMD_LIMITS = Object.freeze({ ...PS51_LIMITS, maxLiteralBytes: 1000, maxRawOutputBytes: 262144, maxRawChunks: 4096 });
const META = /[%!^&|<>()]/u, CONTROL = /[\x00-\x1f\x7f-\x9f\u2028\u2029]/u;
export const cmdRelativePath = (value: unknown, directory = false): value is string => powerShell51RelativePath(value, directory) && !META.test(value) && !/["']/u.test(value);
export const cmdAsciiLiteral = (value: unknown): value is string => powerShell51Literal(value) && value.length <= CMD_LIMITS.maxLiteralBytes && /^[\x20-\x7e]*$/u.test(value) && !META.test(value) && !/["']/u.test(value);
type Public = Extract<PowerShell51Command, { kind: "PUBLIC" }>;
const pub = (action: Public["action"], args: string[] = []): Public => Object.freeze({ kind: "PUBLIC", action, args: Object.freeze(args) });
function tokens(input: string): string[] {
    const result: string[] = []; let cursor = 0;
    while (cursor < input.length) {
        if (input[cursor] === " ") { cursor++; continue; }
        const quoted = input[cursor] === '"'; if (quoted) cursor++;
        if (!result.length && quoted) throw Error();
        let value = "", closed = !quoted;
        while (cursor < input.length) {
            const char = input[cursor++];
            if (quoted && char === '"') { closed = true; if (cursor < input.length && input[cursor] !== " ") throw Error(); break; }
            if (!quoted && char === " ") break;
            if (char === '"' || char === "'") throw Error(); value += char;
        }
        if (!closed || !powerShell51Literal(value) || result.length >= CMD_LIMITS.maxTokens) throw Error(); result.push(value);
    }
    return result;
}
/** Declared cmd syntax to data only. It is never forwarded as shell code. */
export function parseCmdCommand(input: unknown): PowerShell51Command | undefined {
    try {
        if (typeof input !== "string" || input.length > CMD_LIMITS.maxCommandBytes || Buffer.byteLength(input, "utf8") > CMD_LIMITS.maxCommandBytes || CONTROL.test(input) || META.test(input) || Buffer.from(input, "utf8").toString("utf8") !== input) return undefined;
        const all = tokens(input.trim()); if (!all.length) return undefined;
        const name = all[0].toLowerCase(), args = all.slice(1), lower = args.map(arg => arg.toLowerCase());
        if (name === "ver" || name === "cd") return args.length ? undefined : pub(name === "ver" ? "version" : "location");
        if (name === "dir") return args.length <= 1 && cmdRelativePath(args[0] ?? ".", true) ? pub("list", [args[0] ?? "."]) : undefined;
        if (name === "echo") { const text = args.join(" "); return cmdAsciiLiteral(text) ? pub("write", [text]) : undefined; }
        if (name === "type") return args.length === 1 && cmdRelativePath(args[0]) ? Object.freeze({ kind: "READ", path: args[0] }) : undefined;
        if (name === "find") return args.length === 2 && !args[0].startsWith("/") && Buffer.byteLength(args[0], "utf8") <= CMD_LIMITS.maxSearchBytes && cmdRelativePath(args[1]) ? Object.freeze({ kind: "SEARCH", needle: args[0], path: args[1] }) : undefined;
        if (name === "set") return !args.length ? Object.freeze({ kind: "ENV" }) : args.length === 1 && /^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(args[0]) ? Object.freeze({ kind: "ENV", name: args[0] }) : undefined;
        if (name === "copy") return args.length === 2 && cmdRelativePath(args[0]) && cmdRelativePath(args[1]) && args[0].replace(/\\/g, "/").toLowerCase() !== args[1].replace(/\\/g, "/").toLowerCase() ? Object.freeze({ kind: "COPY", path: args[0], destination: args[1] }) : undefined;
        if (name === "timeout") return args.length === 3 && lower[0] === "/t" && /^[012]$/.test(args[1]) && lower[2] === "/nobreak" ? pub("sleep", [String(Number(args[1]) * 1000)]) : undefined;
        return undefined;
    } catch { return undefined; }
}
