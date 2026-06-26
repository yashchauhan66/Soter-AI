# SoterAI — Legal & Marketplace Readiness Checklist

> Track completion of all requirements before marketplace submission.

---

## Pages & URLs

- [x] Privacy Policy page live at /privacy
- [x] Terms of Service page live at /terms
- [x] Pricing page live at /pricing (with FAQ and integration mentions)
- [x] Status page live at /status (with integration statuses)
- [x] Support page live at /support (with mailto links)
- [x] Footer links: Privacy, Terms, Pricing, Status, Support, Integrations

## Legal Content

- [x] Privacy Policy — 15 sections, marketplace-quality
- [x] Terms of Service — 21 sections, marketplace-quality
- [x] Legal review disclaimer on both pages
- [ ] Legal counsel review completed
- [x] No false compliance claims (SOC 2, ISO, HIPAA, GDPR)
- [x] Truthful marketplace status labels used throughout

## Contact & Support

- [ ] support@soterai.dev mailbox created and monitored
- [ ] security@soterai.dev mailbox created and monitored
- [x] Support page with mailto links
- [x] Response time expectations documented

## Marketplace Assets

- [x] SVG icon: public/marketplace/soterai-icon.svg
- [x] PNG icon 192x192: public/marketplace/icon-192.png (official source)
- [x] PNG icon 192x192 (alias): public/marketplace/soterai-icon-192.png
- [ ] PNG icon 128x128: public/marketplace/soterai-icon-128.png
- [ ] PNG icon 256x256: public/marketplace/soterai-icon-256.png
- [ ] PNG icon 512x512: public/marketplace/soterai-icon-512.png
- [x] Icon export script: scripts/export-marketplace-icons.mjs
- [x] Integration icons deployed to all platform packages
- [ ] Screenshots captured (see screenshots-checklist.md)
- [ ] Demo video recorded (see demo-video-script.md)

## Documentation

- [x] Short description: docs/marketplace-assets/soterai-short-description.md
- [x] Long description: docs/marketplace-assets/soterai-long-description.md
- [x] Platform listing copy: docs/marketplace-assets/platform-listing-copy.md
- [x] Privacy summary: docs/marketplace-assets/privacy-summary.md
- [x] Security summary: docs/marketplace-assets/security-summary.md
- [x] Support info: docs/marketplace-assets/support-info.md
- [x] Screenshots checklist: docs/marketplace-assets/screenshots-checklist.md
- [x] Demo video script: docs/marketplace-assets/demo-video-script.md

## Platform Submission Readiness

- [x] n8n: package ready, publish checklist done
- [x] Dify: plugin ready, marketplace checklist done
- [x] Zapier: app ready, publishing checklist done
- [x] Make.com: app ready, publishing checklist done
- [x] Botpress: integration ready, publishing checklist done
- [x] Flowise: custom nodes ready
- [x] Langflow: custom components ready
- [x] Voiceflow: API/Function templates ready

## Pre-Submission Blockers

1. [ ] Create support@soterai.dev mailbox
2. [ ] Create security@soterai.dev mailbox
3. [ ] Export PNG icons (run scripts/export-marketplace-icons.mjs)
4. [ ] Capture all screenshots
5. [ ] Record demo video
6. [ ] Complete legal counsel review of Privacy Policy and Terms
7. [ ] Configure NEXT_PUBLIC_APP_URL=https://soterai.dev in production
8. [ ] Verify all pages render on production domain
