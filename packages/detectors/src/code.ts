import type { DetectorFinding } from "./core";

const CODE_PATTERNS = [
  /\b(?:function|class|interface|type|const|let|var)\s+[A-Za-z_$][\w$]*/g,
  /\b(?:SELECT|INSERT|UPDATE|DELETE)\s+.+\s+FROM\b/gi,
  /\b(?:import|export)\s+(?:type\s+)?(?:\{|\*|[A-Za-z_$])/g,
  /\b(?:curl|wget)\s+https?:\/\/[^\s]+/gi,
];

export function detectSourceCode(text: string): DetectorFinding[] {
  const hits = CODE_PATTERNS.flatMap((pattern) => Array.from(text.matchAll(pattern)));
  if (hits.length < 2 && !/[{};]\s*$/.test(text.trim())) return [];
  const first = hits[0] ?? { index: 0, 0: text.slice(0, Math.min(80, text.length)) };
  return [{
    type: "source_code",
    label: "Source code snippet",
    severity: "medium",
    score: Math.min(24, 10 + hits.length * 4),
    start: first.index ?? 0,
    end: Math.min(text.length, (first.index ?? 0) + String(first[0]).length),
    match: String(first[0]),
    message: "Source code snippet detected.",
  }];
}
