/**
 * Measure each proposed \b fix BEFORE applying it.
 *
 * The mid-word sweep says which literals collide with English. It does not say
 * whether bounding them is free — a bound token can also drop real detections,
 * and "the collision looked wrong" is not evidence. Each row below is scored as
 * it currently stands and as it would stand fixed, on the same corpus, so the
 * edit is taken or rejected on the pair of numbers.
 *
 * Reading the result: benign fires should fall. Attack fires falling is only
 * acceptable where those fires were themselves substring artifacts (verified in
 * _midword2.ts) — a real detection lost to a boundary is a bad trade.
 */
import { readFileSync } from "node:fs";

type Row = { text: string; label: string };
const rows: Row[] = readFileSync("datasets/external-train-v2.jsonl", "utf8")
  .split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l) as Row);
const isB = (l: string) => /^(benign|safe|0|negative)$/i.test(l);
const nb = rows.filter((r) => isB(r.label)).length;
const na = rows.length - nb;

function score(src: string) {
  const re = new RegExp(src, "i");
  let b = 0, a = 0;
  for (const r of rows) if (re.test(r.text)) { if (isB(r.label)) b++; else a++; }
  return { b, a, lift: b === 0 ? Infinity : (a / na) / (b / nb) };
}
const f = (x: { b: number; a: number; lift: number }) =>
  `${String(x.b).padStart(4)} ${String(x.a).padStart(4)} ${(x.lift === Infinity ? "inf" : x.lift.toFixed(1)).padStart(7)}`;

const DRUG_HEAD_NOW = "(?:methamphetamine|meth|crystal meth|cocaine|crack cocaine|heroin|fentanyl|carfentanil|oxycodone|hydrocodone|psilocybin|lsd|mdma|ecstasy|ghb|ketamine|pcp|dmt|xanax|alprazolam|adderall|ritalin)";
const DRUG_HEAD_FIX = "\\b(?:methamphetamine|crystal meth|meth|cocaine|crack cocaine|heroin|fentanyl|carfentanil|oxycodone|hydrocodone|psilocybin|lsd|mdma|ecstasy|ghb|ketamine|pcp|dmt|xanax|alprazolam|adderall|ritalin)\\b";
const DRUG_TAIL = "(?:synthesis|synthesize|cook|clandestine lab|precursor|yield|extract|purif(?:y|y)?|obtain|produce|manufacture|prepare|react|step|method|recipe|how to make|how do you make|instructions|process|procedure|ingredient|chemical|labs?|batch|concentration)";

const EXP_HEAD_NOW = "(?:ammonium nitrate|anfo|tatp|hmtd|rdx|petn|c-4|semtex|nitroglycerin|nitric acid|black powder|acetone peroxide|pipe bomb|pressure cooker bomb|ied|car bomb|nail bomb|suicide vest|explosive device|detonator|initiator|blasting cap|primary explosive|improvised explosive)";
const EXP_HEAD_FIX = "\\b(?:ammonium nitrate|anfo|tatp|hmtd|rdx|petn|c-4|semtex|nitroglycerin|nitric acid|black powder|acetone peroxide|pipe bomb|pressure cooker bomb|ieds?|car bomb|nail bomb|suicide vest|explosive device|detonator|initiator|blasting cap|primary explosive|improvised explosive)\\b";
const EXP_TAIL = "(?:make|build|assemble|construct|prepare|detonate|trigger|yield|mix|proportion|sensitiv|booster|primary|secondary|step|recipe|method|instruction|how to)";

const cases: [string, string, string][] = [
  ["Direct drug synthesis inquiry",
    `${DRUG_HEAD_NOW}[\\s\\S]{0,80}${DRUG_TAIL}`,
    `${DRUG_HEAD_FIX}[\\s\\S]{0,80}${DRUG_TAIL}`],
  ["Direct explosive construction inquiry",
    `${EXP_HEAD_NOW}[\\s\\S]{0,80}${EXP_TAIL}`,
    `${EXP_HEAD_FIX}[\\s\\S]{0,80}${EXP_TAIL}`],
  ["Doxxing (first alternative only)",
    "(?:dox|doxx)(?:ing)?\\s*(?:someone|this person|them|him|her|[A-Z])",
    "\\b(?:dox|doxx)(?:ing)?\\s*(?:someone|this person|them|him|her|[A-Z])"],
  ["Adaptive jailbreak optimizer",
    "(?:if blocked|if refused|if filtered|if the guard rejects|until it succeeds|iterate|mutate|rewrite the prompt|try alternate wording|optimize for compliance|maximize compliance|find a phrasing that passes)",
    "(?:if blocked|if refused|if filtered|if the guard rejects|until it succeeds|\\biterate\\b|\\bmutate\\b|rewrite the prompt|try alternate wording|optimize for compliance|maximize compliance|find a phrasing that passes)"],
  ["Encoded instruction smuggling",
    "(?:decode|translate|read backwards|url encoding|html entity|rot13|caesar cipher|pig latin|morse)[\\s\\S]{0,160}(?:ignore|disregard|previous|instructions?|follow the instruction)",
    "(?:decode|translate|read backwards|url encoding|html entity|rot13|caesar cipher|pig latin|\\bmorse\\b)[\\s\\S]{0,160}(?:ignore|disregard|previous|instructions?|follow the instruction)"],
  ["Model supply-chain risk",
    "(?:model|checkpoint|weights|adapter|lora|gguf|safetensors|onnx|pickle|pkl)[\\s\\S]{0,200}(?:backdoor|trojan|poisoned|malicious|untrusted|remote code|postinstall|eval|exec)",
    "(?:model|checkpoint|weights|adapter|lora|gguf|safetensors|onnx|pickle|pkl)[\\s\\S]{0,200}(?:backdoor|trojan|poisoned|malicious|untrusted|remote code|postinstall|\\beval\\b|\\bexec\\b)"],
  ["Jailbreak persona override",
    "\\b(?:DAN|AIM|STAN|DUDE|KEVIN|EvilGPT|BetaGPT|Uncensored AI)\\b.{0,140}(?:mode|persona|no restrictions|without restrictions|bypass|no ethics|does not follow rules|answer anything)",
    "\\b(?:DAN|AIM|STAN|DUDE|KEVIN|EvilGPT|BetaGPT|Uncensored AI)\\b.{0,140}(?:\\bmode\\b|\\bpersona\\b|no restrictions|without restrictions|bypass|no ethics|does not follow rules|answer anything)"],
];

console.log("rule                                    ben  atk    lift   ->   ben  atk    lift   verdict");
for (const [label, now, fix] of cases) {
  const a = score(now), b = score(fix);
  const benignGain = a.b - b.b;
  const attackLoss = a.a - b.a;
  let verdict: string;
  if (benignGain > 0 && attackLoss <= 0) verdict = `TAKE — ${benignGain} false accusations removed, no detection lost`;
  else if (benignGain > 0 && attackLoss > 0) verdict = `CHECK — removes ${benignGain} benign but also ${attackLoss} attack fires`;
  else if (benignGain === 0 && attackLoss > 0) verdict = `REJECT — costs ${attackLoss} attacks, removes no benign fire`;
  else if (benignGain === 0 && attackLoss === 0) verdict = "no measurable change (correctness only)";
  else verdict = "unexpected — inspect";
  console.log(`${label.padEnd(38)}${f(a)}   ->  ${f(b)}   ${verdict}`);
}
