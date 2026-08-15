import { detectPatterns } from "../../lib/guard/detectors/helpers";
const rules = [{ pattern: /\bAIM\b/i, label: "probe-i", message: "m", severity: "HIGH" as const, score: 35 },
               { pattern: /\bAIM\b/,  label: "probe-cs", message: "m", severity: "HIGH" as const, score: 35 }];
for (const p of ["A1M jailbreak now", "4IM persona", "Our aim is clear", "AIM persona", "Ａ Ｉ Ｍ"]) {
  const f = detectPatterns(p, "JAILBREAK", rules as any);
  console.log(JSON.stringify(p).padEnd(24), "->", f.map((x: any) => x.label).join(", ") || "(none)");
}
