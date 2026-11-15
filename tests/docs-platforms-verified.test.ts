import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import vm from "node:vm";

const slugs = ["wordpress", "whatsapp", "intercom", "zendesk", "botpress", "soterai-lite"] as const;
type Slug = (typeof slugs)[number];
const root = process.cwd();
const pages = Object.fromEntries(slugs.map((slug) => {
  const baseline = process.env.DOCS_PLATFORMS_BASELINE_ROOT;
  const file = baseline
    ? resolve(baseline, `app/docs/${slug}/page.tsx.baseline.txt`)
    : resolve(root, `app/docs/${slug}/page.tsx`);
  const bytes = readFileSync(file);
  console.log(`DOCS_SOURCE ${JSON.stringify({ slug, file, sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length })}`);
  return [slug, bytes.toString("utf8")];
})) as Record<Slug, string>;

function snippet(slug: Slug, name: string): string {
  const match = pages[slug].match(new RegExp("const " + name + " = (`(?:\\\\[\\s\\S]|[^`])*`);"));
  assert.ok(match, `${slug}: ${name} must be a copyable literal code example`);
  return vm.runInNewContext(match[1]) as string;
}

const preserved: Record<Slug, { headings: string[]; links: string[] }> = {
  wordpress: {
    headings: ["Step 1: Install the plugin", "Step 2: Configure settings", "Step 3: Use shortcodes", "Step 4: PHP integration (server-side)", "Step 5: Frontend via local proxy", "Troubleshooting"],
    links: ["/docs/generic-chatbot", "/docs/rest-api", "/docs/zendesk"],
  },
  whatsapp: {
    headings: ["Integration flow", "Environment", "API example", "India-specific PII detection"],
    links: ["/docs/zendesk", "/docs/rest-api", "/docs/intercom"],
  },
  intercom: {
    headings: ["Integration pattern", "Environment", "API usage (server-side)", "Best practices"],
    links: ["/docs/whatsapp", "/docs/rest-api", "/docs/botpress"],
  },
  zendesk: {
    headings: ["Integration pattern", "Environment", "API example", "Best practices"],
    links: ["/docs/wordpress", "/docs/rest-api", "/docs/whatsapp"],
  },
  botpress: {
    headings: ["How it works", "Environment", "Botpress workflow example"],
    links: [],
  },
  "soterai-lite": {
    headings: ["Protection scope", "Privacy and license documents", "Recovery and removal"],
    links: ["https://marketplace.visualstudio.com/items?itemName=soterai.soterai-ide-guard", "https://github.com/yashchauhan66/Soter-AI/issues"],
  },
};

for (const slug of slugs) {
  test(`${slug}: existing headings, shell and destinations remain reachable`, () => {
    for (const heading of preserved[slug].headings) assert.ok(pages[slug].includes(`>${heading}</DocsHeading>`), `missing existing heading: ${heading}`);
    for (const href of preserved[slug].links) assert.ok(pages[slug].includes(`href="${href}"`), `missing destination: ${href}`);
    assert.ok(pages[slug].includes(`<DocsPageShell path="/docs/${slug}">`));
    assert.ok(!pages[slug].includes("<h1"), "the shared shell owns the only H1");
  });
}

test("wordpress: PHP holds both directions on reported guard errors or denials", () => {
  const code = snippet("wordpress", "phpCode");
  for (const variable of ["in", "out"]) {
    assert.ok(code.includes(`$${variable}['error']`), `${variable}: check the helper's error flag; blocked alone can fail open`);
    assert.ok(code.includes(`$${variable}['blocked']`), `${variable}: hold a blocked result`);
  }
  assert.ok(!/\?\?\s*\$ai\b/.test(code), "an output failure must not fall back to the raw draft");
});

