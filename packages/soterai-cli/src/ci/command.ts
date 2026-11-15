import * as fs from "node:fs/promises";
import path from "node:path";
import { scanDirectory, scanExitCode } from "./scan";
import { githubSummary, publicCiSummary, sarifReport } from "./report";

export async function runCiCommand(argv: string[], deps: { cwd: string; out(value: string): void; err(value: string): void; readStdin(maxBytes?: number): Promise<string> }): Promise<number> {
    try {
        if (argv[0] !== "scan") throw Error();
        const options = new Map<string, string>();
        for (let index = 1; index < argv.length; index++) {
            const key = argv[index];
            if (key === "--registered-stdin") { if (options.has(key)) throw Error(); options.set(key, "true"); continue; }
            if (!["--root", "--policy", "--format", "--output", "--mode"].includes(key) || options.has(key) || !argv[index + 1] || argv[index + 1].startsWith("--")) throw Error();
            options.set(key, argv[++index]);
        }
        const format = options.get("--format") ?? "json"; if (!["json", "sarif", "summary-json", "github"].includes(format)) throw Error();
        let policy: unknown = { mode: options.get("--mode") ?? "source" };
        if (options.has("--policy")) {
            if (options.has("--mode")) throw Error();
            const file = path.resolve(deps.cwd, options.get("--policy")!), stat = await fs.lstat(file);
            if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > 65536) throw Error();
            policy = JSON.parse(await fs.readFile(file, "utf8"));
        }
        let values: string[] = [];
        if (options.has("--registered-stdin")) { const input = await deps.readStdin(131072); if (Buffer.byteLength(input) > 131072) throw Error(); values = JSON.parse(input); if (!Array.isArray(values) || values.some(v => typeof v !== "string")) throw Error(); }
        const report = await scanDirectory(path.resolve(deps.cwd, options.get("--root") ?? "."), policy, values);
        const output = format === "github" ? githubSummary(report) : JSON.stringify(format === "sarif" ? sarifReport(report) : format === "summary-json" ? publicCiSummary(report) : report, null, 2) + "\n";
        if (options.has("--output")) await fs.writeFile(path.resolve(deps.cwd, options.get("--output")!), output, { flag: "wx" });
        else deps.out(output);
        return scanExitCode(report);
    } catch { deps.err('CI scan unavailable. Use: soterai ci scan --root <directory> [--mode source|artifact] [--policy <trusted-json>] [--format json|sarif|summary-json|github] [--output <new-file>] [--registered-stdin]'); return 2; }
}
