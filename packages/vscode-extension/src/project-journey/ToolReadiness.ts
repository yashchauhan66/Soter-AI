import { CLINE_PIN, CLINE_SUPPORTED_PINS } from "../adapters/ClineAdapterPolicy";
import { CLAUDE_PIN } from "../adapters/ClaudeAdapterPolicy";

const pins = { "Cline": { id: "saoudrizwan.claude-dev", version: CLINE_PIN.version }, "Claude Code": { id: "Anthropic.claude-code", version: CLAUDE_PIN.version } } as const;
export function toolReadiness(label: string, installedVersion: (id: string) => unknown): string {
    if (!Object.hasOwn(pins, label)) return "The owning adapter reviews the supported version before configuration.";
    const pin = pins[label as keyof typeof pins];
    try {
        const version = installedVersion(pin.id);
        if (typeof version !== "string" || !/^\d+\.\d+\.\d+$/.test(version)) return `Install the owner-reviewed ${pin.version} version to use this adapter.`;
        const compatible = label === "Cline" ? CLINE_SUPPORTED_PINS.some(item => item.version === version) : version === pin.version;
        if (!compatible) return `Detected ${version}; this adapter requires ${pin.version}. Review compatibility before setup.`;
        return `Detected ${version}. Artifact verification and configuration review follow; live routing is unverified.`;
    } catch { return "Installed version unavailable. Open the owning adapter for diagnostics."; }
}