test("wordpress: frontend reads the actual shortcode config and never holds a SoterAI key", () => {
  const code = snippet("wordpress", "jsCode");
  assert.ok(code.includes(".soter-guard-config"), "read the plugin-generated nonce and route, not an undefined soterNonce global");
  assert.ok(code.includes("config.inputUrl") && code.includes("config.nonce"));
  assert.ok(code.includes("res.ok"), "local HTTP errors must be handled");
  assert.ok(!/x-api-key|ck_live_|SOTER_API_KEY/.test(code), "browser code may use only the local proxy nonce");
});

test("wordpress: setup discloses shipped package and proxy enforcement limits", () => {
  const source = pages.wordpress;
  for (const phrase of ["integrations/wordpress-plugin/soter-guard", "5.8", "7.4", "does not install a chatbot", "error flag", "both input and output", "not visitor authentication", "PHP helpers"]) {
    assert.ok(source.includes(phrase), `missing plugin-specific boundary: ${phrase}`);
  }
  assert.ok(source.includes("npm run package:wordpress"));
  assert.ok(source.includes("dist/soter-guard.zip"));
});

type Platform = "whatsapp" | "intercom" | "zendesk" | "botpress";
type Fixture = { body?: unknown; status?: number; networkError?: boolean; invalidJson?: boolean };
type Reply = { reply: string; blocked: boolean };
const allow = (safeText?: string): Fixture => ({ body: { allowed: true, action: "ALLOW", ...(safeText === undefined ? {} : { safeText }) } });

async function exercise(slug: Platform, fixtures: Fixture[], env: Record<string, string> = { SOTER_BASE_URL: "https://guard.example", SOTER_API_KEY: "unit-test-placeholder" }) {
  const requests: Array<{ url: string; body: Record<string, unknown>; headers: Record<string, string>; signal: unknown }> = [];
  const generated: string[] = [];
  const sent: string[] = [];
  const generate = async (text: string) => { generated.push(text); return "MODEL_DRAFT"; };
  const context = {
    process: { env }, AbortSignal,
    userMessage: "USER_INPUT", customerMessage: "USER_INPUT", ticketBody: "USER_INPUT",
    sender: "opaque-recipient", recipientId: "opaque-recipient", senderPhoneNumber: "legacy-phone",
    aiReply: "MODEL_DRAFT", aiDraft: "MODEL_DRAFT",
    generateReply: generate, callBotpressAgent: generate,
    sendWhatsAppReply: async (_recipient: string, text: string) => { sent.push(text); return { reply: text, blocked: false }; },
    fetch: async (url: string, init: { body: string; headers: Record<string, string>; signal?: unknown }) => {
      const item = fixtures[requests.length];
      requests.push({ url, body: JSON.parse(init.body), headers: init.headers, signal: init.signal });
      assert.ok(item, "the example issued an unexpected guard request");
      if (item.networkError) throw new Error("synthetic transport failure");
      const status = item.status ?? 200;
      return { ok: status >= 200 && status < 300, status, json: async () => {
        if (item.invalidJson) throw new SyntaxError("synthetic invalid JSON");
        return item.body;
      } };
    },
  };
  const code = snippet(slug, slug === "botpress" ? "workflowCode" : "apiCode");
  const outcome = await vm.runInNewContext(`(async () => {\n${code}\n})()`, context, { timeout: 1000 }) as Reply | undefined;
  return { outcome, requests, generated, sent };
}

