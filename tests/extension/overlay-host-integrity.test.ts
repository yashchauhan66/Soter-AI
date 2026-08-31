/**
 * SS-6 regression guard for the overlay host's *integrity check itself*.
 *
 * `overlay-sentinel.test.ts` proves the watchdog's decision logic, but it drives a scripted
 * `isIntact()` hook — so it could never have caught what actually broke SS-6 in 0.2.1: the real
 * `hostIsIntact()` compared the host's inline style against the literal strings we asked for, and
 * CSSOM does not promise to hand back the string you gave it. `setProperty("inset", "0")` reads
 * back as `"0px"`, so the check reported "tampered" on a freshly mounted, completely untouched
 * host. Measured in Edge with a detached probe element:
 *
 *     MISMATCH inset: set "0" -> reads back "0px" (priority "important")
 *
 * The consequences were the whole tier, not a cosmetic wobble. Every tick "restored" a healthy
 * host, the 20-action budget went in roughly a third of a second (the sentinel then stands down
 * *permanently*), and both tamper audit reports were spent on the phantom — so a genuine page
 * attack afterwards was neither repaired nor reported. Runtime-proved by two
 * `overlay tamper detected` audit events for an interaction that was only a paste and a dismiss.
 *
 * These assertions are deliberately source-level. The authoritative proof that a pristine host
 * reads back as intact needs a real CSSOM and lives in the browser harness (RT-710 plus the
 * "no tamper event on an ordinary paste + dismiss" probe); jsdom's serialization is not Chrome's,
 * so a DOM-shim test here would be free to give a false PASS. What is guarded here is the shape
 * of the code that made the bug possible, so re-introducing it fails in a second rather than
 * after a browser round-trip.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const overlaySource = readFileSync(
  resolve(import.meta.dirname, "../../apps/extension/src/content/overlay.ts"),
  "utf8",
);
const cornerNoticeSource = readFileSync(
  resolve(import.meta.dirname, "../../apps/extension/src/content/corner-notice.ts"),
  "utf8",
);

/** The declarations `applyHostIntegrity` writes, parsed out of the `HOST_STYLE` literal. */
function hostStyleDeclarations(): Array<[string, string]> {
  const start = overlaySource.indexOf("const HOST_STYLE");
  assert.notEqual(start, -1, "overlay.ts must declare HOST_STYLE");
  const open = overlaySource.indexOf("[", overlaySource.indexOf("=", start));
  const close = overlaySource.indexOf("];", open);
  assert.ok(close > open, "HOST_STYLE must be an array literal");
  const body = overlaySource.slice(open, close);
  const pairs: Array<[string, string]> = [];
  for (const match of body.matchAll(/\[\s*"([^"]+)"\s*,\s*"([^"]*)"\s*\]/g)) {
    pairs.push([match[1], match[2]]);
  }
  return pairs;
}

/**
 * CSS shorthands whose CSSOM serialization is not guaranteed to echo the input. `inset` is the
 * one that actually shipped broken; the rest are the same trap one refactor away.
 */
const FORBIDDEN_SHORTHANDS = new Set([
  "inset", "margin", "padding", "border", "background", "font", "flex", "grid",
  "place-items", "place-content", "inset-block", "inset-inline", "overflow", "transition",
]);

/** Properties whose values are legitimately unitless. Everything else needs a unit. */
const UNITLESS_OK = new Set(["z-index", "opacity", "display", "visibility", "position", "pointer-events", "transform"]);

test("OV-750: HOST_STYLE declares longhands only, so CSSOM cannot re-serialize them", () => {
  const declarations = hostStyleDeclarations();
  assert.ok(declarations.length >= 8, `expected the full integrity table, parsed ${declarations.length}`);
  for (const [property] of declarations) {
    assert.equal(FORBIDDEN_SHORTHANDS.has(property), false,
      `HOST_STYLE must not use the shorthand "${property}" — CSSOM may read it back in another form, ` +
      `which is exactly how SS-6 was silently disabled in 0.2.1`);
  }
  // The four edges are what `inset: 0` used to cover; losing them would un-cover the viewport.
  for (const edge of ["top", "right", "bottom", "left"]) {
    assert.ok(declarations.some(([property]) => property === edge),
      `HOST_STYLE must pin "${edge}" explicitly now that the shorthand is gone`);
  }
});

