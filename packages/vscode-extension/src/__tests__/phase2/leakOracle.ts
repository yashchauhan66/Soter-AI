/**
 * PHASE 2 — the leak oracle.
 *
 * `findLeaks(text)` is the single definition of FAIL used by every scenario in
 * this suite. It is deliberately harsher than a plain `includes()`:
 *
 *   A secret that reaches a sink base64-encoded, hex-encoded, URL-encoded,
 *   split across lines, interrupted by zero-width characters or spelled with
 *   homoglyphs has still reached the sink. A test that only greps for the
 *   literal string would report PASS on all six.
 *
 * Every transform is applied to the CAPTURED TEXT (not to the needle), so one
 * needle list covers every encoding. Each hit names the encoding, which is what
 * goes in the evidence column.
 */
import { CANARIES, canaryNeedles, type Canary } from "./canaries";

export interface Leak {
    canaryId: string;
    /** How the canary was encoded in the captured text. */
    encoding: string;
    /** The needle that matched, truncated — never the surrounding content. */
    needle: string;
}

/** Zero-width and bidi characters used to break up a string. */
const INVISIBLES = /[​-‏‪-‮⁠-⁤﻿­]/g;

/** Homoglyph → ASCII, covering the substitutions an evasion would actually use. */
const HOMOGLYPHS: Record<string, string> = {
    "а": "a", "е": "e", "о": "o", "р": "p", "с": "c",
    "у": "y", "х": "x", "і": "i", "ԁ": "d", "һ": "h",
    "ａ": "a", "ｅ": "e", "‐": "-", "‑": "-", "–": "-",
};

function foldHomoglyphs(s: string): string {
    let out = "";
    for (const ch of s) out += HOMOGLYPHS[ch] ?? ch;
    return out;
}

function safeDecode(fn: () => string): string {
    try { return fn(); } catch { return ""; }
}

/** Decode every base64-looking run of >=16 chars found in the text. */
function decodeEmbeddedBase64(text: string): string {
    const runs = text.match(/[A-Za-z0-9+/_-]{16,}={0,2}/g) ?? [];
    let out = "";
    for (const run of runs.slice(0, 400)) {
        out += safeDecode(() => Buffer.from(run, "base64").toString("utf8")) + "\n";
        out += safeDecode(() => Buffer.from(run, "base64url").toString("utf8")) + "\n";
    }
    return out;
}

/** Decode every hex-looking run of >=24 chars. */
function decodeEmbeddedHex(text: string): string {
    const runs = text.match(/(?:[0-9a-fA-F]{2}){12,}/g) ?? [];
    let out = "";
    for (const run of runs.slice(0, 400)) {
        out += safeDecode(() => Buffer.from(run, "hex").toString("utf8")) + "\n";
    }
    return out;
}

/** Decode `\xNN`, `\uNNNN` and `%NN` escapes. */
function decodeEscapes(text: string): string {
    let out = safeDecode(() => decodeURIComponent(text.replace(/%(?![0-9a-fA-F]{2})/g, "%25")));
    out += text.replace(/\\x([0-9a-fA-F]{2})/g, (_m, h) => String.fromCharCode(parseInt(h, 16)));
    out += text.replace(/\\u([0-9a-fA-F]{4})/g, (_m, h) => String.fromCharCode(parseInt(h, 16)));
    return out;
}

/** The named views of the captured text a needle is searched in. */
export function views(text: string): Array<[string, string]> {
    const stripped = text.replace(INVISIBLES, "");
    const noWhitespace = stripped.replace(/[\s\\'"`,+]|(\r?\n)/g, "");
    return [
        ["plain", text],
        ["invisibles-stripped", stripped],
        ["concatenated", noWhitespace],          // split across lines / string concat
        ["lowercased", stripped.toLowerCase()],
        ["homoglyph-folded", foldHomoglyphs(stripped)],
        // Reversing the TEXT makes a reversed secret readable forwards, so this
        // view is searched with the PLAIN needle. Searching it with a reversed
        // needle would double-reverse and match nothing — the oracle's own
        // self-test caught exactly that bug.
        ["reversed", [...stripped].reverse().join("")],
        ["url/escape-decoded", decodeEscapes(stripped)],
        ["base64-decoded", decodeEmbeddedBase64(noWhitespace)],
        ["hex-decoded", decodeEmbeddedHex(noWhitespace)],
    ];
}

/** Needles, precomputed once. */
const NEEDLES: Array<{ canary: Canary; needle: string; lower: string; packed: string }> =
    CANARIES.flatMap((canary) =>
        canaryNeedles(canary).map((needle) => ({
            canary,
            needle,
            lower: needle.toLowerCase(),
            packed: needle.replace(/[\s\\'"`,+]/g, ""),
        })),
    );

/**
 * Every canary leak in `text`. An empty array is the only PASS.
 */
export function findLeaks(text: string): Leak[] {
    if (!text) return [];
    const hits = new Map<string, Leak>();
    for (const [encoding, view] of views(text)) {
        if (!view) continue;
        for (const n of NEEDLES) {
            const target =
                encoding === "lowercased" ? n.lower
                : encoding === "concatenated" ? n.packed
                : n.needle;
            if (target.length < 12) continue;
            if (view.includes(target)) {
                const key = `${n.canary.id}:${encoding}`;
                if (!hits.has(key)) {
                    hits.set(key, { canaryId: n.canary.id, encoding, needle: `${target.slice(0, 16)}…` });
                }
            }
        }
    }
    return [...hits.values()];
}

/** Compact one-line evidence string for the results table. */
export function describeLeaks(leaks: Leak[]): string {
    if (leaks.length === 0) return "no canary in output";
    const byCanary = new Map<string, Set<string>>();
    for (const l of leaks) {
        if (!byCanary.has(l.canaryId)) byCanary.set(l.canaryId, new Set());
        byCanary.get(l.canaryId)!.add(l.encoding);
    }
    return [...byCanary.entries()].map(([id, encs]) => `${id}[${[...encs].join("|")}]`).join(" ");
}

/** Self-check: the oracle must actually find a canary it is given. */
export function oracleSelfTest(): void {
    const k = CANARIES[0];
    const variants: Array<[string, string]> = [
        ["plain", `prefix ${k.value} suffix`],
        ["base64", Buffer.from(k.value).toString("base64")],
        ["hex", Buffer.from(k.value).toString("hex")],
        ["url", encodeURIComponent(k.value)],
        ["split", k.value.split("").join("\n")],
        ["zero-width", k.value.split("").join("​")],
        ["reversed", [...k.value].reverse().join("")],
    ];
    for (const [name, text] of variants) {
        if (findLeaks(text).length === 0) {
            throw new Error(`leak oracle is blind to the ${name} encoding — the whole suite would report false PASSes`);
        }
    }
    if (findLeaks("nothing sensitive here at all, just ordinary prose").length !== 0) {
        throw new Error("leak oracle reports a leak on clean text — it would report false FAILs");
    }
}
