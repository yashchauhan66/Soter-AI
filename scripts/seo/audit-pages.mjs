#!/usr/bin/env node
/**
 * Public-page SEO and trust audit.
 *
 * Fetches pages from a running site and checks what a crawler or an AI fetcher
 * sees in the server HTML: status, title and description length, exactly one H1
 * that is not inside a hidden streamed block, canonical, robots, language, Open
 * Graph, JSON-LD that parses with the fields it needs, banned or unsupported
 * phrases, and (with --links) that every internal link resolves.
 *
 * Usage:
 *   node scripts/seo/audit-pages.mjs                       # pages from /sitemap.xml
 *   node scripts/seo/audit-pages.mjs --base http://localhost:3100
 *   node scripts/seo/audit-pages.mjs --paths /,/pricing,/playground
 *   node scripts/seo/audit-pages.mjs --links               # also check internal links
 *   node scripts/seo/audit-pages.mjs --json out.json       # write a machine-readable report
 *
 * Exit code 1 if any check fails.
 */
import { writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true;
};
const BASE = String(opt('base', 'https://soterai.in')).replace(/\/$/, '');
const CANONICAL_HOST = 'https://soterai.in';
const CHECK_LINKS = args.includes('--links');
const JSON_OUT = opt('json', null);
const CONCURRENCY = Number(opt('concurrency', 4));
const TITLE_MAX = 60;
const DESC_MAX = 155;

// Phrases the brief bans, plus claims the claims register does not allow.
const BANNED = [
  'revolutionary', 'next-gen', 'military-grade', 'unhackable', '100% secure', 'cutting-edge',
  'seamless', 'game-changing', 'ai-powered', 'world-class', 'best-in-class', 'state-of-the-art',
  'risk-free', 'under 50 ms', 'under 50ms', 'under 50 milli', 'sub-50', '<50ms', '<50 ms',
  'single-digit', 'trusted by', 'most popular', 'soc 2 certified', 'iso 27001 certified',
  'dpdp compliant', 'gdpr compliant',
];

// Pages that are meant to be noindex.
const NOINDEX = new Set(['/signin', '/signup', '/forgot-password', '/reset-password', '/verify-email', '/design-system']);

const decode = (s) =>
  s.replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const strip = (h) =>
  decode(h.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));

async function get(url, init) {
  const res = await fetch(url, { redirect: 'manual', ...init });
  return res;
}

async function pathsFromSitemap() {
  const res = await get(`${BASE}/sitemap.xml`);
  if (res.status !== 200) throw new Error(`sitemap.xml returned ${res.status}`);
  const xml = await res.text();
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  // A sitemap index lists child sitemaps; follow them one level.
  if (/<sitemapindex/.test(xml)) {
    const out = [];
    for (const loc of locs) {
      const child = await (await get(loc.replace(CANONICAL_HOST, BASE))).text();
      out.push(...[...child.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));
    }
    return [...new Set(out)].map((u) => new URL(u).pathname);
  }
  return [...new Set(locs)].map((u) => new URL(u).pathname);
}

function checkJsonLd(html, path, fail) {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const nodes = [];
  for (const b of blocks) {
    try {
      const parsed = JSON.parse(b);
      for (const n of Array.isArray(parsed) ? parsed : parsed['@graph'] ? parsed['@graph'] : [parsed]) nodes.push(n);
    } catch (e) {
      fail(`JSON-LD block does not parse: ${String(e).slice(0, 80)}`);
    }
  }
  const types = nodes.map((n) => n['@type']).flat();
  for (const n of nodes) {
    const t = [n['@type']].flat();
    if (t.includes('FAQPage')) {
      const visible = strip(html);
      for (const q of n.mainEntity ?? []) {
        const name = q.name;
        const text = q.acceptedAnswer?.text;
        if (!name || !text) fail('FAQPage question without name or answer text');
        else if (!visible.includes(name) || !visible.includes(text.replace(/\s+/g, ' '))) fail(`FAQPage text not visible on the page: "${name.slice(0, 50)}"`);
      }
    }
    if (t.includes('BreadcrumbList')) {
      for (const it of n.itemListElement ?? []) {
        if (!it.name || !it.item) fail('BreadcrumbList item without name or item');
      }
    }
    if (t.includes('SoftwareApplication') || t.includes('Product')) {
      const offers = [n.offers].flat().filter(Boolean);
      for (const o of offers) {
        if (o.price !== undefined && !/^\d+(\.\d+)?$/.test(String(o.price))) fail(`Offer price is not numeric: ${o.price}`);
        if ((o.price !== undefined || o.lowPrice !== undefined) && o.priceCurrency !== 'INR') fail(`Offer currency is ${o.priceCurrency}, expected INR`);
      }
    }
    if (t.includes('Organization') && !(n.sameAs?.length > 0)) fail('Organization without sameAs');
  }
  return { count: blocks.length, types: [...new Set(types)] };
}

