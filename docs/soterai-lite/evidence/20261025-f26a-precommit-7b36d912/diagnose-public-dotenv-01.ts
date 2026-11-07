import { RegisteredSecretMatcher } from "../../../../packages/core/src/RegisteredSecretMatcher";
import { analyzeHygieneText } from "../../../../packages/vscode-extension/src/hygiene/HygieneAnalysis";
import { inspectStagedBlob } from "../../../../packages/vscode-extension/src/history-hooks/StagedContent";
// Hypothesis: raw provider matching loses public field context after canonical
// dotenv analysis. Observe each boundary first; do not modify production here.
const lines = ["PORT=3000", "MONKEY=banana", "API_KEY=YOUR_API_KEY_HERE", "AUTH_TOKEN=${AUTH_TOKEN}", "PASSWORD=[MASKED]",
    "SECRET=[SOTERAI_PROTECTED_EXISTING]", "STRIPE_PUBLISHABLE_KEY=pk_test_F21PUBLICSYNTHETICONLY123456"];
for (const [index, text] of [...lines, lines.join("\n")].entries()) {
    let hygiene: number | string;
    try { hygiene = analyzeHygieneText({ source: ".env.example", text: text + "\n", environment: true }, Buffer.alloc(32, 1)).findings.length; }
    catch { hygiene = "UNAVAILABLE"; }
    const matched = new RegisteredSecretMatcher([]).inspectRequest([text + "\n"]);
    console.log(JSON.stringify({ index, hygiene, matcher: matched.status, kinds: matched.matches.map(m => m.kind), actual: inspectStagedBlob(".env.example", Buffer.from(text + "\n")).status }));
}
