# SoterAI — ten security logo concepts

Open `index.html` to compare every concept on light and dark backgrounds, in
brand color or monochrome, with symbol and wordmark views and 24/16 px samples.
`contact-sheet.png` presents all ten designs in one image.

For browser download controls, serve the gallery from the repository root with
`python scripts/branding/serve-logo-gallery-20261114.py`, then open
`http://127.0.0.1:8876`. The complete ZIP and individual assets can also be used
directly from this folder.

## Recommended directions

1. **01 Boundary S** — strongest brand signature and compact favicon.
2. **02 Keystone Crest** — strongest immediate association with security.
3. **03 Guarded Core** — strongest link to protecting AI agents and their tools.

The remaining directions explore access control, trusted connections, an
abstract guardian, policy verification, controlled autonomy, credentials and
execution boundaries. `manifest.json` contains the individual design briefs.

## Files

Each numbered concept includes:

- `mark.svg`, `mark-dark.svg`, `mark-mono.svg`, `mark-white.svg`.
- `wordmark.svg`, `wordmark-dark.svg`, `wordmark-mono.svg`, `wordmark-white.svg`.
- Transparent PNG symbol exports at 1024, 512, 128, 64, 32, 24 and 16 px.
- Transparent light/dark wordmark PNG exports at 1440 × 512 px.

All SVG wordmarks use outlined glyphs and need no fonts, external assets or
scripts. Symbols use original hand-authored vector geometry. PNG files preserve
transparency. No image generation API was used; the user chose vector output.

Palette: graphic orange **#F96403**, ink **#172738**, white **#FFFFFF**. Use
**#B23B0B** for small orange text on light backgrounds. Use the white variants on
dark backgrounds for a single-color identity. Preserve at least one eighth of
the symbol width as clear space. Do not stretch, rotate, add shadows or place the
colored mark on a background that hides its darker parts.

For website headers, use the appropriate wordmark SVG; for favicon and app-icon
slots, use the standalone symbol. These are design concepts, without an asserted
trademark clearance. Select a direction before making it the site's identity.

Rebuild into a new dated directory using the source generator at
`scripts/branding/generate-logo-concepts-20261114.mjs`; existing collections are
preserved by its create-only output policy.
