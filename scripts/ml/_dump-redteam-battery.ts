/**
 * Dump the in-repo red-team corpus to JSONL so score-battery.ts can measure it
 * the same way it measures any other battery (identical rows, identical scorer).
 */
import { writeFileSync } from "node:fs";
import { REDTEAM_CORPUS } from "../guard-benchmark/_redteam-corpus";

const FAMILY_TO_LABEL: Record<string, string> = {
  ENCODING_OBFUSCATION: "ENCODING_OBFUSCATION",
  MODEL_EXTRACTION: "MODEL_EXTRACTION",
  MULTI_TURN_ESCALATION: "MULTI_TURN_ESCALATION",
  TOOL_CALL_ABUSE: "TOOL_CALL_ABUSE",
  DATA_EXFILTRATION: "DATA_EXFILTRATION_ATTEMPT",
  BENIGN: "SAFE",
};

const rows = REDTEAM_CORPUS.map((c) => ({
  text: c.text,
  label: FAMILY_TO_LABEL[c.family] ?? c.family,
  category: c.id,
  language: "en",
}));

const out = "datasets/_redteam-battery.jsonl";
writeFileSync(out, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
console.log(`wrote ${rows.length} rows -> ${out}`);
