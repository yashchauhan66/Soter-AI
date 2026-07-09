import type { DetectorMatch, DetectorResult } from "../types";

export const AI_CODE_RISK_DETECTOR_VERSION = "1.0.0";

const CODE_RISK_PATTERNS = [
    // SQL injection
    { pattern: /\b(?:query|execute|raw)\s*\(\s*[`"'].*\$\{/gi, type: "sql_injection", label: "SQL injection", score: 30, confidence: 0.85, message: "Potential SQL injection via string interpolation." },
    { pattern: /\b(?:query|execute)\s*\(\s*(?:req\.(?:body|params|query)|user[Ii]nput)/gi, type: "sql_injection", label: "SQL injection", score: 32, confidence: 0.9, message: "Unsanitized user input in SQL query." },
    // XSS
    { pattern: /\binnerHTML\s*=\s*(?!['"]<(?:br|hr|p)\s*\/?>['"])/gi, type: "xss", label: "XSS via innerHTML", score: 25, confidence: 0.8, message: "innerHTML assignment may cause XSS." },
    { pattern: /\bdocument\.write\s*\(/gi, type: "xss", label: "document.write XSS", score: 22, confidence: 0.75, message: "document.write can cause XSS." },
    { pattern: /dangerouslySetInnerHTML/gi, type: "xss", label: "React dangerouslySetInnerHTML", score: 20, confidence: 0.7, message: "dangerouslySetInnerHTML usage." },
    // Command injection
    { pattern: /\b(?:exec|execSync|spawn|spawnSync)\s*\(\s*(?:`|req\.|user|input)/gi, type: "command_injection", label: "Command injection", score: 35, confidence: 0.9, message: "Unsanitized input in shell command." },
    { pattern: /\bchild_process\b.*\b(?:exec|spawn)\b/gi, type: "command_injection", label: "child_process exec", score: 28, confidence: 0.8, message: "child_process with dynamic input." },
    // SSRF
    { pattern: /\b(?:fetch|axios|request|http\.get)\s*\(\s*(?:req\.|user|input|\$\{)/gi, type: "ssrf", label: "SSRF", score: 30, confidence: 0.85, message: "User-controlled URL in HTTP request." },
    // Path traversal
    { pattern: /\b(?:readFile|readFileSync|createReadStream)\s*\(\s*(?:req\.|user|input|path\.join\s*\(\s*(?:req|user))/gi, type: "path_traversal", label: "Path traversal", score: 28, confidence: 0.85, message: "User input in file path." },
    // Hardcoded secret
    { pattern: /\b(?:password|secret|apiKey|token)\s*[:=]\s*["'][^"']{8,}["']/gi, type: "hardcoded_secret", label: "Hardcoded secret", score: 25, confidence: 0.75, message: "Hardcoded secret in code." },
    // Weak crypto
    { pattern: /\b(?:createHash|crypto\.hash)\s*\(\s*["'](?:md5|sha1)["']\)/gi, type: "weak_crypto", label: "Weak crypto", score: 20, confidence: 0.9, message: "Weak hash algorithm (MD5/SHA1)." },
    { pattern: /\bMath\.random\s*\(\s*\)/g, type: "insecure_random", label: "Insecure random", score: 15, confidence: 0.6, message: "Math.random() is not cryptographically secure." },
    // Unsafe deserialization
    { pattern: /\bJSON\.parse\s*\(\s*(?:req\.|user|input|body)/gi, type: "unsafe_deser", label: "Unsafe deserialization", score: 18, confidence: 0.6, message: "Parsing untrusted JSON without validation." },
    // eval / new Function
    { pattern: /\beval\s*\(/g, type: "eval_usage", label: "eval() usage", score: 35, confidence: 0.95, message: "eval() usage is dangerous." },
    { pattern: /\bnew\s+Function\s*\(/g, type: "new_function", label: "new Function()", score: 32, confidence: 0.9, message: "new Function() is equivalent to eval()." },
    // Missing auth
    { pattern: /\bapp\.(?:get|post|put|delete|patch)\s*\(\s*["'][^"']+["']\s*,\s*(?:async\s+)?\(\s*req/gi, type: "missing_auth", label: "Missing auth check", score: 12, confidence: 0.4, message: "Route handler may lack auth middleware." },
    // CORS
    { pattern: /\bcors\s*\(\s*\{\s*origin\s*:\s*(?:["']\*["']|true)/gi, type: "insecure_cors", label: "Insecure CORS", score: 20, confidence: 0.85, message: "Wildcard CORS origin." },
    // Prototype pollution
    { pattern: /\b(?:Object\.assign|_\.merge|_\.extend|_\.defaults)\s*\(\s*\{\s*\}/g, type: "prototype_pollution", label: "Prototype pollution", score: 22, confidence: 0.6, message: "Potential prototype pollution vector." },
];

export function detectAIGeneratedCodeRisk(text: string): DetectorResult {
    const matches: DetectorMatch[] = [];
    for (const spec of CODE_RISK_PATTERNS) {
        spec.pattern.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = spec.pattern.exec(text)) !== null) {
            if (!m[0]) continue;
            matches.push({
                type: spec.type, label: spec.label,
                severity: spec.score >= 30 ? "high" : spec.score >= 18 ? "medium" : "low",
                score: spec.score, start: m.index, end: m.index + m[0].length,
                match: m[0], message: spec.message, confidence: spec.confidence,
            });
        }
    }
    return { detectorName: "AIGeneratedCodeRiskDetector", detectorVersion: AI_CODE_RISK_DETECTOR_VERSION, matches };
}
