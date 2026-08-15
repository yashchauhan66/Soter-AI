#!/usr/bin/env node
// Compares the LIVE Marketplace listing against this working tree.
//
// This script exists because of a defect no other check could see. 0.4.0 was
// published from a stale tree: the repo held the saffron `Bestlogo.png`, the
// `#F96403` light banner, the renamed `Soter-AI` repository URL and a README
// opening with a Website / Docs / Support / Issue / Source link row — and the
// live listing carried the *previous* dark-navy logo, a `#0B1020` dark banner,
// the pre-rename `Ai-Security-Guard` URL and a README with no link row at all.
// Every unit test, host probe and packaging preflight passed, for six installs,
// because all of them look at the tree or the VSIX and none of them look at
// what the Marketplace is actually serving.
//
//   node scripts/verify-published-listing.mjs
//   node scripts/verify-published-listing.mjs --expect-published
//   node scripts/verify-published-listing.mjs --version 0.4.0
//
// Exit 0 = the live listing for this version matches the tree (or this version
// is not published yet, which is reported, not failed — see --expect-published).
// Exit 1 = the live listing drifted, or --expect-published and it is not live.
//
// Deliberately NOT a unit test: it needs the network, so it must never be able
// to fail a build offline.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const EXPECT_PUBLISHED = args.includes("--expect-published");
const WANT_VERSION = args[args.indexOf("--version") + 1];
const TARGET_VERSION = args.includes("--version") ? WANT_VERSION : null;

const here = dirname(fileURLToPath(import.meta.url));
const extensionRoot = join(here, "..");
const repoRoot = join(extensionRoot, "..", "..");
const manifest = JSON.parse(readFileSync(join(extensionRoot, "package.json"), "utf8"));
const readme = readFileSync(join(extensionRoot, "README.md"), "utf8");

const EXTENSION_ID = `${manifest.publisher}.${manifest.name}`;
const GALLERY = "https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery";

/** Asset types the gallery serves, and what each one is in the manifest. */
const ICON_ASSET = "Microsoft.VisualStudio.Services.Icons.Default";
const README_ASSET = "Microsoft.VisualStudio.Services.Content.Details";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

/** `repository.url` ships as `…​.git`; the gallery stores it without. */
const normaliseUrl = (url) => String(url ?? "").replace(/\.git$/, "").replace(/\/$/, "");

const checks = [];
/**
 * `blocking: false` records a fact worth printing that is not this tree's to
 * control — publisher domain verification, for instance, is a marketplace-side
 * review. Mixing those into the exit code would make the gate un-passable.
 */
const record = (name, pass, detail, blocking = true) => {
    checks.push({ name, pass, detail, blocking });
    const mark = pass ? "ok  " : blocking ? "FAIL" : "note";
    console.log(`${mark} ${name}\n     ${detail}`);
};

async function queryGallery() {
    const res = await fetch(GALLERY, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            // api-version 3.0-preview.1 is the one that returns per-version
            // `files` and `properties`; without it the response has neither.
            accept: "application/json;api-version=3.0-preview.1",
            "user-agent": "soterai-published-listing-parity",
        },
        body: JSON.stringify({
            filters: [{ criteria: [{ filterType: 7, value: EXTENSION_ID }], pageNumber: 1, pageSize: 1 }],
            // 471 = versions + files + version properties + statistics.
            flags: 471,
        }),
        signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`gallery query failed: HTTP ${res.status}`);
    const body = await res.json();
    const extension = body?.results?.[0]?.extensions?.[0];
    if (!extension) throw new Error(`${EXTENSION_ID} not found on the Marketplace`);
    return extension;
}

