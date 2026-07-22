/**
 * Corrective benign augmentation for the v3→v4 retrain.
 *
 * WHY: label analysis of datasets/ml-augmented-v3.jsonl showed SAFE is only
 * 21.8% of rows and almost entirely English (63k EN vs 1.5k Hinglish, ~0 other
 * languages). Consequently the v3 model confidently MISLABELS benign
 * code-generation requests as UNSAFE_OUTPUT (measured: "write a function that
 * chunks an array" → UNSAFE_OUTPUT 1.00) and benign non-English prose as
 * DATA_EXFILTRATION / SYSTEM_PROMPT_LEAK. Those false positives sit at the top
 * of the benign score distribution and push the 1%-FPR threshold up, costing
 * real recall (Recall@1%FPR capped at ~85% while Recall@5%FPR already hits 100%).
 *
 * This generator emits the missing benign mass — code-gen across many
 * languages/frameworks + benign prose across many human languages — all labeled
 * SAFE, in the same JSONL schema as generate-adversarial-dataset.ts. Concatenate
 * with the existing dataset before retraining:
 *
 *   npx tsx scripts/ml/generate-benign-corrective.ts
 *   cat datasets/ml-augmented-v3.jsonl datasets/ml-benign-corrective.jsonl \
 *       > datasets/ml-augmented-v4.jsonl
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

// ── Benign code-generation requests ───────────────────────────────────────────
// These are the exact shape the model over-flags. Build many via templates so
// the SAFE class learns "asking for ordinary code is not an attack".

const CODE_TASKS = [
  "chunk an array into subarrays of size n",
  "compress all PNG images in a directory",
  "format a number as USD currency",
  "time a block of code with a context manager",
  "group an array of objects by a given key",
  "rename all .jpeg files in a folder to .jpg",
  "debounce a function call",
  "deep-clone a nested object",
  "parse a CSV file into a list of dictionaries",
  "validate an email address with a regular expression",
  "convert a snake_case string to camelCase",
  "flatten a deeply nested array",
  "retry a failed network request with exponential backoff",
  "read a JSON file and pretty-print it",
  "find the longest common prefix of a list of strings",
  "merge two sorted linked lists",
  "implement a least-recently-used cache",
  "paginate a database query",
  "generate a slug from a blog post title",
  "throttle scroll events on a web page",
  "compute a moving average over a numeric series",
  "convert an image to grayscale",
  "escape HTML special characters in a string",
  "sort a list of tuples by the second element",
  "memoize an expensive recursive function",
  "stream a large file line by line",
  "build a simple REST endpoint that returns the current time",
  "connect to a database using a connection pool",
  "write a unit test for a function that adds two numbers",
  "serialize a dataclass to JSON",
];

const CODE_LANGS = [
  "Python", "JavaScript", "TypeScript", "Go", "Rust", "Java", "C#", "Ruby",
  "PHP", "Kotlin", "Swift", "Scala", "Bash",
];

const CODE_TEMPLATES = [
  (lang: string, task: string) => `Write a ${lang} function to ${task}.`,
  (lang: string, task: string) => `How do I ${task} in ${lang}?`,
  (lang: string, task: string) => `Can you show me a ${lang} snippet to ${task}?`,
  (lang: string, task: string) => `Please write ${lang} code that will ${task}.`,
  (lang: string, task: string) => `I need a ${lang} example that shows how to ${task}.`,
  (lang: string, task: string) => `Refactor this ${lang} code that ${task} to be more readable.`,
  (lang: string, task: string) => `What's an idiomatic way to ${task} in ${lang}?`,
];

// ── Benign prose across human languages ───────────────────────────────────────
// Ordinary assistant requests in non-English languages — the model must learn
// these are SAFE, not exfiltration/leak attempts.

const MULTILINGUAL_BENIGN: Array<{ lang: string; texts: string[] }> = [
  { lang: "es", texts: [
    "¿Puedes darme cinco ideas para un regalo de cumpleaños económico?",
    "¿Cómo funciona un bucle for en Python? Explícalo con un ejemplo sencillo.",
    "Escribe un correo cortés para posponer una reunión al viernes.",
    "Resume las ventajas de dormir ocho horas por noche.",
    "Traduce 'the weather is nice today' al español formal.",
    "Dame una receta sencilla de sopa de verduras para cuatro personas.",
    "¿Cuáles son buenas prácticas para escribir un currículum?",
    "Explica la diferencia entre HTTP y HTTPS de forma breve.",
  ]},
  { lang: "fr", texts: [
    "Bonjour, peux-tu m'aider à écrire un e-mail poli pour reporter une réunion ?",
    "Explique comment fonctionne une boucle for en Python avec un exemple simple.",
    "Donne-moi cinq idées de cadeaux d'anniversaire pas chers.",
    "Résume les avantages d'une bonne nuit de sommeil.",
    "Traduis 'the meeting is postponed to Friday' en français formel.",
    "Propose une recette facile de soupe de légumes pour quatre personnes.",
    "Quelles sont les bonnes pratiques pour rédiger un CV ?",
    "Explique brièvement la différence entre HTTP et HTTPS.",
  ]},
  { lang: "de", texts: [
    "Kannst du mir fünf günstige Geschenkideen zum Geburtstag geben?",
    "Erkläre, wie eine for-Schleife in Python funktioniert, mit einem einfachen Beispiel.",
    "Schreibe eine höfliche E-Mail, um ein Meeting auf Freitag zu verschieben.",
    "Fasse die Vorteile von acht Stunden Schlaf pro Nacht zusammen.",
    "Übersetze 'the weather is nice today' ins formelle Deutsch.",
    "Gib mir ein einfaches Rezept für Gemüsesuppe für vier Personen.",
  ]},
  { lang: "pt", texts: [
    "Você pode me dar cinco ideias de presente de aniversário baratas?",
    "Explique como funciona um laço for em Python com um exemplo simples.",
    "Escreva um e-mail educado para adiar uma reunião para sexta-feira.",
    "Resuma os benefícios de dormir oito horas por noite.",
  ]},
  { lang: "hi", texts: [
    "मुझे कम बजट में जन्मदिन के पाँच तोहफ़े के सुझाव दो।",
    "Python में for loop कैसे काम करता है, एक आसान उदाहरण से समझाओ।",
    "शुक्रवार तक मीटिंग टालने के लिए एक विनम्र ईमेल लिखो।",
    "रोज़ आठ घंटे सोने के फायदे संक्षेप में बताओ।",
  ]},
  { lang: "hinglish", texts: [
    "Yaar mujhe ek simple Python function chahiye jo do numbers add kare.",
    "Friday tak meeting postpone karne ke liye ek polite email likh do.",
    "Kam budget me birthday gift ke paanch ideas de do.",
    "HTTP aur HTTPS me kya difference hai, short me batao.",
  ]},
  { lang: "ja", texts: [
    "誕生日の安いプレゼントのアイデアを5つ教えてください。",
    "Pythonのforループの仕組みを簡単な例で説明してください。",
    "会議を金曜日に延期する丁寧なメールを書いてください。",
  ]},
];

function main() {
  const rows: Row[] = [];

  // Code-gen: full cartesian (task × lang × template), deduped. Benign code
  // requests are the dominant false-positive category, so we want dense coverage
  // (~2.7k rows) to overwrite the model's "code = UNSAFE_OUTPUT" prior.
  const seen = new Set<string>();
  for (const task of CODE_TASKS) {
    for (const lang of CODE_LANGS) {
      for (const tmpl of CODE_TEMPLATES) {
        const text = tmpl(lang, task);
        if (seen.has(text)) continue;
        seen.add(text);
        rows.push({
          text,
          label: "SAFE",
          source: "benign-corrective:codegen",
          family: "SAFE_CODEGEN",
          language: "en",
        });
      }
    }
  }

  // Multilingual benign prose.
  for (const { lang, texts } of MULTILINGUAL_BENIGN) {
    for (const text of texts) {
      rows.push({
        text,
        label: "SAFE",
        source: "benign-corrective:multilingual",
        family: "SAFE_MULTILINGUAL",
        language: lang,
      });
    }
  }

  const outPath = path.join("datasets", "ml-benign-corrective.jsonl");
  const body = rows.map((r) => JSON.stringify(r)).join("\n") + "\n";
  fs.writeFileSync(outPath, body, "utf-8");

  const byLang: Record<string, number> = {};
  for (const r of rows) byLang[r.language] = (byLang[r.language] ?? 0) + 1;
  console.log(`[OK] wrote ${rows.length} SAFE corrective rows to ${outPath}`);
  console.log(`     code-gen: ${rows.filter((r) => r.family === "SAFE_CODEGEN").length}, ` +
    `multilingual: ${rows.filter((r) => r.family === "SAFE_MULTILINGUAL").length}`);
  console.log(`     by language: ${JSON.stringify(byLang)}`);
}

main();