function h1InHiddenStream(prefix) {
  const source = prefix.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
  const stack = [];
  const voids = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
  const tags = source.matchAll(/<(\/?)([a-z][a-z0-9:-]*)\b(?:"[^"]*"|'[^']*'|[^'">])*?>/gi);
  for (const match of tags) {
    const tag = match[2].toLowerCase();
    if (match[1]) {
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].tag === tag) { stack.splice(i); break; }
      }
    } else if (!voids.has(tag) && !/\/\s*>$/.test(match[0])) {
      stack.push({ tag, stream: /\shidden(?:\s|=|>)/i.test(match[0]) && /\bid=["']S:\d+["']/i.test(match[0]) });
    }
  }
  return stack.some((node) => node.stream);
}

async function auditPage(path) {
  const failures = [];
  const warnings = [];
  const fail = (m) => failures.push(m);
  const warn = (m) => warnings.push(m);
  const res = await get(BASE + path);
  const status = res.status;
  if (status >= 300 && status < 400) {
    return { path, status, redirect: res.headers.get('location'), failures: [`in sitemap but redirects (${status})`], warnings, info: {} };
  }
  if (status !== 200) return { path, status, failures: [`status ${status}`], warnings, info: {} };
  const html = await res.text();

  const title = decode((html.match(/<title>([^<]*)<\/title>/) || [])[1] || '');
  const desc = decode((html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '');
  const h1Matches = [...html.matchAll(/<h1[\s>]/g)];
  const canonical = (html.match(/<link rel="canonical" href="([^"]*)"/) || [])[1] || '';
  const robotsMeta = (html.match(/<meta name="robots" content="([^"]*)"/) || [])[1] || '';
  const lang = (html.match(/<html[^>]*\slang="([^"]*)"/) || [])[1] || '';
  const ogTitle = /<meta property="og:title"/.test(html);
  const ogImage = /<meta property="og:image"/.test(html);
  const twitter = /<meta name="twitter:card"/.test(html);

  if (!title) fail('missing <title>');
  else if (title.length > TITLE_MAX) fail(`title is ${title.length} characters (max ${TITLE_MAX}): ${title}`);
  if (!desc) fail('missing meta description');
  else if (desc.length > DESC_MAX) fail(`description is ${desc.length} characters (max ${DESC_MAX})`);
  else if (desc.length < 70) warn(`description is short (${desc.length})`);
  if (h1Matches.length !== 1) fail(`${h1Matches.length} H1 elements (want exactly 1)`);
  // The H1 must not sit after a hidden streamed block opens (React Suspense output).
  if (h1Matches[0] && h1InHiddenStream(html.slice(0, h1Matches[0].index))) fail('H1 is inside a hidden streamed block');
  if (/animate-pulse/.test(html.slice(0, (h1Matches[0]?.index ?? html.length)))) warn('a loading skeleton appears before the H1');
  const wantCanonical = CANONICAL_HOST + (path === '/' ? '' : path);
  const gotCanonical = canonical.replace(/\/$/, '');
  if (!NOINDEX.has(path)) {
    if (!canonical) fail('missing canonical');
    else if (gotCanonical !== wantCanonical && gotCanonical !== wantCanonical.replace(/\/$/, '')) fail(`canonical is ${canonical}, expected ${wantCanonical}`);
    if (/noindex/i.test(robotsMeta)) fail(`robots meta is "${robotsMeta}"`);
  }
  if (lang !== 'en-IN') fail(`html lang is "${lang}", expected en-IN`);
  if (!ogTitle || !ogImage) warn('missing og:title or og:image');
  if (!twitter) warn('missing twitter:card');

  const ld = checkJsonLd(html, path, fail);
  if (ld.count === 0) warn('no JSON-LD on the page');

  const text = strip(html).toLowerCase();
  // A phrase inside a denial is a limit, not a claim: "does not make a deployment SOC 2
  // certified", "no tool is risk-free". Skip an occurrence when a negation sits in the 60
  // characters before it. Every other occurrence still fails.
  const NEGATION = /\b(not|no|never|none|without|cannot|can't|isn't|aren't|doesn't|don't|n't)\b/;
  const claimed = (phrase) => {
    let from = 0;
    for (;;) {
      const i = text.indexOf(phrase, from);
      if (i === -1) return false;
      if (!NEGATION.test(text.slice(Math.max(0, i - 60), i))) return true;
      from = i + phrase.length;
    }
  };
  const hits = BANNED.filter((b) => claimed(b));
  if (hits.length) fail(`banned or unsupported phrase: ${hits.join(', ')}`);

  const links = [...html.matchAll(/<a\s[^>]*href="(\/[^"#?]*)(?:[?#][^"]*)?"/g)].map((m) => m[1]);
  return { path, status, failures, warnings, info: { title, titleLen: title.length, descLen: desc.length, h1: h1Matches.length, jsonld: ld.types.join('+'), links } };
}

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k]).catch((e) => ({ path: items[k], status: 0, failures: [`fetch error: ${String(e).slice(0, 80)}`], warnings: [], info: {} }));
      }
    }),
  );
  return out;
}

