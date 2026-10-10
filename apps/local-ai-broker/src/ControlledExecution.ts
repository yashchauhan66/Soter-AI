import path from "node:path";

/** Paths are supplied by the trusted operator, never by the request or PATH. */
export function controlledInvocation(executable: string, args: string[], executables: Readonly<Record<string, string>>) {
    const file = Object.hasOwn(executables, executable) ? executables[executable] : undefined;
    if (!file || !path.isAbsolute(file)) return undefined;
    const fixedArgs = executable === "git" ? [
        "--no-pager", "--no-optional-locks", "-c", "core.fsmonitor=false", "-c", "core.hooksPath=",
        "-c", "submodule.recurse=false", ...args,
        ...(args[0] === "status" ? ["--ignore-submodules=all"] : []),
    ] : [...args];
    return { file, args: fixedArgs };
}

export function controlledEnvironment(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
    const clean: NodeJS.ProcessEnv = { LC_ALL: "C", GIT_TERMINAL_PROMPT: "0", GIT_CONFIG_NOSYSTEM: "1",
        GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null", GIT_OPTIONAL_LOCKS: "0" };
    for (const name of ["SystemRoot", "WINDIR"]) {
        const entry = Object.entries(source).find(([key]) => key.toLowerCase() === name.toLowerCase());
        if (entry?.[1]) clean[name] = entry[1];
    }
    return clean;
}
