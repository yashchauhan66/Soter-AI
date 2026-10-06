/**
 * PHASE 2 — results recorder.
 *
 * Each scenario appends ONE row. The runner aggregates the rows into the
 * `ID | Scenario | Expected | Actual | Evidence | Severity | Status` table.
 *
 * Rows are appended to a file rather than held in memory because every test
 * file runs in its own process.
 *
 * STATUS vocabulary, and it matters:
 *   PASS      the invariant held under this attack
 *   FAIL      the invariant broke — a real finding
 *   SKIP      the attack could not be set up on this machine (never a PASS)
 *   STUB-DEP  the result depends on stubbed VS Code behaviour, not product code
 */
import { appendFileSync, mkdirSync } from "node:fs";
import * as path from "node:path";
import { NONCE } from "./canaries";

export type Severity = "Critical" | "High" | "Medium" | "Low" | "Info";
export type Status = "PASS" | "FAIL" | "SKIP" | "STUB-DEP";

export interface ResultRow {
    id: string;
    invariant: string;
    scenario: string;
    expected: string;
    actual: string;
    evidence: string;
    severity: Severity;
    status: Status;
}

export const RESULTS_DIR = path.resolve(__dirname, "../../../artifacts/phase2");
const RESULTS_FILE = path.join(RESULTS_DIR, "results.jsonl");

export function record(row: ResultRow): void {
    mkdirSync(RESULTS_DIR, { recursive: true });
    appendFileSync(RESULTS_FILE, `${JSON.stringify({ ...row, nonce: NONCE })}\n`, "utf8");
}

/** Record and then assert, so a FAIL row exists even though the test throws. */
export function expectPass(row: Omit<ResultRow, "status">, held: boolean): void {
    record({ ...row, status: held ? "PASS" : "FAIL" });
    if (!held) {
        throw new Error(`${row.id} FAILED (${row.severity}): ${row.actual}\n  evidence: ${row.evidence}`);
    }
}

/** Record a finding without failing the process — used for known Phase 1 gaps. */
export function recordFinding(row: Omit<ResultRow, "status">, held: boolean): boolean {
    record({ ...row, status: held ? "PASS" : "FAIL" });
    return held;
}

export function recordSkip(row: Omit<ResultRow, "status" | "actual">, why: string): void {
    record({ ...row, actual: `NOT TESTED — ${why}`, status: "SKIP" });
}

export function recordStubDependent(row: Omit<ResultRow, "status">): void {
    record({ ...row, status: "STUB-DEP" });
}