function platformContract(slug: Platform) {
  const refused: Array<[string, Fixture]> = [
    ["BLOCK even with safeText", { body: { action: "BLOCK", allowed: false, safeText: "DO_NOT_FORWARD" } }],
    ["HUMAN_REVIEW even with safeText", { body: { action: "HUMAN_REVIEW", allowed: false, safeText: "DO_NOT_FORWARD" } }],
    ["allowed=false on ALLOW", { body: { action: "ALLOW", allowed: false, safeText: "DO_NOT_FORWARD" } }],
    ["unknown action", { body: { action: "UNKNOWN", allowed: true, safeText: "DO_NOT_FORWARD" } }],
    ["missing allowed", { body: { action: "ALLOW", safeText: "DO_NOT_FORWARD" } }],
    ["null response", { body: null }],
    ["redaction without replacement", { body: { action: "ALLOW_WITH_REDACTION", allowed: true } }],
    ["rewrite without replacement", { body: { action: "REWRITE", allowed: true } }],
    ["non-string replacement", { body: { action: "REWRITE", allowed: true, safeText: { value: "DO_NOT_FORWARD" } } }],
    ["empty replacement", { body: { action: "ALLOW_WITH_REDACTION", allowed: true, safeText: "" } }],
    ["HTTP 401", { status: 401, body: { error: "unauthorized" } }],
    ["HTTP 403", { status: 403, body: { action: "HUMAN_REVIEW", allowed: false } }],
    ["HTTP 429", { status: 429, ...allow("DO_NOT_FORWARD") }],
    ["HTTP 503", { status: 503, ...allow("DO_NOT_FORWARD") }],
    ["invalid JSON", { invalidJson: true }],
    ["transport failure", { networkError: true }],
  ];
  for (const stage of ["input", "output"] as const) {
    for (const [name, fixture] of refused) {
      test(`${slug}: ${stage} ${name} holds delivery`, async () => {
        let result: Awaited<ReturnType<typeof exercise>> | undefined;
        await assert.doesNotReject(async () => {
          result = await exercise(slug, stage === "input" ? [fixture, allow("CHECKED_REPLY")] : [allow("CHECKED_INPUT"), fixture]);
        }, "guard failures must return a fixed hold outcome, not escape or fall through");
        assert.ok(result);
        assert.ok(result.outcome, "the worker must return an explicit hold outcome");
        assert.equal(result.outcome.blocked, true, "denied/unavailable guard results must hold the reply");
        assert.equal(result.requests.length, stage === "input" ? 1 : 2, "do not continue past an input hold");
        assert.deepEqual(result.generated, stage === "input" ? [] : ["CHECKED_INPUT"]);
        assert.deepEqual(result.sent, [], "no provider delivery before an accepted output decision");
        assert.ok(!/DO_NOT_FORWARD|USER_INPUT|MODEL_DRAFT/.test(result.outcome.reply), "never surface original or denied text on a hold");
      });
    }
  }
  for (const action of ["ALLOW", "ALLOW_WITH_REDACTION", "REWRITE"]) {
    test(`${slug}: ${action} uses guarded text for generation and delivery`, async () => {
      const result = await exercise(slug, [
        { body: { allowed: true, action, safeText: "CHECKED_INPUT" } },
        { body: { allowed: true, action, safeText: "CHECKED_REPLY" } },
      ]);
      assert.deepEqual(result.generated, ["CHECKED_INPUT"]);
      assert.equal(result.outcome?.blocked, false);
      assert.equal(result.outcome?.reply, "CHECKED_REPLY");
      assert.equal(result.requests[0].url, "https://guard.example/api/guard/input");
      assert.deepEqual(result.requests[0].body, { message: "USER_INPUT" });
      assert.deepEqual(result.requests[1].body, { aiResponse: "MODEL_DRAFT" });
      for (const request of result.requests) {
        assert.equal(request.headers["x-api-key"], "unit-test-placeholder");
        assert.ok(request.signal, "guard fetches need a bounded timeout");
      }
    });
  }
  test(`${slug}: explicit ALLOW may preserve the original when safeText is absent`, async () => {
    const result = await exercise(slug, [allow(), allow()]);
    assert.deepEqual(result.generated, ["USER_INPUT"]);
    assert.equal(result.outcome?.reply, "MODEL_DRAFT");
    assert.equal(result.outcome?.blocked, false);
  });
  test(`${slug}: redactedText is accepted without a raw-text fallback`, async () => {
    const result = await exercise(slug, [
      { body: { allowed: true, action: "ALLOW_WITH_REDACTION", redactedText: "CHECKED_INPUT" } },
      { body: { allowed: true, action: "REWRITE", redactedText: "CHECKED_REPLY" } },
    ]);
    assert.deepEqual(result.generated, ["CHECKED_INPUT"]);
    assert.equal(result.outcome?.reply, "CHECKED_REPLY");
    assert.equal(result.outcome?.blocked, false);
  });
  test(`${slug}: missing server credentials stops before a request`, async () => {
    const result = await exercise(slug, [allow(), allow()], {});
    assert.equal(result.requests.length, 0);
    assert.equal(result.outcome?.blocked, true);
  });
  test(`${slug}: HTTP environment and integration scope are explicit`, () => {
    const source = pages[slug];
    for (const term of ["server-side integration pattern", "not a native", "SOTER_BASE_URL=https://api.soterai.in", "server-side", "HUMAN_REVIEW"]) {
      assert.ok(source.includes(term), `${slug}: missing scope/setup requirement: ${term}`);
    }
    assert.ok(!source.includes("SOTER_BASE_URL is optional"), "raw fetch needs an explicit base URL");
    assert.ok(!source.includes("Store only the public guard result"), "publicResult only strips originalText, not all sensitive fields");
  });
}

