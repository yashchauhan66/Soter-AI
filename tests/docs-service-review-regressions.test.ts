import assert from "node:assert/strict";
import test from "node:test";
import { SERVICES } from "../lib/docs/services";
import { SERVICE_EXPERIENCE } from "../lib/docs/serviceExperience";

function serviceText(id: string): string {
  const service = SERVICES.find((entry) => entry.id === id);
  assert.ok(service, `Missing service ${id}`);
  assert.ok(SERVICE_EXPERIENCE[id], `Missing experience ${id}`);
  return JSON.stringify({
    description: service.description,
    longDescription: service.longDescription,
    whyMatters: service.whyMatters,
    howItWorks: service.howItWorks,
    features: service.features,
    experience: SERVICE_EXPERIENCE[id],
  });
}

test("SV-01 Red Team Lab distinguishes analyzer runs from project-policy coverage", () => {
  const text = serviceText("red-team-lab");
  assert.match(text, /does not load or apply ProjectPolicy/);
  assert.doesNotMatch(text, /project's Guard policy|policy regressions|after a policy change/);
});

test("SV-02 action integrations disclose the canonical Origin/Referer prerequisite", () => {
  const actionNotes = SERVICE_EXPERIENCE["agent-firewall"].integrationNotes.join(" ");
  assert.match(actionNotes, /Origin\/Referer[\s\S]*403/);
  for (const [id, experience] of Object.entries(SERVICE_EXPERIENCE)) {
    const endpoint = SERVICES.find((entry) => entry.id === id)?.apiEndpoint;
    if (experience.authentication.kind !== "api-key" || endpoint?.includes("/api/guard/")) continue;
    const notes = experience.integrationNotes.join(" ");
    assert.match(notes, /Origin\/Referer/, id);
    assert.match(notes, /403/, id);
  }
});

test("SV-03 service payload documentation uses the effective shared parser limits", () => {
  for (const id of ["canary-network", "semantic-egress", "transaction-escrow", "intent-guard", "dry-run-sandbox", "memory-firewall", "legal-boundary", "context-lineage"]) {
    const text = serviceText(id);
    assert.match(text, /10,000/, id);
    assert.match(text, /32,000 bytes/, id);
    assert.doesNotMatch(text, /(?:up to|limited to|is 1–) (?:20,000|50,000) characters/, id);
  }
});

test("SV-04 agent docs require issued passports and distinguish approval branches", () => {
  for (const id of ["agent-firewall", "agent-passports"]) {
    const text = serviceText(id);
    assert.match(text, /issued passport[\s\S]*sessionId[\s\S]*passportToken/, id);
    assert.match(text, /Passport-level ASK_APPROVAL creates no AgentApproval record or approval token/, id);
  }
});

test("SV-05 Forensics warns that historical summary reports may contain mixed-tenant evidence", () => {
  const text = serviceText("forensics");
  assert.match(text, /historical reports[\s\S]*mixed-tenant evidence/);
  assert.match(text, /Do not use Forensics with sensitive or multi-tenant data/);
  assert.doesNotMatch(text, /prefer the organization summary|Start with the summary view/);
});

test("SV-06 cost docs disclose accounting linkage and non-persisted response identifiers", () => {
  const text = serviceText("cost-firewall");
  assert.match(text, /budgetId/);
  assert.match(text, /returned transactionId is not assigned to the persisted transaction/);
  assert.match(text, /not represent this service as a guaranteed spending control/);
});

test("SV-07 audit docs distinguish manifest metadata from row-content integrity and delivery", () => {
  const text = serviceText("audit-exports");
  assert.match(text, /not individual row contents/);
  assert.match(text, /does not produce a downloadable file/);
  assert.match(text, /count, kind, organization, and generation time/);
});

test("SV-08 vault docs disclose length-dependent previews instead of unconditional secret safety", () => {
  const text = serviceText("credential-vault");
  assert.match(text, /Four-character secrets can appear in full/);
  assert.match(text, /one-to-three-character values can cause a preview error/);
  assert.doesNotMatch(text, /inspect safe metadata|preview rather than the full secret|list response does not contain encryptedSecret or the full secret/);
});

// Next source-review regression.