test("OV-751: every length in HOST_STYLE carries its unit", () => {
  for (const [property, value] of hostStyleDeclarations()) {
    if (UNITLESS_OK.has(property)) continue;
    assert.ok(/^-?\d+(?:\.\d+)?[a-z%]+$|^(?:auto|none|normal)$/.test(value),
      `${property}: "${value}" is a bare number — the browser stores "0" as "0px" and the ` +
      `integrity comparison then fails against a pristine host`);
  }
});

test("OV-752: the integrity comparison uses the browser-canonicalized table, not the literal", () => {
  const start = overlaySource.indexOf("function hostIsIntact");
  assert.notEqual(start, -1, "overlay.ts must define hostIsIntact");
  const body = overlaySource.slice(start, overlaySource.indexOf("\n}", start));
  assert.ok(body.includes("expectedHostStyle()"),
    "hostIsIntact must compare against expectedHostStyle(), which round-trips each declaration " +
    "through a detached probe element, so a future shorthand cannot disable the watchdog again");
  assert.equal(/\bHOST_STYLE\b/.test(body), false,
    "comparing against the raw HOST_STYLE literal is the 0.2.1 bug");
  assert.ok(body.includes('getPropertyPriority(property) === "important"'),
    "a page can outrank a non-important inline declaration, so priority is part of integrity");
});

/** Source with comments stripped, so prose *about* a removed API is not mistaken for a call. */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

test("OV-753: the sentinel is not driven by a requestAnimationFrame loop", () => {
  // 20 corrective actions at 60 Hz is a third of a second, after which the watchdog stands down
  // for good — so a rAF-driven check turns any persistent disagreement into instant exhaustion.
  assert.equal(/requestAnimationFrame/.test(withoutComments(overlaySource)), false,
    "the host check must be observer-driven with a coarse backstop ticker, not a 60 Hz loop");
  // The comment recording why it was removed must survive, or the next refactor re-adds it.
  assert.ok(overlaySource.includes("requestAnimationFrame"),
    "keep the note explaining why the 0.2.1 rAF loop is gone");
  const tick = overlaySource.match(/OVERLAY_TICK_MS\s*=\s*(\d+)/);
  assert.ok(tick, "overlay.ts must declare a backstop tick interval");
  const ms = Number(tick[1]);
  assert.ok(ms >= 100, `a ${ms}ms backstop would exhaust a 20-action budget in ${20 * ms}ms`);
});

test("OV-754: extension-owned siblings are not counted as a page painting over the verdict", () => {
  const start = overlaySource.indexOf("function foreignElementAfter");
  assert.notEqual(start, -1, "overlay.ts must define foreignElementAfter");
  const body = overlaySource.slice(start, overlaySource.indexOf("\n}", start));
  for (const owned of ["data-soter-overlay", "data-soter-notice-stack"]) {
    assert.ok(body.includes(owned),
      `the stacking check must ignore our own "${owned}" furniture — counting it made a file-release ` +
      `confirmation look identical to a hostile maximum-z-index cover`);
  }
});

test("OV-755: the corner-notice stack does not mount where SS-6 checks for a cover", () => {
  assert.equal(/documentElement\.appendChild\(stack\)/.test(cornerNoticeSource), false,
    "appending the notice stack to <html> put it after the overlay host, which the stacking check " +
    "read as the page painting over the verdict — a second source of phantom tamper reports");
  assert.ok(/document\.body\s*\?\?\s*document\.documentElement/.test(cornerNoticeSource),
    "the stack belongs in <body>, with <html> only as the pre-body fallback");
});
