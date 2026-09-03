# UI primitives

Shared building blocks introduced in the enterprise UI pass. Read this before
adding a new panel, table, dialog, or chart — the point of these files is that
there is exactly one of each.

## Why they exist

Before this pass the console had, measurably:

- **11 distinct `<thead>` class strings** across 58 tables in 50 files, including
  one `bg-slate-50` light-mode header on a dark console.
- **7 hand-rolled modal implementations**, each re-implementing an Escape
  listener, a `querySelectorAll` focus trap, and `body.style.overflow` locking.
  Several had diverged and were subtly wrong.
- **11 accent hues** on the 35 dashboard feature tiles, plus per-product orange
  and violet identities in the sidebar and on the marketing pages.
- **`text-muted-foreground`** used 11 times — a shadcn/ui token this project does
  not define, so it generated no CSS and those captions rendered at full body
  colour.

None of that is visible in a diff review. It is visible on screen, and it is what
made the product read as assembled rather than designed.

| File | Use it for |
| --- | --- |
| `DataTable.tsx` | `Table` / `THead` / `TH` / `TBody` / `TR` / `TD` / `TEmpty` — any data grid |
| `Dialog.tsx` | `Dialog` + `DialogContent` for modals, `SheetContent` for edge drawers |
| `Chart.tsx` | `TrendChart` (time series), `BarList` (ranked), `CompositionBar` (share of a whole) |
| `AnimateIn.tsx` | Scroll-triggered entrance for a section |
| `SectionHeading.tsx` | Marketing section header with eyebrow + copy |
| `Skeleton.tsx` | Loading placeholders |
| `CodeBlock.tsx` | Syntax-highlighted snippet with copy |
| `Timestamp.tsx` | Client-local time rendering without hydration mismatch |

## Colour and the light theme

The product renders on a **solid white** page, and it did not always. Read the
header of `tailwind.config.ts` before changing any colour — the short version:

The theme was converted by **mirroring the Tailwind ramps** (light end ↔ dark
end), not by editing call sites. That was possible because the numeric step in
this codebase is a *role*, applied consistently: `text-slate-300` is body copy in
1,030 places, `border-slate-800` is a hairline in 445. Mirroring moved ~5,100 call
sites at once, and it means the class names in these primitives read exactly as
they did on the dark theme.

Two consequences you have to know:

**Higher numbers are now lighter.** So `hover:` modifiers that used to darken now
lighten. `bg-red-500 hover:bg-red-600` silently dropped a white label to 3.76:1
*while the pointer was on it*. Use the named steps — `bg-cyan-press` is always
darker than `bg-cyan` — or move in the opposite numeric direction.

**Literals are unreachable.** `bg-[#0b1420]` and `style={{ color: "#00c8c8" }}`
cannot be moved by a config change, which is how six pages stayed near-black after
the conversion. Colours for non-CSS surfaces (email, the embeddable badge, OG
cards, SVG attributes) live in `lib/brand.ts` and `lib/og/theme.ts`;
`scripts/audit-hardcoded-colors.mjs` fails the build on anything else.

**Contrast is verified, not eyeballed.** `scripts/verify-palette-contrast.mjs`
resolves the real theme and asserts a ratio for every role — body text at 4.5:1,
UI boundaries at 3:1. It is what caught `text-slate-600` mirroring to 2.56:1 and
the 16 brand links that would have landed at 1.69:1.

**A token that passes on white can still fail in place.** `bg-cyan/10` inside a
panel that is itself brand-tinted stacks both tints, and the text drawn on that
compound ground loses roughly a point of ratio. The palette audit models the
grounds a token is actually used over, so this stays fixed without a browser;
`audit:contrast:rendered` is what found it in the first place.

The brand hue has two steps and they are not interchangeable: `--brand`
(`#b23b0b`, 5.96:1 on white) for text, links, and fills, and the logo's own
`#f96403` (3.06:1) for the mark and large graphics only. The text step is darker
than the logo because it has to survive being drawn on a brand-tinted panel, not
just on white — see the composition note below.

## Conventions these encode

**Colour is semantic, never decorative.** Four tones carry meaning:
`brand` (identity, primary action, focus), `caution` (queued for a human),
`danger` (blocked or contained), `neutral` (everything else, which is most
things). If a colour does not answer "what does this tell the operator", it
should be `slate`.

**The logo is the only place the brand runs at full saturation.** `Logo`
(`components/layout/Logo.tsx`) renders the orange disc; everything else uses the
darker text step. Generated from one source via `npm run brand:assets`.

**Hover implies click.** `.card` does not react to hover; `.card-interactive`
does. Applying a hover response to a static tile is a promise the UI cannot keep.
`scripts/audit-card-affordance.mjs` enforces this.

**Numbers are tabular and right-aligned.** `<TD numeric>` and `data-numeric` set
`font-variant-numeric: tabular-nums`. Without it a metric column visibly reflows
as values tick over.

**Charts are server-rendered SVG.** No charting library: the console needs two
chart shapes, and Recharts would cost ~95 kB gzipped, force every chart into a
client component, and ship its own tooltip chrome to restyle.

**Radix only for behaviour.** `@radix-ui/react-dialog` is used for focus
trapping, scroll locking, and dismissal — not for looks. All visual language comes
from `app/globals.css` tokens.

## Verifying

```bash
npm run audit:ui   # undefined tokens, card affordance, table drift, hardcoded colours, contrast
npm run typecheck
npm run lint
```

`audit:ui` reports the remaining raw-table count, so table migration can proceed
incrementally against a number that goes down. `npm run audit:contrast` runs the
palette check on its own and prints the full ratio table, which is the fastest way
to check a colour change before rebuilding.

### Rendered contrast

```bash
npm run dev
npm run audit:contrast:rendered -- 3000 / /pricing /docs
```

`audit:contrast:rendered` drives a real browser, resolves each text node's
*effective* background by climbing through transparent ancestors and gradient
stops, and scores the worst case. It needs a dev server, so it is not part of
`audit:ui`.

It is worth running because it sees what the static checks cannot. During the light
conversion it caught, in order: `text-slate-500` at 4.20:1 inside tinted chips,
the site's main accent at 4.10:1 where a brand chip nested in a brand panel, six
`<h2>`s rendering near-black on orange because a base `h1–h4 { color }` rule
outranked the inherited `text-white`, and `text-white/70` supporting copy at
3.69:1 on the CTA fill. Every one of those passed a palette-level audit.

#### Coverage boundary on gated routes

The script signs in (`AUDIT_EMAIL` / `AUDIT_PASSWORD`, falling back to
`DEMO_USER_*`) and refuses to score a page it was redirected away from — a skipped
route is louder than a passing one, because silently re-measuring `/signin` once
per protected route prints a screen of reassuring zeroes.

That check exposes a real gap: **an admin session cannot audit `/dashboard`.**
`SignInForm` sends admins to `/admin`, so all 84 dashboard routes skip. Measured
so far: 5 public routes and 37 admin routes, 0 failures. The dashboard *chrome*
was covered separately, by rendering the shared components — every `.badge-*`,
`.button-*`, card, surface, the type scale, `DataTable`, the skeletons, and
`DashboardSidebar` — on a throwaway page under `/docs`, which is already in
`PUBLIC_ROUTES`. That needed no auth change and no database write, and also
reported 0.

What remains unmeasured is one-off markup inside individual dashboard pages. To
close it, point the script at those routes with a **non-admin** credential.

