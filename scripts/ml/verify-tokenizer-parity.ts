/**
 * Asserts the TS BertTokenizer (lib/ml/bertTokenizer.ts) produces token ids
 * IDENTICAL to the Python HuggingFace tokenizer the v3 model trained with.
 *
 * Run (after scripts/ml/dump-hf-tokenization.py):
 *   npx tsx scripts/ml/verify-tokenizer-parity.ts
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { BertTokenizer, parseVocabTxt } from "../../lib/ml/bertTokenizer";

const ROOT = path.resolve(__dirname, "..", "..");
const TOK_DIR = path.join(ROOT, "models", "ml-classifier-v3", "tokenizer_config");
const GOLDEN = path.join(__dirname, "_hf-tokenization-golden.json");

interface Golden {
  text: string;
  input_ids: number[];
  attention_mask: number[];
}

function main() {
  const vocab = parseVocabTxt(fs.readFileSync(path.join(TOK_DIR, "vocab.txt"), "utf-8"));
  const tok = new BertTokenizer(vocab, {
    doLowerCase: true,
    stripAccents: null,
    tokenizeChineseChars: true,
    maxLength: 128,
  });

  const golden: Golden[] = JSON.parse(fs.readFileSync(GOLDEN, "utf-8"));
  let pass = 0;
  const fails: string[] = [];

  for (const g of golden) {
    const r = tok.tokenize(g.text);
    const idsMatch = r.inputIds.length === g.input_ids.length &&
      r.inputIds.every((v, i) => v === g.input_ids[i]);
    const maskMatch = r.attentionMask.length === g.attention_mask.length &&
      r.attentionMask.every((v, i) => v === g.attention_mask[i]);
    if (idsMatch && maskMatch) {
      pass++;
    } else {
      // find first divergence for a readable diff
      let at = -1;
      for (let i = 0; i < Math.max(r.inputIds.length, g.input_ids.length); i++) {
        if (r.inputIds[i] !== g.input_ids[i]) { at = i; break; }
      }
      fails.push(
        `\n  CASE: ${JSON.stringify(g.text)}\n` +
        `    first diff at index ${at}: TS=${r.inputIds[at]} HF=${g.input_ids[at]}\n` +
        `    TS ids: [${r.inputIds.slice(0, Math.max(at + 3, 12)).join(",")}...]\n` +
        `    HF ids: [${g.input_ids.slice(0, Math.max(at + 3, 12)).join(",")}...]`,
      );
    }
  }

  console.log(`\nTokenizer parity: ${pass}/${golden.length} cases match HF exactly.`);
  if (fails.length) {
    console.log(`\nFAILURES (${fails.length}):${fails.join("")}`);
    process.exit(1);
  }
  console.log("PARITY OK — production tokens now match training tokens.");
}

main();
