import * as path from "node:path";
import { existsSync } from "node:fs";

export const POWERSHELL7_SYSTEM_EXECUTABLE = "C:\\Program Files\\PowerShell\\7\\pwsh.exe";

/** Only the system or per-user installation layout; never PATH or a project setting. */
export function powerShell7Candidates(localAppData: unknown): readonly string[] {
    const result = [POWERSHELL7_SYSTEM_EXECUTABLE];
    if (typeof localAppData !== "string" || localAppData.length > 2048 || !/^[a-z]:\\/i.test(localAppData)
        || /[\x00-\x1f\x7f-\x9f]/u.test(localAppData) || localAppData.split(/[\\/]/).some(part => part === "." || part === "..")
        || path.win32.normalize(localAppData).toLowerCase() !== localAppData.toLowerCase()) return Object.freeze(result);
    result.push(path.win32.join(localAppData, "Programs", "PowerShell", "7", "pwsh.exe"));
    return Object.freeze(result);
}

export function resolvePowerShell7(localAppData: unknown, exists: (file: string) => boolean = existsSync): string {
    return powerShell7Candidates(localAppData).find(file => exists(file)) ?? POWERSHELL7_SYSTEM_EXECUTABLE;
}
