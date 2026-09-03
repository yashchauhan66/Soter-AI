/**
 * Rendered-contrast audit.
 *
 * The static audits check the *palette*: that every token pair in the design
 * system meets its ratio. They cannot see composition — a `text-white` label
 * inside a container that happens to be white, an element whose colour is
 * inherited from three levels up, or a hover state that only exists at runtime.
 * Those are exactly the defects a dark→light conversion produces, and they are
 * invisible in a diff.
 *
 * This drives a real browser, walks the visible text nodes, resolves each one's
 * *effective* background by climbing the ancestor chain through transparent
 * fills, and reports anything under WCAG AA for its size.
 *
 * It is a diagnostic rather than a gate: it needs a dev server, so it is not in
 * `audit:ui`.
 *
 * ## Authenticated routes
 *
 * `/dashboard/**` and `/admin/**` are the majority of this product's surface
 * (121 pages against 30 public ones) and they are gated by middleware. Pointing
 * an unauthenticated browser at them does not fail — it follows the redirect to
 * `/signin` and audits *that* page, so the run reports "0 failures" for a route
 * it never loaded. That false pass is worse than no coverage, so this script now
 * does two things: signs in when any requested route is protected, and verifies
 * the URL it actually landed on before scoring a single pixel.
 *
 * Credentials come from `AUDIT_EMAIL` / `AUDIT_PASSWORD`, falling back to
 * `DEMO_USER_EMAIL` / `DEMO_USER_PASSWORD` in `.env`.
 *
 * Usage:
 *   npm run dev
 *   node scripts/audit-rendered-contrast.mjs [port] [route ...]
 */
import { chromium } from "@playwright/test";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env", override: false, quiet: true });

const [portArg, ...routeArgs] = process.argv.slice(2);
const PORT = /^\d+$/.test(portArg ?? "") ? portArg : "3000";
const ROUTES = routeArgs.length > 0 ? routeArgs : ["/", "/pricing", "/docs", "/benchmarks"];

const EMAIL = process.env.AUDIT_EMAIL ?? process.env.DEMO_USER_EMAIL ?? "";
const PASSWORD = process.env.AUDIT_PASSWORD ?? process.env.DEMO_USER_PASSWORD ?? "";

/** Middleware-gated prefixes, per PUBLIC_ROUTES in auth.config.ts. */
const isProtected = (route) => route.startsWith("/dashboard") || route.startsWith("/admin");

/** Compare paths only: a query string or trailing slash is not a redirect. */
const samePath = (a, b) => a.replace(/\/+$/, "") === b.replace(/\/+$/, "");

/**
 * Runs inside the page.
 *
 * `getComputedStyle().backgroundColor` returns `rgba(0,0,0,0)` for anything
 * transparent, which is most elements — so the effective background has to be
 * resolved by walking up until an opaque fill is found. Without that step every
 * text node reports "black on transparent" and the whole run is noise.
 */
const collect = () => {
  const parse = (value) => {
    const m = /rgba?\(([^)]+)\)/.exec(value);
    if (!m) return null;
    const [r, g, b, a = "1"] = m[1].split(",").map((s) => parseFloat(s.trim()));
    return { r, g, b, a };
  };

  /** Every rgb()/rgba() stop in a gradient, in order. */
  const gradientStops = (backgroundImage) => {
    if (!backgroundImage || !backgroundImage.includes("gradient")) return [];
    return [...backgroundImage.matchAll(/rgba?\([^)]+\)/g)]
      .map((m) => parse(m[0]))
      .filter((c) => c && c.a > 0);
  };

  const luminance = ({ r, g, b }) => {
    const [x, y, z] = [r, g, b].map((c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * x + 0.7152 * y + 0.0722 * z;
  };

  const over = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  });

  const contrast = (fg, bg) => {
    const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
    return (hi + 0.05) / (lo + 0.05);
  };

  /**
   * Climbs to the first opaque background, compositing translucent layers.
   *
   * Returns a *list* of candidate grounds, not one colour, because a gradient has
   * no single background: the same white label can sit on the light end and the
   * dark end of one fill. Every stop is returned so the caller can score the worst
   * case, which is the only honest reading.
   *
   * `backgroundColor` alone is not enough — CSS gradients are `background-image`,
   * so an element with `bg-gradient-to-r` reports `rgba(0,0,0,0)` and the climb
   * would walk straight past the very fill the text is drawn on. That produced two
   * false failures on /student-discount before this was handled.
   */
  const effectiveBackgrounds = (element) => {
    const layers = [];
    for (let node = element; node; node = node.parentElement) {
      const style = getComputedStyle(node);

      const stops = gradientStops(style.backgroundImage);
      if (stops.length > 0) {
        // A gradient is treated as opaque: stop climbing.
        layers.push(stops);
        break;
      }

      const bg = parse(style.backgroundColor);
      if (!bg || bg.a === 0) continue;
      layers.push([bg]);
      if (bg.a === 1) break;
    }

    // Composite from the bottom up. Where a layer has several stops, each stop
    // produces its own candidate ground.
    let grounds = [{ r: 255, g: 255, b: 255, a: 1 }];
    for (const layer of layers.reverse()) {
      grounds = grounds.flatMap((ground) => layer.map((stop) => over(stop, ground)));
    }
    return grounds;
  };

  const findings = [];

  for (const element of document.querySelectorAll("body *")) {
    const text = [...element.childNodes]
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent.trim())
      .join(" ")
      .trim();
    if (!text) continue;

    const style = getComputedStyle(element);
    if (style.visibility === "hidden" || style.display === "none" || style.opacity === "0") continue;

    const rect = element.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) continue;
    if (style.clipPath === "inset(50%)" || style.clip === "rect(0px, 0px, 0px, 0px)") continue;

    const grounds = effectiveBackgrounds(element);

    /**
     * Gradient-clipped text (`bg-clip-text text-transparent`).
     *
     * `color` is literally `transparent`, so scoring it gives 1.00:1 and a
     * meaningless failure. What paints the glyphs is the element's own gradient, so
     * the roles invert: the gradient stops are the *foreground*, and the ground is
     * whatever is behind the element.
     */
    const isClippedText =
      style.webkitBackgroundClip === "text" || style.backgroundClip === "text";

    let candidates;
    if (isClippedText) {
      const stops = gradientStops(style.backgroundImage);
      if (stops.length === 0) continue;
      const behind = effectiveBackgrounds(element.parentElement ?? element);
      candidates = stops.flatMap((stop) => behind.map((bg) => [over(stop, bg), bg]));
    } else {
      const fgRaw = parse(style.color);
      if (!fgRaw) continue;
      candidates = grounds.map((bg) => [over(fgRaw, bg), bg]);
    }

    // Worst case across every ground this text can be drawn on.
    let worst = null;
    for (const [fg, bg] of candidates) {
      const ratio = contrast(fg, bg);
      if (!worst || ratio < worst.ratio) worst = { ratio, fg, bg };
    }
    if (!worst) continue;

    const size = parseFloat(style.fontSize);
    const weight = parseInt(style.fontWeight, 10) || 400;
    const isLarge = size >= 24 || (size >= 18.66 && weight >= 700);
    const required = isLarge ? 3 : 4.5;

    if (worst.ratio < required) {
      const rgb = (c) => `rgb(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)})`;
      findings.push({
        text: text.slice(0, 60),
        tag: element.tagName.toLowerCase(),
        className: (element.className || "").toString().slice(0, 90),
        ratio: Math.round(worst.ratio * 100) / 100,
        required,
        size,
        color: rgb(worst.fg),
        background: rgb(worst.bg),
      });
    }
  }

  return findings;
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

