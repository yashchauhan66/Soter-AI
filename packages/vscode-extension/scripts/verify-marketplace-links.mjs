#!/usr/bin/env node
// Checks that every outward link this extension publishes is actually alive.
//
// `src/__tests__/resource-links.test.ts` proves the three surfaces (manifest,
// README, Control Panel) agree with each other. Agreement is not reachability:
// all three can point in unison at a page that 404s. This script is the other
// half, and it is deliberately NOT a unit test — it needs the network, so it
// must never be able to fail a build offline.
//
//   node scripts/verify-marketplace-links.mjs
//
// Exit 0 = every link returned 2xx. Exit 1 = at least one is broken.
// A link that only resolves through a redirect passes but is reported, because
// a redirect today is a dead link the day the redirect is retired.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const readme = readFileSync(join(root, "README.md"), "utf8");

/** Every distinct URL the extension shows a user, with where it came from. */
function collectLinks() {
    const sources = new Map();
    const add = (url, origin) => {
        if (!url) return;
        const clean = url.replace(/\.git$/, "");
        sources.set(clean, [...(sources.get(clean) ?? []), origin]);
    };

    add(manifest.homepage, "package.json homepage");
    add(manifest.qna, "package.json qna");
    add(manifest.bugs?.url, "package.json bugs.url");
    add(manifest.repository?.url, "package.json repository.url");

    const header = readme.slice(0, readme.indexOf("## Features"));
    for (const [, label, url] of header.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g)) {
        add(url, `README "${label}"`);
    }
    return sources;
}

/**
 * HEAD first — cheap, and no page body is downloaded. Some hosts answer HEAD
 * with 403/405 while serving GET fine, so fall back rather than cry wolf.
 */
async function probe(url) {
    for (const method of ["HEAD", "GET"]) {
        try {
            const res = await fetch(url, { method, redirect: "manual" });
            if (method === "HEAD" && [403, 404, 405, 501].includes(res.status)) continue;
            const location = res.headers.get("location");
            return { status: res.status, method, location };
        } catch (error) {
            if (method === "GET") return { error: error.cause?.code ?? error.message };
        }
    }
    return { error: "unreachable" };
}

const links = collectLinks();
console.log(`Checking ${links.size} published links\n`);

const results = await Promise.all(
    [...links.entries()].map(async ([url, origins]) => ({ url, origins, ...(await probe(url)) })),
);

let broken = 0;
let redirected = 0;

for (const r of results.sort((a, b) => a.url.localeCompare(b.url))) {
    const ok = r.status >= 200 && r.status < 300;
    const isRedirect = r.status >= 300 && r.status < 400;
    if (isRedirect) redirected++;
    if (!ok && !isRedirect) broken++;

    const mark = ok ? "ok  " : isRedirect ? "->  " : "FAIL";
    const detail = r.error ? r.error : `${r.status}${r.location ? ` -> ${r.location}` : ""}`;
    console.log(`${mark} ${r.url}\n     ${detail}\n     from: ${r.origins.join(", ")}`);
}

console.log(
    `\n${links.size - broken}/${links.size} reachable` +
        (redirected ? `, ${redirected} via redirect` : ""),
);

if (redirected) {
    console.log(
        "Redirected links still work, but the redirect is someone else's to remove. " +
            "Prefer the final URL in the manifest and README.",
    );
}

if (broken) {
    console.error(
        `\n${broken} link(s) are broken. A dead "Report an issue" or "Support" link is ` +
            "worse than none: the user believes they have a route to help and does not.",
    );
    process.exit(1);
}
