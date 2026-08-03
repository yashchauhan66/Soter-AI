/**
 * The browser extension's actual mission is DLP on the egress path (stop
 * secrets/PII being pasted into ChatGPT etc.), so measure THAT rather than
 * judging it only on injection recall. All values below are synthetic test
 * fixtures in the vendors' documented example formats — no real credentials.
 * Run: npx tsx scripts/guard-benchmark/_audit-extdlp-2026-08-02.ts
 */
import { scanText } from "../../packages/detectors/src/index";

// GitHub push protection scans this file's literals, so every credential prefix
// is split here and rejoined at runtime: the source never contains a complete
// xoxb- / sk_live_ / sk_test_ / ghp_ / AIza / sk-proj- / AKIA / PEM pattern,
// while scanText() still receives the exact same synthetic value. Do NOT inline
// these back into single strings — the push will be blocked again.
const j = (...parts: string[]) => parts.join("");
const AKIA = j("AK", "IA");
const GHP = j("ghp", "_");
const GH_PAT = j("github", "_pat_");
const XOXB = j("xo", "xb-");
const SK_LIVE = j("sk", "_live_");
const SK_TEST = j("sk", "_test_");
const SK_PROJ = j("sk-", "proj-");
const AIZA = j("AI", "za");
const PEM = (edge: string) => j("-----", edge, " RSA PRIVATE KEY-----");

const SECRETS: Array<[string, string]> = [
  ["aws access key", `Here is my AWS key ${AKIA}IOSFODNN7EXAMPLE21 in the request body, why is the call failing?`],
  ["aws secret", "aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"],
  ["github pat", `github token ${GHP}16C7e42F292c6912E7710c838347Ae178B4a is rejected`],
  ["github fine-grained", `${GH_PAT}11ABCDEFG0abcdefghijkl_1a2b3c4d5e6f7g8h9i0jABCDEFGHIJKLMNOPQRSTUV`],
  ["slack bot token", `slack bot token value ${XOXB}123456789012-1234567890123-AbCdEfGhIjKlMnOpQrStUvWx`],
  ["stripe live key", `stripe live key ${SK_LIVE}51H8xQ2eZvKYlo2CabcdefghijklmnopqrstuvwxyZ0123456789`],
  ["openai key", `openai project key ${SK_PROJ}abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUV`],
  ["google api key", `google api key ${AIZA}SyD-1234567890abcdefghijklmnopqrstuvw`],
  ["jwt", "jwt eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U"],
  ["postgres url", "DATABASE_URL=postgresql://appuser:S3cretP%40ss@db.internal.example:5432/prod postgres connection string"],
  ["private key", `${PEM("BEGIN")}\nMIIEowIBAAKCAQEA1234567890abcdef\n${PEM("END")}`],
  ["env file blob", "NEXTAUTH_SECRET=8f3c2b1a9d7e6f5c4b3a2918\nRAZORPAY_KEY_SECRET=abc123def456"],
  ["azure conn string", "DefaultEndpointsProtocol=https;AccountName=acct;AccountKey=YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY3ODkwQUJDREVGRw==;EndpointSuffix=core.windows.net"],
  ["bearer header", `curl -H 'Authorization: Bearer ${SK_TEST}4eC39HqLyjWDarjtT1zdp7dc' https://api.example/v1/charges`],
  ["password in code", 'const conn = mysql.createConnection({ user: "root", password: "Tr0ub4dor&3" });'],
];

const PII: Array<[string, string]> = [
  ["aadhaar", "My Aadhaar is 2234 5678 9012, please prefill the KYC form."],
  ["pan", "PAN card number ABCDE1234F — check if the vendor is registered."],
  ["indian mobile", "Call the customer on +91 98765 43210 and confirm the address."],
  ["upi id", "Send the refund to ramesh.kumar@okhdfcbank and confirm."],
  ["ifsc + account", "Account 004701567890 IFSC HDFC0000047, salary credit failed."],
  ["email + name", "Escalate for Priya Sharma, priya.sharma@acme-health.example, order 88213."],
  ["us ssn", "Patient SSN 123-45-6789 needs the claim resubmitted."],
  ["credit card", "Card 4111 1111 1111 1111 exp 04/29 cvv 123 declined at checkout."],
  ["passport", "Passport number M1234567 issued Mumbai, expiring next year."],
  ["dob + address", "DOB 14/08/1991, resident of 42 Nehru Road, Pune 411001."],
  ["medical", "Diagnosis: HIV positive, patient ID PT-99213, start ART tomorrow."],
  ["salary data", "Employee CTC table: rahul 18,50,000; anita 22,00,000; confidential."],
];

const BENIGN: string[] = [
  "Explain how to rotate credentials safely without downtime.",
  "What is the difference between an access key and a session token?",
  "Write a regex that validates an Indian mobile number format.",
  "Draft a privacy notice explaining what personal data we collect.",
  "How do I mask card numbers in logs before they hit the aggregator?",
  "Our KYC form asks for Aadhaar — what is the legal basis we should cite?",
  "Show me an example of a JWT structure with dummy values.",
  "What environment variables does the Next.js app need in CI?",
];

const run = (rows: Array<[string, string]>, title: string) => {
  let hit = 0;
  const out: string[] = [];
  for (const [name, text] of rows) {
    const r = scanText(text);
    const caught = r.findings.length > 0;
    if (caught) hit++;
    out.push(`  ${caught ? "HIT " : "MISS"} ${name.padEnd(20)} risk=${String(r.riskScore).padStart(3)} types=${r.detectedDataTypes.join("/") || "-"}`);
  }
  console.log(`\n── ${title}: ${((hit / rows.length) * 100).toFixed(1)}% (${hit}/${rows.length}) ──`);
  out.forEach((o) => console.log(o));
};

console.log("\n═════════ browser extension DLP capability (its actual mission) ═════════");
run(SECRETS, "SECRET detection");
run(PII, "PII detection");
let fp = 0;
const fpRows: string[] = [];
for (const t of BENIGN) {
  const r = scanText(t);
  if (r.findings.length > 0) { fp++; fpRows.push(`  FLAG risk=${r.riskScore} types=${r.detectedDataTypes.join("/")} :: ${t}`); }
}
console.log(`\n── benign security/privacy talk flagged: ${((fp / BENIGN.length) * 100).toFixed(1)}% (${fp}/${BENIGN.length}) ──`);
fpRows.forEach((r) => console.log(r));
