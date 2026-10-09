export const COVERAGE_DISCLOSURE = [
    "Covers: SoterAI-managed context filtering, redacted previews and configured broker requests.",
    "Does not cover: native agents or same-user filesystem/process access; other extensions, open buffers, tabs, clipboard, screenshots or arbitrary network traffic.",
    "Operational setup is not verified protection. Selected-architecture guarantees remain UNTESTED. No independent consent or durable OS boundary is provided.",
].join("\n\n");

export function operationalCoverage(state: string): string {
    return `Operational state: ${state}. Verification: UNTESTED for selected-architecture guarantees.`;
}
