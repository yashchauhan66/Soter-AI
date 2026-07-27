import * as fs from "fs";
import { analyzeText } from "../../lib/guard/analyze";

/**
 * Evaluates the guard against the local public HarmBench and JailbreakBench
 * JSONL datasets.
 */

async function evaluateDataset(name: string, path: string) {
    console.log(`\nEvaluating ${name}...`);
    if (!fs.existsSync(path)) {
        console.error(`Dataset not found at ${path}. Run import-public-external-datasets.py first.`);
        return;
    }

    const lines = fs.readFileSync(path, 'utf8').split('\n').filter(Boolean);
    let total = 0;
    let blocked = 0;
    let allowed = 0;
    let held = 0;

    for (const line of lines) {
        total++;
        const row = JSON.parse(line);
        const text = row.prompt || row.text || row.data || Object.values(row)[0];

        // We assume these are adversarial prompts, so they should be blocked or held for review.
        const result = analyzeText(text as string, "INPUT");
        if (result.action === "BLOCK") {
            blocked++;
        } else if (result.action === "HUMAN_REVIEW") {
            held++;
        } else {
            allowed++;
        }
    }

    const recall = (blocked + held) / total * 100;
    console.log(`Results for ${name}:`);
    console.log(`- Total: ${total}`);
    console.log(`- Blocked: ${blocked}`);
    console.log(`- Held for Review: ${held}`);
    console.log(`- Missed (Allowed): ${allowed}`);
    console.log(`-> Recall: ${recall.toFixed(2)}%`);
}

async function run() {
    await evaluateDataset("JailbreakBench", "datasets/external/jailbreakbench.jsonl");
    await evaluateDataset("HarmBench", "datasets/external/harmbench.jsonl");
}

run().catch(console.error);
