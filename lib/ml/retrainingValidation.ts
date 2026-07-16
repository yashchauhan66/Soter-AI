export interface RetrainingExample {
  id: string;
  text: string;
  label: "attack" | "benign";
  source: string;
}

export function validateRetrainingDataset(examples: RetrainingExample[]) {
  const findings: Array<{ id: string; severity: "LOW" | "MEDIUM" | "HIGH"; message: string }> = [];
  const ids = new Set<string>();
  let attack = 0;
  let benign = 0;
  for (const example of examples) {
    if (ids.has(example.id)) findings.push({ id: "duplicate_id", severity: "HIGH", message: `Duplicate training id ${example.id}.` });
    ids.add(example.id);
    if (example.label === "attack") attack += 1;
    else benign += 1;
    if (/ignore\s+(?:all\s+)?previous instructions|reveal the system prompt|api[_\s-]?key|password|secret/i.test(example.text) && example.label === "benign") {
      findings.push({ id: "poisoned_benign_label", severity: "HIGH", message: `Suspicious attack text is labelled benign: ${example.id}.` });
    }
    if (!example.source || /unknown|untrusted/i.test(example.source)) {
      findings.push({ id: "untrusted_source", severity: "MEDIUM", message: `Training source is missing or untrusted: ${example.id}.` });
    }
  }
  const total = Math.max(1, examples.length);
  const minorityRatio = Math.min(attack, benign) / total;
  if (examples.length < 20) findings.push({ id: "small_dataset", severity: "MEDIUM", message: "Retraining dataset is too small for promotion." });
  if (minorityRatio < 0.2) findings.push({ id: "class_imbalance", severity: "HIGH", message: "Retraining dataset is severely imbalanced." });
  return {
    allowed: !findings.some((finding) => finding.severity === "HIGH"),
    attack,
    benign,
    findings,
  };
}