async function download(url) {
    const res = await fetch(url, {
        headers: { "user-agent": "soterai-published-listing-parity" },
        signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return Buffer.from(await res.arrayBuffer());
}

/** Version-scoped asset URL, preferring the one the API handed us. */
function assetUrl(version, assetType) {
    const fromApi = version.files?.find((f) => f.assetType === assetType)?.source;
    if (fromApi) return fromApi;
    return (
        `https://${manifest.publisher}.gallery.vsassets.io/_apis/public/gallery/publisher/` +
        `${manifest.publisher}/extension/${manifest.name}/${version.version}/assetbyname/${assetType}`
    );
}

const prop = (version, key) => version.properties?.find((p) => p.key === key)?.value;

/** The link row the README opens with — the exact thing 0.4.0 shipped without. */
function readmeHeaderLinks(markdown) {
    const cut = markdown.indexOf("## Features");
    const header = cut === -1 ? markdown : markdown.slice(0, cut);
    return [...header.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g)].map(([, label, url]) => ({ label, url }));
}

async function main() {
    console.log(`Comparing live Marketplace listing against the tree\n  extension: ${EXTENSION_ID}\n  tree version: ${manifest.version}\n`);

    const extension = await queryGallery();
    const versions = extension.versions ?? [];
    const latest = versions[0];

    console.log(
        `Live: ${versions.length} published version(s), latest ${latest?.version} ` +
            `(${latest?.lastUpdated}), ${extension.statistics?.find((s) => s.statisticName === "install")?.value ?? 0} installs\n`,
    );

    const wanted = TARGET_VERSION ?? manifest.version;
    const target = versions.find((v) => v.version === wanted);

    // Whether the tree's version is live at all decides what the rest of the run
    // *means*. Comparing the tree against a different published version would
    // report drift that publishing is supposed to introduce.
    const treeIsLive = Boolean(target);
    if (!treeIsLive) {
        const detail =
            `version ${wanted} is not on the Marketplace (latest live is ${latest?.version}). ` +
            `Comparing the tree against live ${latest?.version} below shows what publishing would change.`;
        record(`tree version ${wanted} is published`, false, detail, EXPECT_PUBLISHED);
    } else {
        record(`tree version ${wanted} is published`, true, `published ${target.lastUpdated}`);
    }

    const compareAgainst = target ?? latest;
    if (!compareAgainst) throw new Error("no published versions to compare against");
    // Drift against a version the tree was never meant to match is information,
    // not a failure; only same-version drift is a real defect.
    const blocking = treeIsLive;
    const scope = blocking ? "" : ` [informational: live ${compareAgainst.version} vs tree ${manifest.version}]`;

    // ── Icon ────────────────────────────────────────────────────────────────
    const localIconPath = join(extensionRoot, String(manifest.icon ?? ""));
    const localIcon = readFileSync(localIconPath);
    const liveIcon = await download(assetUrl(compareAgainst, ICON_ASSET));
    const localSha = sha256(localIcon);
    const liveSha = sha256(liveIcon);
    record(
        `marketplace icon bytes match ${manifest.icon}${scope}`,
        localSha === liveSha,
        localSha === liveSha
            ? `both ${localSha.slice(0, 16)}… (${localIcon.length} bytes)`
            : `tree ${localSha.slice(0, 16)}… (${localIcon.length} B) != live ${liveSha.slice(0, 16)}… (${liveIcon.length} B) ` +
              `— the listing is showing a different logo than this tree ships`,
        blocking,
    );

    // ── Gallery banner ──────────────────────────────────────────────────────
    for (const [key, expected, label] of [
        ["Microsoft.VisualStudio.Services.Branding.Color", manifest.galleryBanner?.color, "galleryBanner.color"],
        ["Microsoft.VisualStudio.Services.Branding.Theme", manifest.galleryBanner?.theme, "galleryBanner.theme"],
    ]) {
        const live = prop(compareAgainst, key);
        const ok = String(live ?? "").toLowerCase() === String(expected ?? "").toLowerCase();
        record(
            `${label} matches${scope}`,
            ok,
            ok ? `both ${live}` : `tree ${expected ?? "(unset)"} != live ${live ?? "(unset)"}`,
            blocking,
        );
    }

    // ── Outward links ───────────────────────────────────────────────────────
    for (const [key, expected, label] of [
        ["Microsoft.VisualStudio.Services.Links.Learn", manifest.homepage, "homepage -> Links.Learn"],
        ["Microsoft.VisualStudio.Services.Links.Source", manifest.repository?.url, "repository.url -> Links.Source"],
        ["Microsoft.VisualStudio.Services.Links.Support", manifest.bugs?.url, "bugs.url -> Links.Support"],
        ["Microsoft.VisualStudio.Services.CustomerQnALink", manifest.qna, "qna -> CustomerQnALink"],
    ]) {
        const live = prop(compareAgainst, key);
        const ok = normaliseUrl(live) === normaliseUrl(expected);
        record(
            `${label} matches${scope}`,
            ok,
            ok ? `both ${normaliseUrl(live)}` : `tree ${normaliseUrl(expected) || "(unset)"} != live ${normaliseUrl(live) || "(unset)"}`,
            blocking,
        );
    }

    // ── README link row ─────────────────────────────────────────────────────
    // Byte-comparing the README would cry wolf: `vsce` rewrites relative links
    // when it packages. What matters is that every link the tree's header
    // promises is present in what the Marketplace renders.
    const liveReadme = (await download(assetUrl(compareAgainst, README_ASSET))).toString("utf8");
    const expectedLinks = readmeHeaderLinks(readme);
    const missing = expectedLinks.filter(({ url }) => !liveReadme.includes(url));
    record(
        `published README carries all ${expectedLinks.length} header links${scope}`,
        expectedLinks.length > 0 && missing.length === 0,
        expectedLinks.length === 0
            ? "the tree's README has no header link row to check — that is itself the defect"
            : missing.length === 0
              ? `found: ${expectedLinks.map((l) => l.label).join(", ")}`
              : `absent from the live listing: ${missing.map((l) => `${l.label} (${l.url})`).join(", ")}`,
        blocking,
    );

    // ── Publisher domain (the visible website chip) ──────────────────────────
    // Not a manifest field: the chip a listing like Anthropic's shows next to the
    // publisher name comes from a verified domain, which is a marketplace-side
    // review. Reported, never blocking — no change to this tree can turn it green.
    const domain = extension.publisher?.domain;
    const verified = extension.publisher?.isDomainVerified === true;
    record(
        "publisher domain verified (renders the website chip)",
        verified,
        verified
            ? `${domain} verified`
            : `domain=${domain || "(unset)"} verified=false — set it at marketplace.visualstudio.com/manage and add the ` +
              `TXT record; run scripts/publisher-verification-preflight.mjs for the eligibility clocks`,
        false,
    );

    // ── Verdict ─────────────────────────────────────────────────────────────
    const blockingChecks = checks.filter((c) => c.blocking);
    const failed = blockingChecks.filter((c) => !c.pass);
    const drifted = checks.filter((c) => !c.pass && !c.blocking);
    console.log(
        blockingChecks.length
            ? `\n${blockingChecks.length - failed.length}/${blockingChecks.length} blocking checks pass`
            : `\nNo blocking checks in this run — nothing here can fail. ` +
              `${checks.length - drifted.length}/${checks.length} informational checks agree; ${drifted.length} differ.`,
    );

    if (failed.length) {
        console.error(
            `\nDRIFT — the live listing does not match this tree:\n` +
                failed.map((c) => `  - ${c.name}`).join("\n") +
                `\n\nThis is what a stale publish looks like. Package from a clean tree and republish.`,
        );
    } else if (!treeIsLive) {
        console.log(`\nPENDING — ${manifest.version} is not published yet. Re-run after publishing to gate it.`);
    } else {
        console.log(`\nMATCH — live ${compareAgainst.version} was built from this tree.`);
    }

    const outDir = join(repoRoot, "artifacts", "marketplace");
    mkdirSync(outDir, { recursive: true });
    const evidencePath = join(outDir, "published-listing-parity.json");
    writeFileSync(
        evidencePath,
        JSON.stringify(
            {
                generatedAt: new Date().toISOString(),
                extensionId: EXTENSION_ID,
                treeVersion: manifest.version,
                comparedAgainstVersion: compareAgainst.version,
                treeVersionIsPublished: treeIsLive,
                liveVersions: versions.map((v) => ({ version: v.version, lastUpdated: v.lastUpdated })),
                installs: extension.statistics?.find((s) => s.statisticName === "install")?.value ?? 0,
                publisherDomain: domain || null,
                publisherDomainVerified: verified,
                icon: { declared: manifest.icon, treeSha256: localSha, liveSha256: liveSha },
                checks,
                verdict: failed.length ? "DRIFT" : treeIsLive ? "MATCH" : "PENDING",
            },
            null,
            2,
        ),
    );
    console.log(`\nEvidence written to ${evidencePath}`);

    if (failed.length) process.exit(1);
}

main().catch((error) => {
    console.error(`\n${error.message}`);
    process.exit(1);
});
