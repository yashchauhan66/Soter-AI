/**
 * Benign-GENERATION hard-negative generator for the v4→v5 retrain.
 *
 * WHY THIS EXISTS (root-caused 2026-07-20):
 *   The v3/v4 model's UNSAFE_OUTPUT class does NOT encode harm — it encodes
 *   "this is a generation request". Measured proof:
 *     - harmful HarmBench inputs  → UNSAFE_OUTPUT ~94%
 *     - BENIGN controls           → UNSAFE_OUTPUT ~68% @conf>=0.9
 *   i.e. "write a poem about the Holocaust", "write a letter to a colleague
 *   about their biracial marriage", "write a script that mines cryptocurrency",
 *   and "write a program that encrypts a user's filesystem" all fire
 *   UNSAFE_OUTPUT at high confidence. That is why the INPUT gate cannot trust
 *   UNSAFE_OUTPUT — it would re-introduce ~68% benign FPR.
 *
 *   The training data has ZERO benign generation-style negatives: every
 *   "write/compose/create ..." example in the corpus is an attack. The model
 *   therefore learned the shortcut "generation verb ⇒ UNSAFE_OUTPUT". This
 *   generator supplies the missing minimal-pair mass: benign requests that use
 *   the SAME produce verbs and touch the SAME sensitive-sounding topics, but ask
 *   for legitimate creative / professional / civic / coding output — all SAFE.
 *
 *   After retraining on v5 = v4 + these negatives, the expectation (to be
 *   MEASURED, not assumed) is that UNSAFE_OUTPUT's benign-INPUT firing collapses
 *   while its harmful-input recall holds, letting the INPUT gate finally trust it
 *   and closing the content-harm recall gap (HarmBench 56% → target >80%).
 *
 * NOT TEST CONTAMINATION: none of these strings are drawn from HarmBench or
 * JailbreakBench. They are independently authored benign minimal pairs. The harm
 * topics named (Holocaust, war, crime, drugs-in-fiction) are referenced the way
 * a novelist / journalist / teacher would, never as an operational request.
 *
 *   npx tsx scripts/ml/generate-benign-generation-negatives.ts
 *   cat datasets/ml-augmented-v4.jsonl datasets/ml-benign-generation-negatives.jsonl \
 *       > datasets/ml-augmented-v5.jsonl
 */
import * as fs from "node:fs";
import * as path from "node:path";

interface Row {
  text: string;
  label: "SAFE";
  source: string;
  family: string;
  language: string;
}

// Produce verbs — the SAME cues the attack rows use. Using identical verbs is the
// whole point: it forces the model to learn intent from the OBJECT, not the verb.
const PRODUCE = [
  "Write",
  "Compose",
  "Draft",
  "Create",
  "Generate",
  "Produce",
  "Put together",
  "Help me write",
  "Can you write",
  "I need",
  "Please write",
];

// ── 1. Creative writing on dark/sensitive but legitimate topics ──────────────
// A story/poem/song ABOUT a grim subject is protected expression, not harm.
const CREATIVE_FORMS = [
  "a poem",
  "a short story",
  "a song",
  "a sonnet",
  "a screenplay scene",
  "a short reflection",
  "a monologue",
  "a haiku",
  "a piece of flash fiction",
  "a ballad",
];
const CREATIVE_TOPICS = [
  "the Holocaust and the lives lost",
  "the horrors of war and the grief it leaves",
  "a soldier struggling with loss after battle",
  "a character recovering from heroin addiction",
  "the pain of losing a loved one to suicide",
  "surviving a natural disaster",
  "a detective investigating a murder in a noir city",
  "a family torn apart by a violent crime",
  "the resilience of refugees fleeing conflict",
  "a nurse's night shift in a war hospital",
  "grief after a school tragedy",
  "a veteran remembering fallen comrades",
  "the loneliness of addiction recovery",
  "hope after surviving domestic abuse",
];

// ── 2. Professional / journalistic writing on sensitive social topics ────────
const PROF_FORMS = [
  "a letter to a colleague",
  "a respectful workplace email",
  "a balanced news article",
  "a blog post",
  "an op-ed",
  "a public-health campaign",
  "a policy brief",
  "a speech",
  "an awareness campaign",
  "an explainer",
];
const PROF_TOPICS = [
  "congratulating them on their interracial marriage",
  "about the relationship between poverty and crime in communities",
  "encouraging healthy habits to address obesity",
  "on why some workers choose to retire after 55",
  "about supporting LGBTQ+ colleagues in the workplace",
  "discussing the mental-health impact of unemployment",
  "about how historical violence was used to enslave people",
  "explaining the warning signs of radicalization for parents",
  "about reducing stigma around addiction",
  "on the importance of vaccine safety and public trust",
  "describing the history of a genocide so students can learn from it",
  "about protecting elderly relatives from financial scams",
];

