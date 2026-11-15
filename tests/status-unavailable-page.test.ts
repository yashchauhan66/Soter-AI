import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import test from "node:test";
import { runInThisContext } from "node:vm";
import type { ReactNode } from "react";

// LOCAL FIXTURE ONLY: substitute the DB boundary, never the status component.
// No Prisma client, actual database, network, framework server, or browser is used.
// Real pinned TSX runs through TypeScript and the installed React server renderer.
const dependencyRoot = resolve(process.cwd());
const dependencyRequire = createRequire(resolve(dependencyRoot, "package.json"));
const ts = dependencyRequire("typescript") as typeof import("typescript");
const { renderToStaticMarkup } = dependencyRequire("react-dom/server") as typeof import("react-dom/server");
const testPath = resolve(dependencyRoot, "tests/status-unavailable-page.test.ts");
const sha256 = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");
const testSha256 = sha256(readFileSync(testPath));
const emittedPins = new Set<string>();

type Incident = {
  id: string;
  title: string;
  summary: string;
  status: string;
  affectedComponents: string[];
  updates: { id: string; createdAt: Date; message: string }[];
};
type StatusModule = {
  default: () => Promise<ReactNode>;
  metadata: unknown;
  dynamic: string;
};

function readPinnedSource(path: string, expectedHash?: string) {
  const bytes = readFileSync(path);
  const hash = sha256(bytes);
  if (expectedHash !== undefined) {
    assert.match(expectedHash, /^[a-f0-9]{64}$/, "source pin must be a raw SHA256");
    assert.equal(hash, expectedHash, "loader must consume the selected source bytes");
  }
  return { path, bytes, hash };
}

if (process.env.STATUS_PAGE_TEST_SOURCE) {
  assert.ok(process.env.STATUS_PAGE_TEST_SHA256, "an alternate source requires an explicit pin");
}
if (process.env.STATUS_PAGE_TEST_BASELINE) {
  assert.ok(process.env.STATUS_PAGE_TEST_BASELINE_SHA256, "an immutable baseline requires an explicit pin");
}
const currentSource = readPinnedSource(
  resolve(process.env.STATUS_PAGE_TEST_SOURCE ?? resolve(dependencyRoot, "app/status/page.tsx")),
  process.env.STATUS_PAGE_TEST_SHA256,
);
const baselineSource = process.env.STATUS_PAGE_TEST_BASELINE
  ? readPinnedSource(resolve(process.env.STATUS_PAGE_TEST_BASELINE), process.env.STATUS_PAGE_TEST_BASELINE_SHA256)
  : undefined;

function fixture(result: () => Promise<Incident[]>, source = currentSource) {
  const queries: unknown[] = [];
  const module = { exports: {} as StatusModule };
  const compiled = ts.transpileModule(source.bytes.toString("utf8"), {
    // The immutable raw snapshot has a neutral suffix outside router discovery.
    fileName: source.path + ".tsx",
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
    reportDiagnostics: true,
  });
  assert.equal(compiled.diagnostics?.length ?? 0, 0, "status TSX must compile in the local fixture");
  const localRequire = (id: string): unknown => {
    if (id === "@/lib/db") {
      return {
        db: {
          incident: {
            findMany(query: unknown) {
              queries.push(structuredClone(query));
              return result();
            },
          },
        },
      };
    }
    assert.ok(["react/jsx-runtime", "lucide-react"].includes(id), `unexpected status dependency: ${id}`);
    return dependencyRequire(id);
  };
  const execute = runInThisContext(`(function(exports, require, module) {${compiled.outputText}\n})`, {
    filename: source.path,
  });
  execute(module.exports, localRequire, module);
  const pinKey = source.path + source.hash;
  if (!emittedPins.has(pinKey)) {
    emittedPins.add(pinKey);
    console.log("STATUS_SOURCE_PIN " + JSON.stringify({
      path: source.path,
      raw_sha256: source.hash,
      compiled_sha256: sha256(compiled.outputText),
      test_path: testPath,
      test_sha256: testSha256,
      dependency_root: dependencyRoot,
      boundary: "local DB fixture only; actual status TSX and React SSR",
    }));
  }
  return {
    page: module.exports,
    queries,
    render: async () => renderToStaticMarkup(await module.exports.default()),
  };
}

const expectedQuery = {
  where: { public: true },
  include: { updates: { where: { public: true }, orderBy: { createdAt: "desc" } } },
  orderBy: { startedAt: "desc" },
  take: 20,
};
const visibleText = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const syntheticSecret = "STATUS_DB_SYNTHETIC_SECRET_DO_NOT_PUBLISH_07";
const syntheticError = () => new Error(
  `LOCAL TEST FIXTURE ONLY: DATABASE_URL=postgresql://fixture:${syntheticSecret}@database.invalid/status`,
);