/**
 * Signs in through the real form.
 *
 * Deliberately not a forged session cookie: the cookie is signed with AUTH_SECRET
 * and its shape is an Auth.js internal, so a hand-built one is both fragile and a
 * second code path that can pass while the real one is broken. Driving the form
 * exercises what a user exercises.
 */
async function signIn() {
  if (!EMAIL || !PASSWORD) {
    console.log("Protected routes requested but no credentials found.");
    console.log("Set AUDIT_EMAIL / AUDIT_PASSWORD (or DEMO_USER_EMAIL / DEMO_USER_PASSWORD in .env).");
    await browser.close();
    process.exit(1);
  }

  await page.goto(`http://localhost:${PORT}/signin`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  // `getByLabel("Email")` is ambiguous here: SiteFooter renders a support link
  // with aria-label "Email SoterAI support", so the accessible-name lookup
  // resolves to two elements and Playwright's strict mode throws. The form's own
  // ids are unambiguous. (The e2e specs in tests/e2e use getByLabel and will hit
  // the same violation on any page that renders the footer.)
  await page.locator("#email").fill(EMAIL);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();

  // SignInForm routes admins to /admin and everyone else to the callback URL, so
  // wait for *any* navigation away from /signin rather than a specific path.
  try {
    await page.waitForURL((url) => !url.pathname.startsWith("/signin"), { timeout: 30_000 });
  } catch {
    const error = await page.locator("form p").first().textContent().catch(() => null);
    console.log(`Sign-in failed for ${EMAIL}${error ? `: ${error.trim()}` : "."}`);
    await browser.close();
    process.exit(1);
  }
  console.log(`Signed in as ${EMAIL} — landed on ${new URL(page.url()).pathname}\n`);
}

if (ROUTES.some(isProtected)) await signIn();

let total = 0;
const skipped = [];

for (const route of ROUTES) {
  const url = `http://localhost:${PORT}${route}`;
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
  } catch {
    // networkidle can hang on a page with polling; the DOM is what matters.
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  }

  /**
   * Never score a page we did not actually land on.
   *
   * Without this the audit silently re-measures /signin (or a `notFound()`
   * rewrite) once per protected route and prints a row of reassuring zeroes. A
   * skipped route has to be louder than a passing one.
   */
  const landed = new URL(page.url()).pathname;
  if (!samePath(landed, route)) {
    skipped.push({ route, landed });
    console.log(`\n=== ${route} — SKIPPED (redirected to ${landed}) ===`);
    continue;
  }

  const findings = await page.evaluate(collect);
  total += findings.length;

  console.log(`\n=== ${route} — ${findings.length} contrast failure(s) ===`);
  // Group identical class strings: one bad shared component reports once per use.
  const seen = new Map();
  for (const f of findings) {
    const key = `${f.tag}|${f.className}|${f.ratio}`;
    if (!seen.has(key)) seen.set(key, { ...f, count: 0 });
    seen.get(key).count += 1;
  }
  for (const f of [...seen.values()].sort((a, b) => a.ratio - b.ratio)) {
    console.log(
      `  ${f.ratio.toFixed(2)}:1 (need ${f.required})  ${f.count}x  <${f.tag}> ${f.color} on ${f.background}\n      "${f.text}"\n      ${f.className}`,
    );
  }
}

await browser.close();

const audited = ROUTES.length - skipped.length;
console.log(`\n${total} rendered contrast failure(s) across ${audited} audited route(s).`);
if (skipped.length > 0) {
  console.log(`${skipped.length} route(s) skipped — not measured:`);
  for (const s of skipped) console.log(`  ${s.route} -> ${s.landed}`);
}
// A skipped route is a failure of the audit, not a pass. Exiting 0 here is how a
// contrast regression on a gated page would go unnoticed.
if (total > 0 || skipped.length > 0) process.exitCode = 1;
