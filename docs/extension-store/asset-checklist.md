# Extension Store — Asset Checklist

**Extension:** Soter Enterprise AI Control Plane — v0.1.2
**Verified:** 2026-07-14 (dimensions read with PIL; all files present on disk)

## Icons (bundled in the package, `apps/extension/assets/`)

| Asset | Required size | Path | Exists | In Edge | In Chrome | Regenerated |
|---|---|---|---|---|---|---|
| Toolbar/store icon | 16×16 | `apps/extension/assets/icon-16.png` | ✅ | ✅ | ✅ | no (existing OK) |
| Toolbar icon | 32×32 | `apps/extension/assets/icon-32.png` | ✅ | ✅ | ✅ | no |
| Extensions page icon | 48×48 | `apps/extension/assets/icon-48.png` | ✅ | ✅ | ✅ | no |
| Store listing icon | 128×128 | `apps/extension/assets/icon-128.png` | ✅ | ✅ | ✅ | no |
| High-res icon | 192×192 | `apps/extension/assets/icon-192.png` | ✅ | ✅ | ✅ | no |
| Master icon | 512×512 | `apps/extension/assets/icon-512.png` | ✅ | ✅ | ✅ | no |

All six icon dimensions verified exact (16/32/48/128/192/512).

## Screenshots (1280×800 — Edge + Chrome both accept, `docs/extension-store/edge-assets/`)

| Asset | Size | Path | Exists | In Edge | In Chrome |
|---|---|---|---|---|---|
| Popup onboarding | 1280×800 | `edge-assets/edge-01-popup-onboarding.png` | ✅ | ✅ | ✅ |
| Popup enrolled | 1280×800 | `edge-assets/edge-02-popup-enrolled.png` | ✅ | ✅ | ✅ |
| Side panel scan result | 1280×800 | `edge-assets/edge-03-sidepanel-scan-result.png` | ✅ | ✅ | ✅ |
| AI warning overlay | 1280×800 | `edge-assets/edge-04-ai-warning-overlay.png` | ✅ | ✅ | ✅ |
| Admin policy studio | 1280×800 | `edge-assets/edge-05-admin-policy-studio.png` | ✅ | ✅ | ✅ |
| ChatGPT overlay (live) | 1280×800 | `edge-assets/edge-11-chatgpt-overlay.png` | ✅ | ✅ | ✅ |

## Promotional tiles

| Asset | Required size | Path | Exists | In Edge | In Chrome |
|---|---|---|---|---|---|
| Store logo | 300×300 | `edge-assets/logo-300x300.png` | ✅ | ✅ | ✅ (use 128 icon for CWS store icon) |
| Small promo tile | 440×280 | `edge-assets/small-promotional-tile-440x280.png` | ✅ | ✅ | ✅ |
| Large / marquee promo | 1400×560 | `edge-assets/large-promotional-tile-1400x560.png` | ✅ | ✅ | ✅ |

## Notes

- Chrome Web Store minimum: 1 screenshot 1280×800 or 640×400 — satisfied (6 at 1280×800).
- Edge Add-ons: at least 1 screenshot 1280×800 — satisfied. Store logo 300×300 satisfied.
- Chrome small promo tile 440×280 satisfied; marquee 1400×560 satisfied (optional).
- Legacy `docs/extension-store/screenshots/` contains earlier drafts + 6-byte mock
  placeholders (`*-mock.png`); **do not upload the mock placeholders**. Use only the
  `edge-assets/` set above, which are real rendered UI captures.
- No asset regeneration was required for this phase — all required sizes already exist
  and match the shipped UI.
