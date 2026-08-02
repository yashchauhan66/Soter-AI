/**
 * Counterfactual for the 14 over-broad IPS signatures that caused 15 of the 20
 * false positives: how many of the 88 novel attacks do they actually catch?
 * If the answer is ~0 they can be removed at no recall cost on unseen traffic.
 * Run: npx tsx scripts/guard-benchmark/_audit-ipsfp-2026-08-02.ts
 */
import { AUDIT_ATTACKS, AUDIT_BENIGN } from "./_audit-heldout-2026-08-02";

// The exact literals copied out of lib/guard/analyze.ts (ipsBlockSignatures)
// that fired on ordinary developer traffic in the held-out run.
const OVERBROAD: Array<[string, RegExp]> = [
  ["/reverse order/i", /reverse order/i],
  ["/repeat.*above/i", /repeat.*above/i],
  ["/unrestricted/i", /unrestricted/i],
  ["/what was written/i", /what was written/i],
  ["/programmed to do/i", /programmed to do/i],
  ["/override.*instructions/i", /override.*instructions/i],
  ["/ignore.*rules/i", /ignore.*rules/i],
  ["/select \\* from.*users/i", /select \* from.*users/i],
  ["/disable.*restrictions/i", /disable.*restrictions/i],
  ["/admin mode/i", /admin mode/i],
  ["/reset.*default/i", /reset.*default/i],
  ["/export.*(?:user|customer|private).*(?:data|records|database)/i", /export.*(?:user|customer|private).*(?:data|records|database)/i],
  ["/extract.*(?:user|customer|database|private).*(?:data|emails|records|pii)/i", /extract.*(?:user|customer|database|private).*(?:data|emails|records|pii)/i],
  ["/forget.*role/i", /forget.*role/i],
  ["/(?:decode|morse).*morse|morse.*decode/i", /(?:decode|morse).*morse|morse.*decode/i],
];

const hitsOn = (text: string) => OVERBROAD.filter(([, rx]) => rx.test(text)).map(([src]) => src);

console.log("\n═════════ over-broad IPS signature counterfactual ═════════");
const atk = AUDIT_ATTACKS.map((c) => ({ c, h: hitsOn(c.text) })).filter((x) => x.h.length);
const ben = AUDIT_BENIGN.map((c) => ({ c, h: hitsOn(c.text) })).filter((x) => x.h.length);
console.log(`patterns audited: ${OVERBROAD.length}`);
console.log(`novel ATTACKS matched by them: ${atk.length}/${AUDIT_ATTACKS.length}`);
atk.forEach((x) => console.log(`  ATK  ${x.c.id} [${x.c.cat}] via ${x.h.join(", ")} :: ${x.c.text.slice(0, 60)}`));
console.log(`benign traffic matched by them: ${ben.length}/${AUDIT_BENIGN.length}`);
ben.forEach((x) => console.log(`  BEN  ${x.c.id} [${x.c.cat}] via ${x.h.join(", ")} :: ${x.c.text.slice(0, 60)}`));
const ratio = atk.length === 0 ? "∞ (pure false-positive generators)" : (ben.length / atk.length).toFixed(1);
console.log(`\nbenign:attack match ratio = ${ratio}`);
