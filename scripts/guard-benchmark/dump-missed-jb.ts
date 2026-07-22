import * as fs from "fs";
import { analyzeText } from "../../lib/guard/analyze";

async function run() {
    const lines = fs.readFileSync("datasets/external/jailbreakbench.jsonl", 'utf8').split('\n').filter(Boolean);
    const missed = [];
    for (const line of lines) {
        const row = JSON.parse(line);
        const text = row.prompt || row.text;
        const result = analyzeText(text, "INPUT");
        if (result.action === "ALLOW" || result.action === "ALLOW_WITH_REDACTION") {
            missed.push(text);
        }
    }
    fs.writeFileSync("missed_jb_full.json", JSON.stringify(missed, null, 2));
}

run().catch(console.error);