platformContract("whatsapp");

test("whatsapp: webhook verification, recipient privacy and PII limits are documented", () => {
  for (const term of ["X-Hub-Signature-256", "app secret", "raw body", "verification token", "deduplicate", "opaque", "Aadhaar-like", "not identity verification", "context"])
    assert.ok(pages.whatsapp.includes(term), `missing WhatsApp boundary: ${term}`);
  assert.ok(!snippet("whatsapp", "apiCode").includes("senderPhoneNumber"), "do not send phone numbers as trace identifiers");
  assert.ok(!pages.whatsapp.includes("automatically detects and redacts"), "redaction depends on decisions and policy, not universal identity detection");
});

platformContract("intercom");

test("intercom: signed notification scope does not imply native Fin interception or safe full-result logs", () => {
  for (const term of ["X-Hub-Signature", "HMAC-SHA1", "client secret", "raw body", "deduplicate", "Fin", "metadata", "not a compliance certificate"])
    assert.ok(pages.intercom.includes(term), `missing Intercom boundary: ${term}`);
  assert.ok(!pages.intercom.includes("Store only redacted/guarded text in audit logs"), "guarded text is not a guarantee of secret-free logging");
});

platformContract("zendesk");

test("zendesk: signatures include timestamp, raw body and explicit publish ownership", () => {
  for (const term of ["X-Zendesk-Webhook-Signature", "X-Zendesk-Webhook-Signature-Timestamp", "HMAC-SHA256", "base64", "timestamp", "raw body", "deduplicate", "ticket", "metadata"])
    assert.ok(pages.zendesk.includes(term), `missing Zendesk boundary: ${term}`);
  assert.ok(!pages.zendesk.includes("Store only redacted/guarded text in audit logs"), "log decision metadata, not potentially sensitive text");
});

platformContract("botpress");

test("botpress: Node worker is not presented as a portable native action or automatic flow control", () => {
  for (const term of ["Node.js", "Webchat", "authenticated", "branch", "metadata", "runtime", "workflow"])
    assert.ok(pages.botpress.includes(term), `missing Botpress boundary: ${term}`);
  assert.ok(!pages.botpress.includes("// In your Botpress action or hook"), "do not assume Node process.env is available in every Botpress runtime");
});

test("soterai-lite: local-default example matches actual machine settings", () => {
  const settings = JSON.parse(snippet("soterai-lite", "settingsCode")) as Record<string, unknown>;
  const pkg = JSON.parse(readFileSync(resolve(root, "packages/soterai-lite/package.json"), "utf8"));
  const properties = pkg.contributes.configuration.properties;
  const expected = ["soterai.cloud.enabled", "soterai.privacyMode", "soterai.scan.remoteEscalation", "soterai.telemetry.redactedEvents", "soterai.audit.storeRawPrompts", "soterai.dependencyGuard.osvMode"];
  assert.deepEqual(Object.keys(settings).sort(), expected.sort());
  for (const [key, value] of Object.entries(settings)) {
    assert.equal(value, properties[key].default, `${key}: document the shipped default, not a guessed privacy setting`);
    assert.equal(properties[key].scope, "machine");
  }
});