const pathsArg = opt('paths', null);
const paths = pathsArg ? String(pathsArg).split(',') : await pathsFromSitemap();
console.log(`Auditing ${paths.length} pages on ${BASE}`);
const results = await pool(paths, CONCURRENCY, auditPage);

const allLinks = new Set();
for (const r of results) for (const l of r.info.links ?? []) allLinks.add(l);

const linkProblems = [];
if (CHECK_LINKS) {
  const known = new Map(results.map((r) => [r.path, r.status]));
  const todo = [...allLinks].filter((l) => !known.has(l) && !/^\/(_next|api)\//.test(l));
  console.log(`Checking ${todo.length} internal links not already audited`);
  const checked = await pool(todo, CONCURRENCY, async (l) => {
    const res = await get(BASE + l);
    return { path: l, status: res.status, redirect: res.headers.get('location') };
  });
  for (const c of checked) known.set(c.path, c.status);
  const pageByLink = new Map();
  for (const r of results) for (const l of r.info.links ?? []) if (!pageByLink.has(l)) pageByLink.set(l, r.path);
  for (const l of allLinks) {
    const s = known.get(l);
    if (s === undefined || /^\/(_next|api)\//.test(l)) continue;
    if (s >= 400 || s === 0) linkProblems.push({ link: l, status: s, firstSeenOn: pageByLink.get(l) });
  }
}

const failed = results.filter((r) => r.failures.length);
const warned = results.filter((r) => r.warnings.length);
for (const r of failed) {
  console.log(`FAIL ${r.path} [${r.status}]`);
  for (const f of r.failures) console.log(`   - ${f}`);
}
if (linkProblems.length) {
  console.log('BROKEN INTERNAL LINKS');
  for (const l of linkProblems) console.log(`   - ${l.link} -> ${l.status} (first seen on ${l.firstSeenOn})`);
}
console.log(
  `\n${results.length - failed.length}/${results.length} pages pass; ${warned.length} with warnings; ` +
    `${CHECK_LINKS ? `${linkProblems.length} broken internal links of ${allLinks.size} unique` : 'links not checked (use --links)'}`,
);
if (JSON_OUT && typeof JSON_OUT === 'string') {
  writeFileSync(JSON_OUT, JSON.stringify({ base: BASE, at: new Date().toISOString(), results, linkProblems }, null, 2));
  console.log(`report written to ${JSON_OUT}`);
}
process.exit(failed.length || linkProblems.length ? 1 : 0);
