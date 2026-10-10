import { writeFile } from "node:fs/promises";
import path from "node:path";

/** Classifies an existing synthetic observation without assuming the old outcome. */
export function observeReviewCanary(text: string, canary: string, enabled = process.env.SOTERAI_REVIEW_UNIQUE_EVIDENCE === "1"): boolean {
    if (!enabled) throw new Error("Unique review evidence is disabled. Observation unavailable.");
    if (typeof text !== "string" || typeof canary !== "string" || !canary) throw new Error("A synthetic canary and observed text are required.");
    return text.includes(canary);
}

/** Evidence hygiene only: disabling the flag stops recording; it never enables overwrites. */
export async function writeReviewEvidence(
    filename: string,
    record: unknown,
    enabled = process.env.SOTERAI_REVIEW_UNIQUE_EVIDENCE === "1",
): Promise<void> {
    if (!enabled) throw new Error("Unique review evidence is disabled. The host review cannot run safely.");
    if (!path.isAbsolute(filename)) throw new Error("Review evidence requires an absolute per-run path.");
    await writeFile(filename, JSON.stringify(record, null, 2), { encoding: "utf8", flag: "wx" });
}
