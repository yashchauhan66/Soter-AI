/**
 * The links a user can reach SoterAI through: the Marketplace listing sidebar
 * (built from `homepage` / `qna` / `bugs` / `repository`), the README header,
 * and the Control Panel footer inside the editor.
 *
 * These three surfaces are edited in three different places and drift silently.
 * A dead "Report an issue" link is worse than no link: the user believes they
 * have a route to support and does not.
 *
 * Reachability is NOT asserted here — a unit test must not depend on the
 * network. `scripts/verify-marketplace-links.mjs` does the live HTTP check.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const extensionRoot = join(__dirname, "..", "..");
const manifest = JSON.parse(readFileSync(join(extensionRoot, "package.json"), "utf8"));
const readme = readFileSync(join(extensionRoot, "README.md"), "utf8");
const providerSrc = readFileSync(
    join(extensionRoot, "src/webview/ControlPanelViewProvider.ts"),
    "utf8",
);

/** Manifest fields VS Code turns into the listing's Resources sidebar. */
const listingLinks: Record<string, string | undefined> = {
    homepage: manifest.homepage,
    qna: manifest.qna,
    "bugs.url": manifest.bugs?.url,
    "repository.url": manifest.repository?.url,
};

/**
 * The provider's hardcoded destination table, read from the real source.
 *
 * Anchored on the declaration rather than on an occurrence index, so adding
 * another mention of RESOURCE_LINKS elsewhere in the file cannot silently
 * shift which block gets parsed.
 */
function resourceLinkUrls(): string[] {
    const start = providerSrc.indexOf("RESOURCE_LINKS: Record<");
    assert.ok(start > -1, "could not find the RESOURCE_LINKS declaration in the provider");
    const body = providerSrc.slice(start, providerSrc.indexOf("};", start));
    return [...body.matchAll(/url: "([^"]+)"/g)].map((m) => m[1]);
}

describe("marketplace listing links", () => {
    it("declares every field the listing sidebar renders", () => {
        for (const [field, value] of Object.entries(listingLinks)) {
            assert.ok(value, `${field} is missing — the listing drops that sidebar link`);
        }
    });

    it("uses https everywhere, so no link downgrades the connection", () => {
        for (const [field, value] of Object.entries(listingLinks)) {
            assert.ok(
                value!.startsWith("https://"),
                `${field} is not https: ${value}`,
            );
        }
    });

    it("points its own links at the apex domain the publisher verifies", () => {
        // Domain verification is granted per apex domain. A homepage on a
        // subdomain would not be covered by the `soterai.in` TXT record.
        for (const field of ["homepage", "qna"] as const) {
            const host = new URL(listingLinks[field]!).host;
            assert.strictEqual(
                host,
                "soterai.in",
                `${field} host is ${host}; verification covers the apex domain only`,
            );
        }
    });

    it("keeps the repository and issue links on the same repo", () => {
        const repo = manifest.repository.url.replace(/\.git$/, "");
        assert.ok(
            manifest.bugs.url.startsWith(repo),
            `bugs.url (${manifest.bugs.url}) is not under repository.url (${repo})`,
        );
    });
});

describe("README links header", () => {
    const linkRow = readme.slice(0, readme.indexOf("## Features"));
    const links = new Map(
        [...linkRow.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g)].map((m) => [m[1], m[2]]),
    );

    it("offers a way to the site, the docs, support, and the issue tracker", () => {
        for (const label of ["Website", "Docs", "Support", "Report an issue", "Source"]) {
            assert.ok(links.has(label), `README header has no "${label}" link`);
        }
    });

    it("agrees with the manifest instead of drifting from it", () => {
        assert.strictEqual(links.get("Docs"), manifest.homepage);
        assert.strictEqual(links.get("Support"), manifest.qna);
        assert.strictEqual(links.get("Report an issue"), manifest.bugs.url);
        assert.strictEqual(links.get("Source"), manifest.repository.url.replace(/\.git$/, ""));
    });

    it("uses https so the marketplace page never links out over http", () => {
        for (const [label, url] of links) {
            assert.ok(url.startsWith("https://"), `README "${label}" is not https: ${url}`);
        }
    });
});

describe("Control Panel resource links", () => {
    const actions = ["action:openWebsite", "action:openDocs", "action:reportIssue"];

    it("allowlists every link action, or the button is dead", () => {
        for (const action of actions) {
            assert.ok(
                providerSrc.includes(`"${action}",`),
                `${action} is rendered but not in the provider's ALLOWED set`,
            );
        }
    });

    it("takes the destination from the hardcoded table, never from the message", () => {
        // The security property: a compromised webview can pick which of three
        // fixed URLs opens, and cannot supply a URL of its own.
        assert.match(
            providerSrc,
            /const link = ControlPanelViewProvider\.RESOURCE_LINKS\[type\]/,
            "the handler must resolve the URL from RESOURCE_LINKS",
        );
        assert.ok(
            !/openExternal\(vscode\.Uri\.parse\((?!link\.url)/.test(providerSrc),
            "openExternal must only ever receive a URL from RESOURCE_LINKS",
        );
    });

    it("opens only https destinations already named in the README", () => {
        const urls = resourceLinkUrls();
        assert.strictEqual(urls.length, actions.length, `expected ${actions.length} link URLs, found ${urls.length}`);
        for (const url of urls) {
            assert.ok(url.startsWith("https://"), `panel link is not https: ${url}`);
            assert.ok(
                readme.includes(url),
                `the panel opens ${url}, which the README never mentions`,
            );
        }
    });
});
