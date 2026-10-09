import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, mkdir, writeFile, realpath, stat, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const execute = promisify(execFile);
export const SAFE_GIT_UNAVAILABLE = "Safe diff unavailable. Install Git 2.36 or newer in a standard location. Git could not be safely pinned; no diff was shared.";

export function gitCandidates(env: NodeJS.ProcessEnv, platform = process.platform): string[] {
    if (platform !== "win32") return ["/usr/bin/git", "/usr/local/bin/git", "/opt/homebrew/bin/git"];
    const roots = [env.ProgramW6432, env.ProgramFiles, env["ProgramFiles(x86)"], "C:\\Program Files", "C:\\Program Files (x86)"];
    const candidates = roots.filter((root): root is string => !!root && path.win32.isAbsolute(root))
        .flatMap(root => [path.win32.join(root, "Git", "cmd", "git.exe"), path.win32.join(root, "Git", "bin", "git.exe")]);
    if (env.LOCALAPPDATA && path.win32.isAbsolute(env.LOCALAPPDATA)) candidates.push(path.win32.join(env.LOCALAPPDATA, "Programs", "Git", "cmd", "git.exe"));
    return [...new Set(candidates)];
}

export function supportsDisabledFsmonitor(version: string): boolean {
    const match = /^git version (\d+)\.(\d+)\./.exec(version.trim());
    return !!match && (+match[1] > 2 || (+match[1] === 2 && +match[2] >= 36));
}

export function safeGitEnvironment(job: string, ambient: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = {};
    for (const name of ["SystemRoot", "WINDIR", "COMSPEC"]) if (ambient[name]) env[name] = ambient[name];
    return { ...env, HOME: job, USERPROFILE: job, XDG_CONFIG_HOME: job, TEMP: job, TMP: job,
        GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: path.join(job, "empty.gitconfig"),
        GIT_ATTR_NOSYSTEM: "1", GIT_TERMINAL_PROMPT: "0", GIT_OPTIONAL_LOCKS: "0" };
}

export function safeGitArguments(job: string, args: string[]): string[] {
    return ["--no-pager", "--literal-pathspecs", "-c", "core.hooksPath=" + path.join(job, "empty-hooks"),
        "-c", "core.fsmonitor=false", "-c", "credential.helper=", "-c", "commit.gpgSign=false", ...args];
}

export async function createSafeGit(candidates = gitCandidates(process.env)) {
    const job = await mkdtemp(path.join(os.tmpdir(), "soter-safe-git-"));
    const dispose = () => {
        if (path.dirname(path.resolve(job)) !== path.resolve(os.tmpdir()) || !path.basename(job).startsWith("soter-safe-git-")) throw new Error("Unexpected Git temporary path");
        return rm(job, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    };
    try {
        await mkdir(path.join(job, "empty-hooks"));
        await writeFile(path.join(job, "empty.gitconfig"), "", { flag: "wx" });
        const env = safeGitEnvironment(job, process.env);
        let executable: string | undefined;
        for (const candidate of candidates) {
            if (!path.isAbsolute(candidate)) continue;
            try {
                const pinned = await realpath(candidate);
                if (!(await stat(pinned)).isFile()) continue;
                const result = await execute(pinned, ["--version"], { cwd: job, env, windowsHide: true, timeout: 5000, maxBuffer: 4096 });
                if (supportsDisabledFsmonitor(result.stdout)) { executable = pinned; break; }
            } catch { /* Discovery never falls back to an ambient command name. */ }
        }
        if (!executable) throw new Error(SAFE_GIT_UNAVAILABLE);
        const pinned = executable;
        return { executable: pinned, job, env, dispose,
            run: (cwd: string, args: string[]) => execute(pinned, safeGitArguments(job, args), {
                cwd, env, windowsHide: true, timeout: 5000, maxBuffer: 64 * 1024,
            }) };
    } catch (error) { await dispose(); throw error; }
}