test("soterai-lite: setup identifies candidate, target and only registered commands", () => {
  const source = pages["soterai-lite"];
  const pkg = JSON.parse(readFileSync(resolve(root, "packages/soterai-lite/package.json"), "utf8"));
  for (const term of ["packages/soterai-lite", "0.7.0", "win32-x64", "^1.85.0", "Install from VSIX", "not every Marketplace version", "not an OS sandbox"])
    assert.ok(source.includes(term), `missing exact-package scope: ${term}`);
  for (const title of ["Open Control Panel", "Run Safe Demo Scan", "Show AI Route Coverage", "Complete Safe Vault Recovery", "Restore File From Encrypted Backup", "Restore Broker Integration"]) {
    assert.ok(pkg.contributes.commands.some((command: { title: string }) => command.title === title), `command not registered: ${title}`);
    assert.ok(source.includes(title), `missing actionable package command: ${title}`);
  }
});

test("soterai-lite: local defaults do not promise zero network or automatic recovery", () => {
  for (const term of ["does not disable provider traffic", "OSV", "SecretStorage", "same-user", "not automatically restore", "explicit disclosure", "does not register", "not proof", "keys"])
    assert.ok(pages["soterai-lite"].includes(term), `missing Lite boundary: ${term}`);
  assert.ok(!pages["soterai-lite"].includes("Review and use Restore changes before uninstalling"), "do not instruct a general removal command absent from this source snapshot");
});

test("soterai-lite: license scope and all three reference downloads stay explicit", () => {
  const source = pages["soterai-lite"];
  for (const term of ["Business Source License 1.1", "internal production use within a single entity", "competing", "2030-06-25", "versioned reference copies", "archived 0.7.0 reference", "build-specific notices"]) {
    assert.ok(source.includes(term), `missing licensing/package-document qualification: ${term}`);
  }
  const files = [...source.matchAll(/file: "([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(files.sort(), ["LICENSE.md", "PRIVACY.md", "THIRD-PARTY-NOTICES.md"].sort());
  assert.ok(source.includes("href={`/soterai-lite/0.7.0/${document.file}`}"));
  for (const file of files) {
    const published = readFileSync(resolve(root, "public/soterai-lite/0.7.0", file));
    if (file === "THIRD-PARTY-NOTICES.md") {
      // Notices are generated per build, not a package-root source document.
      assert.match(published.toString("utf8"), /^# Third-party notices/);
      assert.match(published.toString("utf8"), /License: MIT/);
    } else {
      const packageDocument = readFileSync(resolve(root, "packages/soterai-lite", file));
      assert.ok(published.equals(packageDocument), `${file}: the versioned website copy diverged from the source document`);
    }
  }
});

for (const slug of slugs) {
  test(`${slug}: inline terms retain word separation in JSX prose`, () => {
    const paragraphs = [...pages[slug].matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)].map((match) => match[1]);
    for (const paragraph of paragraphs) {
      assert.ok(!/[\w.]\r?\n\s*<(?:InlineCode|strong)\b/.test(paragraph), "JSX drops newlines before inline terms; preserve an explicit space");
      assert.ok(!/<\/(?:InlineCode|strong)>\r?\n\s*[A-Za-z]/.test(paragraph), "JSX drops newlines after inline terms; preserve an explicit space");
      assert.ok(!/\]<\/a>\r?\n\s*[A-Za-z]/.test(paragraph), "separate citation links from the following sentence");
    }
  });
}

for (const slug of ["wordpress", "whatsapp", "intercom", "zendesk"] as const) {
  test(`${slug}: related guides do not contradict the shared canonical pager`, () => {
    assert.ok(!/<Link[^>]*>← |<Link[^>]*>[^<]* →<\/Link>/.test(pages[slug]), "the obsolete page-level previous/next labels contradict the shared navigation order");
    assert.ok(pages[slug].includes("<DocsHeading>What&apos;s next?</DocsHeading>"), "the retained related-guides heading needs an anchor");
  });
}
