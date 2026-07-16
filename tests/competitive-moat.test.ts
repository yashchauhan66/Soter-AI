import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  COMPETITIVE_BATTLECARDS,
  SOTER_DEFENSIBLE_MOATS,
  approvedCompetitiveClaim,
  scoreCompetitiveMoat,
} from "../lib/enterprise/competitiveMoat";

test("competitive moat covers named enterprise competitors and categories", () => {
  const score = scoreCompetitiveMoat();
  assert.ok(score.namedCompetitors >= 12, `expected at least 12 named competitors, got ${score.namedCompetitors}`);
  for (const name of [
    "Lakera / Check Point",
    "HiddenLayer",
    "Protect AI / Palo Alto",
    "Prompt Security / SentinelOne",
    "AWS Bedrock Guardrails",
    "NVIDIA NeMo Guardrails",
    "Guardrails AI",
    "Galileo / Arthur / Patronus",
  ]) {
    assert.ok(COMPETITIVE_BATTLECARDS.some((card) => card.name === name), `${name} missing`);
  }
});

test("competitive moat is 95 plus without allowing unsupported hard claims", () => {
  const score = scoreCompetitiveMoat();
  assert.ok(score.score >= 95, `expected 95+ internal competitive readiness, got ${score.score}`);
  assert.equal(score.grade, "MARKET_LEADING_INTERNAL_READINESS");
  assert.equal(score.hardClaimAllowed, false);
});

test("battlecards include honest where-they-win caveats and proof gates", () => {
  for (const card of COMPETITIVE_BATTLECARDS) {
    assert.ok(card.whereTheyWin.length >= 2, `${card.name} needs honest competitor strengths`);
    assert.ok(card.whereSoterWins.length >= 2, `${card.name} needs Soter edges`);
    assert.ok(card.proofRequiredBeforeAggressiveClaim.length >= 2, `${card.name} needs proof gates`);
  }
});

test("Soter moat list is broad enough for differentiated positioning", () => {
  assert.ok(SOTER_DEFENSIBLE_MOATS.length >= 7);
  assert.ok(SOTER_DEFENSIBLE_MOATS.some((moat) => /agent firewall/i.test(moat)));
  assert.ok(SOTER_DEFENSIBLE_MOATS.some((moat) => /India-specific PII/i.test(moat)));
  assert.ok(SOTER_DEFENSIBLE_MOATS.some((moat) => /proof kit/i.test(moat)));
});

test("approved claim stays evidence-gated and does not say best overall", () => {
  const claim = approvedCompetitiveClaim();
  assert.match(claim, /market-leading internal competitive readiness/i);
  assert.match(claim, /honest caveats/i);
  assert.doesNotMatch(claim, /best in (the )?market|beats every|#1|guaranteed/i);
});

test("competitive docs contain updated 95 plus internal readiness language", () => {
  const doc = readFileSync("docs/competitive-readiness.md", "utf8");
  assert.match(doc, /95\+ internal competitive readiness/i);
  assert.match(doc, /not an independent market-leader certification/i);
  assert.match(doc, /battlecards/i);
});