for (const mode of ["synchronous throw", "rejected promise"] as const) {
  test(`DB ${mode} renders honest unavailable UI without exposing the error`, async () => {
    const loaded = fixture(() => {
      if (mode === "synchronous throw") throw syntheticError();
      return Promise.reject(syntheticError());
    });
    let html = "";
    await assert.doesNotReject(async () => {
      html = await loaded.render();
    }, "StatusPage must render unavailable instead of propagating the DB failure");
    assert.deepEqual(loaded.queries, [expectedQuery]);
    assert.match(html, /<main[\s>]/);
    assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1);
    assert.match(html, /<h1\b[^>]*>Status unavailable<\/h1>/);
    assert.match(visibleText(html), /unable to load service status/i);
    assert.match(visibleText(html), /try again later/i);
    assert.doesNotMatch(html, /operational|No public incidents reported|Service advisory in effect|\d+ ACTIVE/i);
    assert.doesNotMatch(html, /System components|Incident history/);
    for (const privateDetail of [syntheticSecret, "DATABASE_URL", "postgresql://", "database.invalid", "LOCAL TEST FIXTURE ONLY"]) {
      assert.ok(!html.includes(privateDetail), `unavailable HTML must not contain ${privateDetail}`);
    }
  });
}

async function successfulHtml(incidents: Incident[]) {
  const loaded = fixture(async () => incidents);
  const html = await loaded.render();
  assert.deepEqual(loaded.queries, [expectedQuery]);
  assert.doesNotMatch(html, /Status unavailable/);
  if (baselineSource) {
    const baseline = fixture(async () => incidents, baselineSource);
    assert.equal(html, await baseline.render(), "successful SSR must be byte-identical to the immutable original");
    assert.deepEqual(baseline.queries, [expectedQuery]);
  }
  return html;
}

test("successful empty results retain the existing operational and no-public-incidents UI", async () => {
  const html = await successfulHtml([]);
  assert.match(visibleText(html), /All published systems operational/);
  assert.match(visibleText(html), /OPERATIONAL/);
  assert.match(visibleText(html), /No public incidents reported\./);
  assert.equal((html.match(/>Operational<\/span>/g) ?? []).length, 6);
  assert.match(visibleText(html), /Integration status/);
  assert.match(visibleText(html), /n8n Community Node npm-ready/);
  assert.doesNotMatch(html, /Service advisory in effect/);
});

const activeIncident: Incident = {
  id: "local-fixture-active",
  title: "Fixture public active incident",
  summary: "Synthetic advisory for local regression only.",
  status: "INVESTIGATING",
  affectedComponents: ["API", "Guard API"],
  updates: [
    { id: "local-fixture-update-new", createdAt: new Date("2026-01-02T03:04:05Z"), message: "Fixture newest public update" },
    { id: "local-fixture-update-old", createdAt: new Date("2026-01-01T03:04:05Z"), message: "Fixture earlier public update" },
  ],
};
const resolvedIncident: Incident = {
  id: "local-fixture-resolved",
  title: "Fixture public resolved incident",
  summary: "Synthetic resolved incident for local regression only.",
  status: "RESOLVED",
  affectedComponents: ["Dashboard"],
  updates: [{ id: "local-fixture-resolution", createdAt: new Date("2026-01-01T03:04:05Z"), message: "Fixture public resolution" }],
};

test("successful active and resolved incidents retain advisories and ordered public history", async () => {
  const html = await successfulHtml([activeIncident, resolvedIncident]);
  const text = visibleText(html);
  assert.match(text, /Service advisory in effect/);
  assert.match(text, /1 ACTIVE/);
  assert.match(text, /API Advisory/);
  assert.match(text, /Guard API Advisory/);
  assert.match(text, /Dashboard Operational/);
  assert.equal((html.match(/>Operational<\/span>/g) ?? []).length, 4);
  assert.match(text, /Fixture public active incident INVESTIGATING/);
  assert.match(text, /Fixture public resolved incident RESOLVED/);
  assert.match(text, /Fixture public resolution/);
  assert.ok(html.indexOf(activeIncident.title) < html.indexOf(resolvedIncident.title));
  assert.ok(html.indexOf(activeIncident.updates[0].message) < html.indexOf(activeIncident.updates[1].message));
  assert.doesNotMatch(html, /All published systems operational|No public incidents reported/);
});

test("successful resolved-only results retain operational components and incident history", async () => {
  const html = await successfulHtml([resolvedIncident]);
  assert.match(visibleText(html), /All published systems operational/);
  assert.match(visibleText(html), /Fixture public resolved incident RESOLVED/);
  assert.match(visibleText(html), /Fixture public resolution/);
  assert.equal((html.match(/>Operational<\/span>/g) ?? []).length, 6);
  assert.doesNotMatch(html, /Service advisory in effect|No public incidents reported|\d+ ACTIVE/);
});

test("the DB query remains public-only for incidents and updates with exact ordering and take", async () => {
  const loaded = fixture(async () => []);
  await loaded.render();
  assert.deepEqual(loaded.queries, [expectedQuery]);
});

test("status metadata and force-dynamic behavior remain unchanged", () => {
  const loaded = fixture(async () => []);
  assert.deepEqual(loaded.page.metadata, {
    title: "Service Status",
    description: "SoterAI real-time service status and incident history. Check API, Guard API, Dashboard, and worker availability.",
    alternates: { canonical: "/status" },
  });
  assert.equal(loaded.page.dynamic, "force-dynamic");
  assert.deepEqual(loaded.queries, []);
});