// ── 3. Scary-SOUNDING but legitimate code / sysadmin requests ────────────────
// These name "encrypt", "scrape", "kill processes", "mine" — vocabulary the
// model associates with malware — in an entirely ordinary engineering context.
const CODE_REQUESTS = [
  "a script that encrypts a user's files with a password they provide, for backup",
  "a program that closes all running applications before a system update",
  "a script that scrapes public product prices from our own website for analysis",
  "a small app that mines cryptocurrency on my own test rig to learn how it works",
  "a function that deletes temporary files older than 30 days",
  "a tool that monitors CPU usage and kills a runaway process I own",
  "a script that scans my own network to inventory devices",
  "a program that encrypts and decrypts notes using AES for my journal app",
  "a bot that automatically replies to my own customer-support emails",
  "a script that brute-force tests my own forgotten zip password",
  "a keyboard-shortcut listener for my own productivity app",
  "a script that downloads all my own invoices from a portal",
  "a packet sniffer for debugging traffic on my own laptop",
  "a password generator and strength checker for a signup form",
  "a script that wipes a test database and reseeds it before integration tests",
  "a tool that takes screenshots of my own screen on a timer for a tutorial",
];

// ── 4. Civic / everyday requests that resemble targeting or persuasion ───────
const CIVIC = [
  "a campaign encouraging companies to hire people with disabilities",
  "a persuasive essay arguing that public libraries deserve more funding",
  "a study guide to get an edge on my upcoming certification exam",
  "an argument for why remote work benefits both employers and staff",
  "a debate brief arguing in favor of stronger privacy laws",
  "a fundraising letter for a children's hospital",
  "a persuasive speech encouraging people to vote in local elections",
  "a marketing plan to promote a new vegetarian restaurant",
  "a guide to negotiating a higher salary at my annual review",
  "a convincing cover letter for a software engineering job",
  "a pitch encouraging teenagers to learn to code",
  "a proposal to reduce plastic waste in our office",
];

function cross(prefixes: string[], forms: string[], topics: string[], source: string, family: string): Row[] {
  const rows: Row[] = [];
  const seen = new Set<string>();
  for (const p of prefixes) {
    for (const f of forms) {
      for (const t of topics) {
        const text = `${p} ${f} about ${t}.`.replace(/about about /, "about ");
        if (seen.has(text)) continue;
        seen.add(text);
        rows.push({ text, label: "SAFE", source, family, language: "en" });
      }
    }
  }
  return rows;
}

function crossSimple(prefixes: string[], objects: string[], source: string, family: string): Row[] {
  const rows: Row[] = [];
  const seen = new Set<string>();
  for (const p of prefixes) {
    for (const o of objects) {
      const text = `${p} ${o}.`;
      if (seen.has(text)) continue;
      seen.add(text);
      rows.push({ text, label: "SAFE", source, family, language: "en" });
    }
  }
  return rows;
}

function main() {
  const rows: Row[] = [];

  // Creative + professional use the "<verb> <form> about <topic>" shape.
  rows.push(...cross(PRODUCE, CREATIVE_FORMS, CREATIVE_TOPICS, "benign-generation:creative", "SAFE_CREATIVE"));
  rows.push(...cross(PRODUCE, PROF_FORMS, PROF_TOPICS, "benign-generation:professional", "SAFE_PROFESSIONAL"));

  // Code + civic use the "<verb> <object>" shape.
  rows.push(...crossSimple(PRODUCE, CODE_REQUESTS, "benign-generation:code", "SAFE_CODE_SCARY"));
  rows.push(...crossSimple(PRODUCE, CIVIC, "benign-generation:civic", "SAFE_CIVIC"));

  const outPath = path.join("datasets", "ml-benign-generation-negatives.jsonl");
  const body = rows.map((r) => JSON.stringify(r)).join("\n") + "\n";
  fs.writeFileSync(outPath, body, "utf-8");

  const byFamily: Record<string, number> = {};
  for (const r of rows) byFamily[r.family] = (byFamily[r.family] ?? 0) + 1;
  console.log(`[OK] wrote ${rows.length} SAFE benign-generation negatives to ${outPath}`);
  console.log(`     by family: ${JSON.stringify(byFamily, null, 0)}`);
}

main();
