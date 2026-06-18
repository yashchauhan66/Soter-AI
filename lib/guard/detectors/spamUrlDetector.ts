import { detectPatterns, type PatternRule } from "./helpers";

/**
 * Spam, phishing, and scam URL detector for the output guard.
 *
 * Flags model responses that contain unsolicited promotional links,
 * prize/lottery scams, fake inheritance offers, suspicious shortened
 * URLs (beyond the generic shorteners already in unsafeOutputDetector),
 * and "click here" patterns paired with URLs.
 */

const urlProtocolRe = /https?:\/\//i;

const rules: PatternRule[] = [
  // Suspicious content TLDs commonly used for spam/phishing
  { pattern: /https?:\/\/(?:[^\s\/]+\.)?(?:zip|review|top|gq|ml|cf|tk|work|date|loan|click|download|win|bid|trade)\b[^\s'"<>)]*/i, label: "Suspicious TLD link", message: "The response contains a link with a TLD commonly associated with spam or phishing.", severity: "HIGH", score: 40, redactionToken: "[REDACTED_SPAM_URL]" },

  // Known scam or temporary domain patterns
  { pattern: /https?:\/\/(?:[^\s\/]+\.)?(?:spamdomain|scamlink|phishy|malware-test)\.[a-z]+/i, label: "Known suspicious domain", message: "The response references a known suspicious or test domain.", severity: "HIGH", score: 40, redactionToken: "[REDACTED_SPAM_URL]" },

  // Prize/lottery scam language
  { pattern: /(?:you'?ve?\s+won|you\s+are\s+(?:the\s+)?(?:lucky\s+)?winner|claim\s+(?:your\s+)?prize|win(?:n?ing)?\s+(?:a\s+)?lottery|congratulations.*?(?:prize|winner|won)|inheritance.*?(?:claim|collect|transfer)|unclaimed\s+(?:funds?|prize|winnings?)|selected.*?(?:random|lucky).*?(?:winner|prize))/i, label: "Lottery or prize scam", message: "The response uses language consistent with lottery, prize, or inheritance scams.", severity: "HIGH", score: 40 },

  // "Click here" / "click the link" patterns with URLs
  { pattern: /(?:(?:click|tap|follow)\s+(?:here|this|the\s+link|on\s+the\s+link)|(?:visit|open)\s+(?:this\s+)?(?:site|page|link|url)|link\s+(?:is\s+)?(?:below|here)|click\s+(?:on\s+)?this\s+(?:link|url|site))\s*https?:\/\/[^\s'"<>)]*/i, label: "Solicited link click", message: "The response solicits clicking a link, which may be a phishing attempt.", severity: "HIGH", score: 40, redactionToken: "[REDACTED_SPAM_URL]" },

  // "Send money" / "wire transfer" / "advance fee" / "processing fee" scam language
  { pattern: /(?:advance\s+fee|wire\s+(?:transfer|money)|send\s+(?:us\s+)?(?:any\s+)?(?:money|payment|cash|fee|amount)|processing\s+fee.*?(?:release|claim|receive|identity|confirm)|pay\s+(?:a\s+)?small\s+fee|confirm\s+(?:your\s+)?(?:bank|account|credit\s+card))/i, label: "Advance-fee scam", message: "The response contains language consistent with advance-fee or wire-transfer scams.", severity: "HIGH", score: 40 },

  // Medical/dietary scam phrases common in spam
  { pattern: /(?:miracle\s+(?:cure|treatment|supplement)|lose\s+\d+\s+(?:lbs|kg|pounds)\s+in\s+\d+\s+(?:days?|weeks?)|(?:reverse|cure)\s+(?:diabetes|cancer)\s+(?:naturally|without\s+medication)|(?:herbal|natural)\s+(?:cure|remedy)\s+(?:for\s+)?(?:cancer|diabetes|hiv|aids))/i, label: "Medical scam", message: "The response uses language consistent with unsubstantiated medical or dietary scams.", severity: "HIGH", score: 40 },

  // Work-from-home / money-making scam phrases
  { pattern: /(?:work\s+(?:from\s+)?home\s+(?:and\s+)?(?:earn|make)\s+\$[\d,]+|(?:earn|make)\s+\$[\d,]+\s+(?:per|a|every)\s+(?:day|week|month)\s+(?:from\s+)?home|get\s+rich\s+quick|passive\s+income.*?(?:easy|guaranteed|instant)|(?:start|join)\s+(?:today|now).*?(?:earn|make)\s+[Mm]oney\s+(?:fast|quick|easily))/i, label: "Work-from-home scam", message: "The response uses language consistent with employment or money-making scams.", severity: "MEDIUM", score: 30 },
];

/**
 * Detects unsolicited promotional URLs and scam/phishing content in LLM output.
 * Registered for the OUTPUT direction in analyzeText.
 */
export function spamUrlDetector(text: string) {
  const findings = detectPatterns(text, "UNSAFE_OUTPUT", rules);

  // Additional heuristic: flag ANY URL if it's adjacent to known scam trigger words
  // and not already caught above. This catches novel scam domain patterns.
  const scamTriggers = /\b(?:lottery|prize|winner|inheritance|scam|phishing|click\s+here|claim\s+(?:your\s+)?reward|free\s+(?:gift|money|iphone|ipad|laptop)|unclaimed|selected\s+(?:as\s+)?(?:the\s+)?winner)\b/i;
  if (scamTriggers.test(text) && urlProtocolRe.test(text)) {
    const alreadyCaught = findings.some((f) => f.label === "Lottery or prize scam" || f.label === "Solicited link click");
    if (!alreadyCaught) {
      // Must use global flag for matchAll
      const urlRe = /https?:\/\/[^\s'"<>)]+/gi;
      for (const match of text.matchAll(urlRe)) {
        if (match.index === undefined) continue;
        findings.push({
          type: "UNSAFE_OUTPUT",
          label: "Unsolicited promotional URL",
          severity: "MEDIUM",
          score: 30,
          matched: match[0].slice(0, 120),
          message: "The response contains an unsolicited URL adjacent to scam-related language.",
          start: match.index,
          end: match.index + match[0].length,
          redactionToken: "[REDACTED_SPAM_URL]",
        });
        break;
      }
    }
  }

  return findings;
}
