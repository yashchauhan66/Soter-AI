import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { DOCS_SECTIONS } from "../../lib/docs/navigation";
import { SERVICES, SERVICE_GROUPS } from "../../lib/docs/services";
import { getServiceExperience } from "../../lib/docs/serviceExperience";
import { getDocsScope } from "../../lib/docs/scope";
import { parseDocsIndex, type DocsSearchDocument } from "../../lib/docs/search";
import { extractDocsText } from "./search-source";

const root = process.cwd();
const hash = createHash("sha256");
const read = (path: string) => {
  const source = readFileSync(resolve(root, path), "utf8");
  hash.update(path).update("\0").update(source).update("\0");
  return source;
};
for (const path of ["lib/docs/navigation.ts", "lib/docs/services.ts", "lib/docs/serviceExperience.ts", "lib/docs/scope.ts", "lib/docs/slug.ts", "scripts/docs/search-source.ts", "scripts/docs/build-search-index.ts"]) read(path);
const pages: DocsSearchDocument[] = DOCS_SECTIONS.flatMap((section) => section.pages.map((page) => {
  const extracted = extractDocsText(read(`app${page.href}/page.tsx`));
  return {
    href: page.href, title: page.label, section: section.label, kind: "guide" as const,
    summary: page.summary, body: `${extracted.body} ${(getDocsScope(page.href) ?? []).join(" ")}`.trim(),
    keywords: page.keywords ?? [], headings: extracted.headings,
  };
}));
const serviceTemplate = extractDocsText(read("app/docs/services/[id]/page.tsx"));
for (const service of SERVICES) {
  const experience = getServiceExperience(service.id);
  const steps = (rows: Array<{ heading: string; body: string }>) => rows.flatMap((row) => [row.heading, row.body]).join(" ");
  const sectionText: Record<string, string> = {
    "service-access": `${experience.authentication.label} ${experience.authentication.description} ${service.apiEndpoint ?? ""}`,
    setup: steps(experience.setup), verification: steps(experience.validation),
    why: service.whyMatters, "how-it-works": steps(service.howItWorks),
    features: service.features.flatMap((feature) => [feature.title, feature.description]).join(" "),
    integration: [service.apiEndpoint, ...experience.integrationNotes].filter(Boolean).join(" "),
    limitations: experience.limitations.join(" "),
    related: (service.relatedDocs ?? []).map((doc) => doc.label).join(" "),
  };
  pages.push({
    href: `/docs/services/${service.id}`, title: service.title,
    section: SERVICE_GROUPS.find((group) => group.id === service.group)?.label ?? "Services", kind: "service",
    summary: service.description,
    body: [service.longDescription, service.whyMatters, service.apiEndpoint,
      ...service.howItWorks.flatMap((step) => [step.heading, step.body]),
      ...service.features.flatMap((feature) => [feature.title, feature.description]),
      ...Object.values(sectionText)].filter(Boolean).join(" "),
    keywords: [service.id, service.apiEndpoint ?? "", experience.authentication.label],
    headings: serviceTemplate.headings
      .filter((heading) => heading.id !== "related" || !!service.relatedDocs?.length)
      .map((heading) => ({ ...heading, text: sectionText[heading.id] ?? heading.text })),
  });
}
const index = { version: 1, sourceHash: hash.digest("hex"), pageCount: pages.length, pages };
if (!parseDocsIndex(index)) throw new Error("Generated documentation index violates its runtime schema");
if (new Set(pages.map((page) => page.href)).size !== pages.length) throw new Error("Duplicate documentation URLs in search index");
const output = resolve(root, "public/docs-search-index.json");
const serialized = JSON.stringify(index);
if (process.argv.includes("--check")) {
  if (!existsSync(output) || readFileSync(output, "utf8") !== serialized) throw new Error("Docs search index is missing or stale. Run npm run docs:index.");
} else {
  writeFileSync(output, serialized);
}
console.log(JSON.stringify({ output, pages: pages.length, guides: pages.filter((page) => page.kind === "guide").length, services: pages.filter((page) => page.kind === "service").length, headingTargets: pages.reduce((sum, page) => sum + page.headings.length, 0), bytes: Buffer.byteLength(serialized), sourceHash: index.sourceHash, mode: process.argv.includes("--check") ? "checked" : "generated" }));
