import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DOCS_SECTIONS } from "../lib/docs/navigation";
import { SERVICES } from "../lib/docs/services";
import { getServiceExperience } from "../lib/docs/serviceExperience";
import { parseDocsIndex } from "../lib/docs/search";

const index = parseDocsIndex(JSON.parse(readFileSync("public/docs-search-index.json", "utf8")));

test("generated search contains the exact complete guide and service URL set", () => {
  assert.ok(index);
  const expected = [...DOCS_SECTIONS.flatMap((section) => section.pages.map((page) => page.href)), ...SERVICES.map((service) => `/docs/services/${service.id}`)].sort();
  assert.equal(expected.length, 53);
  assert.deepEqual(index.map((page) => page.href).sort(), expected);
});

test("every service is searchable by its visible operational guidance and real section targets", () => {
  assert.ok(index);
  for (const service of SERVICES) {
    const doc = index.find((page) => page.href === `/docs/services/${service.id}`);
    assert.ok(doc, service.id);
    const experience = getServiceExperience(service.id);
    assert.ok(doc.body.includes(experience.authentication.description), `${service.id}: authentication is missing from search`);
    for (const step of [...experience.setup, ...experience.validation]) assert.ok(doc.body.includes(step.body), `${service.id}: operational guidance is missing from search`);
    for (const limitation of experience.limitations) assert.ok(doc.body.includes(limitation), `${service.id}: limitations are missing from search`);
    for (const id of ["setup", "verification", "why", "how-it-works", "features", "integration", "limitations"]) {
      assert.ok(doc.headings.some((heading) => heading.id === id), `${service.id}: missing section target ${id}`);
    }
  }
});
