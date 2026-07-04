import { detectPatterns, type PatternRule } from "./helpers";

const rules: PatternRule[] = [
  // ── Hate speech: racial/ethnic ──────────────────────────────────────
  { pattern: /\b(?:kill|exterminate|eliminate|purge|cleanse|eradicate)\s+(?:all\s+)?(?:jews|muslims|blacks|whites|hindus|christians|mexicans|asians|arabs|africans|immigrants|refugees)\b/i, label: "Genocidal hate speech", message: "Content incites violence against a protected group.", severity: "CRITICAL", score: 50 },
  { pattern: /\b(?:n[i!1*]gg[e3*]rs?|k[i!1*]k[e3*]s?|sp[i!1*]cs?|ch[i!1*]nks?|g[o0*][o0*]ks?|w[e3*]tb[a4*]cks?|r[a4*]gh[e3*][a4*]ds?|c[a4*]m[e3*]lj[o0*]ck[e3*]ys?|p[a4*]k[i!1*]s?)\b/i, label: "Racial slur", message: "Content contains a racial slur targeting a protected group.", severity: "CRITICAL", score: 50 },
  { pattern: /\b(?:subhuman|untermensch|vermin|cockroach|parasite|animal|monkey|ape)\b.{0,80}\b(?:race|people|ethnic|community|group|population|immigrants|refugees|minority)\b/i, label: "Dehumanization", message: "Content dehumanizes a group of people.", severity: "HIGH", score: 45 },
  { pattern: /\b(?:racial|ethnic|genetic)\s+(?:superiority|inferiority|purity|hierarchy|cleansing)\b/i, label: "Racial supremacy ideology", message: "Content promotes racial superiority ideology.", severity: "HIGH", score: 45 },

  // ── Hate speech: gender/sexuality ───────────────────────────────────
  { pattern: /\b(?:f[a4]gg?[o0]t|d[y!1]k[e3]|tr[a4]nn[y!1]|sh[e3]m[a4]l[e3])\b/i, label: "Anti-LGBTQ slur", message: "Content contains a homophobic or transphobic slur.", severity: "HIGH", score: 45 },
  { pattern: /\b(?:women|females?|girls?)\s+(?:are|should be)\s+(?:property|subservient|inferior|worthless|only good for|belong in the)\b/i, label: "Misogynistic dehumanization", message: "Content promotes misogynistic dehumanization.", severity: "HIGH", score: 45 },
  { pattern: /\b(?:homosexuality|being gay|being trans)\s+(?:is a|should be)\s+(?:disease|mental illness|sin|crime|punishable|cured|eliminated)\b/i, label: "Anti-LGBTQ hate", message: "Content promotes hatred against LGBTQ individuals.", severity: "HIGH", score: 45 },

  // ── Hate speech: religion ──────────────────────────────────────────
  { pattern: /\b(?:all\s+)?(?:muslims?|jews?|christians?|hindus?|sikhs?|buddhists?)\s+(?:are|should be)\s+(?:terrorists?|evil|killed|deported|banned|eliminated|wiped out)\b/i, label: "Religious hatred", message: "Content promotes hatred against a religious group.", severity: "HIGH", score: 45 },

  // ── Threats of violence ────────────────────────────────────────────
  { pattern: /\b(?:i\s+(?:will|want to|plan to|am going to)|i[''’](?:m going to|ll))\s+(?:kill|murder|shoot|stab|bomb|attack|assault|hurt|rape|lynch|behead)\s+(?:you|them|her|him|those|the|every)\b/i, label: "Direct threat of violence", message: "Content contains a direct threat of violence.", severity: "CRITICAL", score: 50 },
  { pattern: /\b(?:someone should|they deserve to|hope (?:you|they|she|he)\s+(?:get|die|are)|deserve to die|should be shot|should be killed|should be hanged)\b/i, label: "Indirect violence incitement", message: "Content incites or wishes violence upon others.", severity: "HIGH", score: 45 },
  { pattern: /\b(?:school shooting|mass shooting|bomb threat|i'll shoot up|plant a bomb|shoot up the|bring a gun to)\b/i, label: "Mass violence threat", message: "Content references or threatens mass violence.", severity: "CRITICAL", score: 50 },
  { pattern: /\b(?:how to|instructions for|guide to|steps to)\s+(?:make a bomb|build a weapon|poison someone|commit murder|carry out an attack|assassinate)\b/i, label: "Violence instruction request", message: "Content requests instructions for committing violence.", severity: "CRITICAL", score: 50 },

  // ── Harassment/bullying ────────────────────────────────────────────
  { pattern: /\b(?:kill yourself|kys|go die|drink bleach|end your(?:self| life)|nobody would miss you|world.{0,20}better.{0,20}without you)\b/i, label: "Self-harm encouragement", message: "Content encourages self-harm or suicide.", severity: "CRITICAL", score: 50 },
  { pattern: /\b(?:you(?:'re| are)\s+(?:worthless|pathetic|disgusting|a waste|trash|garbage|useless|better off dead|ugly|retarded|stupid))\b/i, label: "Targeted harassment", message: "Content contains targeted personal harassment.", severity: "HIGH", score: 40 },
  { pattern: /\b(?:dox|doxx|swat|stalk|find.{0,20}address|find.{0,20}where.{0,20}live|leak.{0,20}personal)\b.{0,80}\b(?:them|her|him|you|this person)\b/i, label: "Doxxing/stalking threat", message: "Content threatens doxxing, swatting, or stalking.", severity: "CRITICAL", score: 50 },

  // ── Self-harm/suicide content ──────────────────────────────────────
  { pattern: /\b(?:best way to|how to|methods? (?:for|of|to))\s+(?:kill (?:my|your)self|commit suicide|end (?:my|your) life|slit (?:my|your) wrists?|overdose|hang (?:my|your)self)\b/i, label: "Suicide method seeking", message: "Content seeks specific self-harm methods.", severity: "CRITICAL", score: 50 },
  { pattern: /\b(?:pro-?ana|pro-?mia|thinspo|thinspiration|starve yourself|purging (?:tips|guide|methods))\b/i, label: "Eating disorder promotion", message: "Content promotes eating disorders.", severity: "HIGH", score: 45 },

  // ── CSAM/grooming ──────────────────────────────────────────────────
  { pattern: /\b(?:child|minor|underage|kid|infant|baby|toddler|preteen|pre-teen)\b.{0,80}\b(?:sex|porn|nude|naked|erotic|sexual|intimate|explicit)\b/i, label: "CSAM reference", message: "Content references child sexual abuse material.", severity: "CRITICAL", score: 50 },
  { pattern: /\b(?:sexual|romantic|intimate|erotic)\b.{0,80}\b(?:child|minor|underage|kid|preteen|pre-teen|12[\s-]year|11[\s-]year|10[\s-]year|9[\s-]year|8[\s-]year)\b/i, label: "Minor sexualization", message: "Content sexualizes minors.", severity: "CRITICAL", score: 50 },
  { pattern: /\b(?:age of consent.{0,60}(?:too high|should be lowered)|pedophil(?:ia|e).{0,60}(?:natural|normal|acceptable|harmless|love))\b/i, label: "Pedophilia normalization", message: "Content attempts to normalize pedophilia.", severity: "CRITICAL", score: 50 },
  { pattern: /\b(?:groom|lure|seduce|attract)\b.{0,60}\b(?:child|minor|underage|kid|teen|young (?:boy|girl))\b/i, label: "Grooming language", message: "Content contains grooming patterns targeting minors.", severity: "CRITICAL", score: 50 },

  // ── Extremism/radicalization ────────────────────────���───────────────
  { pattern: /\b(?:join|support|pledge|allegiance)\s+(?:to\s+)?(?:isis|isil|al[- ]?qaeda|boko haram|hamas|hezbollah|taliban|proud boys|oath keepers|atomwaffen|base)\b/i, label: "Terrorist group recruitment", message: "Content promotes or recruits for terrorist organizations.", severity: "CRITICAL", score: 50 },
  { pattern: /\b(?:white genocide|great replacement|14 words|1488|race war|holy war|jihad against|crusade against|ethnic cleansing)\b/i, label: "Extremist ideology", message: "Content promotes extremist ideology.", severity: "HIGH", score: 45 },
  { pattern: /\b(?:manifesto|lone wolf|radicalize|inspire.{0,40}attack|martyrdom operation|glory.{0,40}sacrifice)\b.{0,120}\b(?:infidel|enemy|target|attack|strike|kill)\b/i, label: "Radicalization content", message: "Content contains radicalization patterns.", severity: "HIGH", score: 45 },

  // ── Non-consensual intimate content ────────────────────────────────
  { pattern: /\b(?:revenge porn|deepfake porn|non-?consensual.{0,40}(?:image|photo|video|porn)|leaked nudes|stolen.{0,20}(?:nudes|photos|images))\b/i, label: "Non-consensual intimate content", message: "Content references non-consensual intimate imagery.", severity: "HIGH", score: 45 },

  // ── Disability hate ────────────────────────────────────────────────
  { pattern: /\b(?:disabled|handicapped|retarded|crippled)\s+(?:people|persons?)\s+(?:are|should be)\s+(?:worthless|eliminated|euthanized|burden|useless)\b/i, label: "Disability hate", message: "Content promotes hatred against people with disabilities.", severity: "HIGH", score: 45 },

  // ─��� Dog-whistle and coded language ─────────────────────────────────
  { pattern: /\b(?:(?:(?:\(\(\()[\w\s]+(?:\)\)\)))|(?:triple parentheses)|(?:echoes))\b/i, label: "Antisemitic dog-whistle", message: "Content uses coded antisemitic signaling.", severity: "HIGH", score: 40 },
  { pattern: /\b(?:day of the rope|helicopter rides?|free helicopter|physical removal|so to speak)\b.{0,80}\b(?:commies|leftists?|enemies|degenerates?|them)\b/i, label: "Coded violence threat", message: "Content uses coded language to threaten violence.", severity: "HIGH", score: 40 },

  // ── Generalized toxicity patterns ──────────────────────────────────
  { pattern: /\b(?:i hope you(?:r family|r kids?| and your family)\s+(?:die|get cancer|burn|suffer|are killed|get raped))\b/i, label: "Death/harm wish", message: "Content wishes death or severe harm on others.", severity: "HIGH", score: 45 },
  { pattern: /\b(?:gas the|lynch the|hang the|burn the|nuke the)\s+(?:jews|blacks|whites|muslims|gays|trans|immigrants|refugees|mexicans)\b/i, label: "Group violence incitement", message: "Content incites violence against a specific group.", severity: "CRITICAL", score: 50 },
];

export function toxicityDetector(text: string) {
  return detectPatterns(text, "TOXICITY", rules);
}
