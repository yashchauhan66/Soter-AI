import { PS51_LIMITS, powerShell51Literal, powerShell51RelativePath, type PowerShell51Command } from "./PowerShell51Command";
export const GIT_BASH_LIMITS = Object.freeze({ ...PS51_LIMITS, maxLiteralBytes: 1024, maxRawOutputBytes: 262144, maxRawChunks: 4096 });
export const gitBashLiteral = (value: unknown): value is string => powerShell51Literal(value);
export const gitBashRelativePath = (value: unknown, directory = false): value is string => powerShell51RelativePath(value, directory) && !/[\\<>"|]/u.test(value);
type Public = Extract<PowerShell51Command, { kind: "PUBLIC" }>;
const pub = (action: Public["action"], args: string[] = []): Public => Object.freeze({ kind: "PUBLIC", action, args: Object.freeze(args) });
const count = (text: string | undefined): number | undefined => text && /^(?:[1-9]\d{0,2})$/.test(text) && Number(text) <= GIT_BASH_LIMITS.maxLines ? Number(text) : undefined;
function tokens(input: string): string[] {
    const result: string[] = []; let cursor = 0;
    while (cursor < input.length) {
        if (input[cursor] === " ") { cursor++; continue; }
        const quote = input[cursor] === "'" || input[cursor] === '"' ? input[cursor++] : undefined;
        if (!result.length && quote) throw Error(); let value = "", closed = !quote;
        while (cursor < input.length) {
            const char = input[cursor++];
            if (quote) {
                if (char === quote) { closed = true; if (cursor < input.length && input[cursor] !== " ") throw Error(); break; }
                if (quote === '"' && /[\\$`]/u.test(char)) throw Error();
            } else { if (char === " ") break; if (/[;'"|&><(){}$`\\*?\[\]!~]/u.test(char)) throw Error(); }
            value += char;
        }
        if (!closed || !gitBashLiteral(value) || result.length >= GIT_BASH_LIMITS.maxTokens) throw Error(); result.push(value);
    }
    return result;
}
/** Finite checked Bash forms become data; quoted programs are never executed. */
export function parseGitBashCommand(input: unknown): PowerShell51Command | undefined {
    try {
        if (typeof input !== "string" || input.length > GIT_BASH_LIMITS.maxCommandBytes || Buffer.byteLength(input, "utf8") > GIT_BASH_LIMITS.maxCommandBytes || /[\x00-\x1f\x7f-\x9f\u2028\u2029]/u.test(input) || Buffer.from(input, "utf8").toString("utf8") !== input) return undefined;
        const all = tokens(input.trim()); if (!all.length) return undefined; const name = all[0], args = all.slice(1);
        if (name === "version" || name === "pwd") return args.length ? undefined : pub(name === "version" ? "version" : "location");
        if (name === "bash") return args.length === 1 && args[0] === "--version" ? pub("version") : undefined;
        if (name === "ls") return args.length <= 1 && gitBashRelativePath(args[0] ?? ".", true) ? pub("list", [args[0] ?? "."]) : undefined;
        if (name === "echo") { const text = args.join(" "); return gitBashLiteral(text) ? pub("write", [text]) : undefined; }
        if (name === "sleep") return args.length === 1 && /^[012]$/.test(args[0]) ? pub("sleep", [String(Number(args[0]) * 1000)]) : undefined;
        if (name === "cat") return args.length === 1 && gitBashRelativePath(args[0]) ? Object.freeze({ kind: "READ", path: args[0] }) : undefined;
        if (name === "head" || name === "tail") {
            const target = args.length === 1 ? args[0] : args.length === 3 && args[0] === "-n" ? args[2] : undefined, lines = args.length === 1 ? 10 : count(args[1]);
            return gitBashRelativePath(target) && lines !== undefined ? Object.freeze({ kind: "READ", path: target, lines: Object.freeze({ side: name === "head" ? "first" : "last", count: lines }) }) : undefined;
        }
        if (name === "grep" || name === "rg") {
            const pair = args.length === 2 && !args[0].startsWith("-") ? args : args.length === 4 && args[0] === "-F" && args[1] === "--" ? args.slice(2) : undefined;
            return pair && Buffer.byteLength(pair[0], "utf8") <= GIT_BASH_LIMITS.maxSearchBytes && gitBashRelativePath(pair[1]) ? Object.freeze({ kind: "SEARCH", path: pair[1], needle: pair[0] }) : undefined;
        }
        if (name === "sed" || name === "awk") {
            const match = name === "sed" && args.length === 3 && args[0] === "-n" ? /^1,([1-9]\d{0,2})p$/.exec(args[1]) : name === "awk" && args.length === 2 ? /^NR<=([1-9]\d{0,2})$/.exec(args[0]) : null;
            const lines = match ? count(match[1]) : undefined, target = args.at(-1);
            return lines !== undefined && gitBashRelativePath(target) ? Object.freeze({ kind: "READ", path: target, lines: Object.freeze({ side: "first", count: lines }) }) : undefined;
        }
        if (name === "cp") return args.length === 2 && gitBashRelativePath(args[0]) && gitBashRelativePath(args[1]) && args[0].toLowerCase() !== args[1].toLowerCase() ? Object.freeze({ kind: "COPY", path: args[0], destination: args[1] }) : undefined;
        if (name === "env" || name === "printenv") return !args.length ? Object.freeze({ kind: "ENV" }) : name === "printenv" && args.length === 1 && /^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(args[0]) ? Object.freeze({ kind: "ENV", name: args[0] }) : undefined;
        if (name === "git") { if (args[0] === "status" && (args.length === 1 || args.length === 2 && args[1] === "--short")) return Object.freeze({ kind: "GIT", action: "status" }); if (args.length === 2 && args[0] === "diff" && args[1] === "--stat") return Object.freeze({ kind: "GIT", action: "diff-stat" }); }
        return undefined;
    } catch { return undefined; }
}
