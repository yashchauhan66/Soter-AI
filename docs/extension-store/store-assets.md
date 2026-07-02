# Store Assets — Soter Enterprise AI Control Plane Extension

**Version:** 1.0.0  
**Date:** June 30, 2026  
**Status:** DOCUMENTATION COMPLETE - ICONS NEED OPTIMIZATION

---

## 📋 Chrome Web Store Requirements

### Icons (Required)

| Size | File | Status | Location | Notes |
|------|------|--------|----------|-------|
| 16x16 | icon-16.png | ⚠️ Uses 192px | `apps/extension/dist/assets/` | Should be dedicated 16px |
| 32x32 | icon-32.png | ⚠️ Uses 192px | `apps/extension/dist/assets/` | Should be dedicated 32px |
| 48x48 | icon-48.png | ⚠️ Uses 192px | `apps/extension/dist/assets/` | Should be dedicated 48px |
| 128x128 | icon-128.png | ⚠️ Uses 192px | `apps/extension/dist/assets/` | Should be dedicated 128px |
| 192x192 | icon-192.png | ✅ Exists | `public/icon-192.png` | Primary icon |
| 512x512 | icon-512.png | ✅ Exists | `public/icon-512.png` | Store listing |

**Current Issue:** Manifest points all icon sizes to the same `icon-192.png` file. While functional, dedicated sizes provide better rendering quality.

### Store Listing Images

| Asset | Dimensions | Format | Status | Purpose |
|-------|------------|--------|--------|---------|
| Small Tile | 440x280 | PNG | ⬜ TODO | Store listing tile |
| Marquee Promo | 1400x560 | PNG | ⬜ TODO | Featured placement |
| Screenshots | 1280x800 or 640x400 | PNG/JPG | ⬜ TODO | Feature showcase (min 1, max 5) |

---

## 📸 Screenshot Requirements

### Recommended Screenshots (5 total)

1. **Enrollment Flow** (1280x800)
   - Show clean enrollment interface
   - Highlight enterprise security
   - Caption: "Secure Device Enrollment with Token-Based Authentication"

2. **Prompt Interception** (1280x800)
   - ChatGPT with blocked prompt
   - Redacted sensitive data visible
   - Caption: "Real-Time Prompt Scanning Prevents Data Leaks"

3. **Admin Dashboard** (1280x800)
   - Audit logs with activity
   - Privacy-preserving interface
   - Caption: "Comprehensive Audit Logs with Privacy-First Design"

4. **Emergency Lockdown** (1280x800)
   - Lockdown UI active
   - All AI tools blocked
   - Caption: "Emergency Lockdown: Instant Enterprise-Wide Control"

5. **Policy Management** (1280x800)
   - Policy configuration
   - Destination-specific rules
   - Caption: "Flexible Policy Engine for Custom Security Rules"

### Screenshot Guidelines

- **Resolution**: 1280x800 preferred (or 640x400 minimum)
- **Format**: PNG with transparency or JPG
- **Content**: No placeholder text, real UI only
- **Privacy**: No real employee data, use demo accounts
- **Clarity**: High contrast, readable text
- **Branding**: Soter logo visible but not obtrusive

---

## 🎨 Icon Design Guidelines

### Current Icon Status

**Source Icons:**
- ✅ `public/icon-192.png` exists
- ✅ `public/icon-512.png` exists
- ⚠️ Smaller sizes (16, 32, 48, 128) not optimized

### Recommended Actions

1. **Generate Dedicated Sizes**:
   ```bash
   # Using ImageMagick or similar
   convert public/icon-512.png -resize 16x16 public/icon-16.png
   convert public/icon-512.png -resize 32x32 public/icon-32.png
   convert public/icon-512.png -resize 48x48 public/icon-48.png
   convert public/icon-512.png -resize 128x128 public/icon-128.png
   ```

2. **Update Manifest**:
   ```json
   {
     "icons": {
       "16": "assets/icon-16.png",
       "32": "assets/icon-32.png",
       "48": "assets/icon-48.png",
       "128": "assets/icon-128.png",
       "192": "assets/icon-192.png"
     },
     "action": {
       "default_icon": {
         "16": "assets/icon-16.png",
         "32": "assets/icon-32.png",
         "128": "assets/icon-128.png"
       }
     }
   }
   ```

3. **Update Build Script** (`apps/extension/scripts/build-extension.mjs`):
   ```javascript
   cpSync(resolve(repositoryRoot, "public", "icon-16.png"), resolve(dist, "assets", "icon-16.png"));
   cpSync(resolve(repositoryRoot, "public", "icon-32.png"), resolve(dist, "assets", "icon-32.png"));
   cpSync(resolve(repositoryRoot, "public", "icon-48.png"), resolve(dist, "assets", "icon-48.png"));
   cpSync(resolve(repositoryRoot, "public", "icon-128.png"), resolve(dist, "assets", "icon-128.png"));
   cpSync(resolve(repositoryRoot, "public", "icon-192.png"), resolve(dist, "assets", "icon-192.png"));
   cpSync(resolve(repositoryRoot, "public", "icon-512.png"), resolve(dist, "assets", "icon-512.png"));
   ```

### Icon Design Principles

- **Recognizable**: Clear at 16px (toolbar size)
- **On-Brand**: Uses Soter brand colors
- **Professional**: Enterprise-grade appearance
- **Meaningful**: Shield/security symbolism
- **Accessible**: Good contrast, colorblind-friendly

---

## 📦 Edge Add-ons Requirements

Edge follows similar requirements to Chrome but with minor differences:

### Icons (Same as Chrome)

✅ Same icon requirements as Chrome Web Store

### Store Listing Images

| Asset | Dimensions | Format | Status | Purpose |
|-------|------------|--------|--------|---------|
| Store Logo | 300x300 | PNG | ⚠️ Can use icon-512 cropped | Listed in search |
| Screenshots | 1366x768, 1280x800, or 1280x720 | PNG/JPG | ⬜ TODO | Feature showcase (min 1, max 10) |

---

## 📄 Store Listing Copy

### Short Description (132 characters max)

"Enterprise AI security extension. Prevent prompt injection, redact PII, enforce policies across ChatGPT, Claude, Gemini, and more."

### Detailed Description

```
Soter Enterprise AI Control Plane protects your organization's sensitive data when employees use AI tools like ChatGPT, Claude, Gemini, and Perplexity.

KEY FEATURES:

✅ Real-Time Prompt Scanning
- Block API keys, passwords, and secrets before they reach AI
- Redact PII (PAN, Aadhaar, SSN, credit cards)
- Detect and prevent prompt injection attacks

✅ Enterprise Policy Enforcement
- Centralized policy management
- Destination-specific rules
- Human-in-the-loop approval workflows

✅ Comprehensive Audit Logs
- Privacy-preserving audit trail
- No raw prompts stored by default
- SIEM/webhook integration for security monitoring

✅ Emergency Lockdown
- Instant enterprise-wide AI blocking
- Critical incident response tool
- Propagates to all devices in <60 seconds

✅ Shadow AI Discovery
- Detect unauthorized AI tool usage
- Visibility into AI sprawl
- Proactive risk management

PRIVACY FIRST:
- Only monitors configured AI destinations
- No tracking of general browsing
- Metadata-only logging by default
- Transparent data handling

COMPLIANCE READY:
- SOC 2 controls
- GDPR/CCPA compliant
- Audit-ready documentation
- Policy signature verification

ENTERPRISE FEATURES:
- Secure token-based enrollment
- Role-based access control
- Multi-tenant isolation
- MDM/Chrome Policy integration ready

Perfect for enterprises that need to balance AI productivity with security and compliance.

SUPPORTED AI PLATFORMS:
ChatGPT, Claude, Gemini, Perplexity, Poe, v0.dev, Bolt.new, Replit, and any custom AI deployment.

REQUIREMENTS:
- Organization account at soter.ai
- Admin-generated enrollment token
- Chrome 120+ or Edge 120+

SUPPORT:
Email: support@soter.ai
Documentation: https://soter.ai/docs
```

---

## 🏷️ Categories & Tags

### Primary Category
- **Developer Tools** (Chrome)
- **Productivity** (Edge alternative)

### Tags/Keywords

Chrome (max 20):
- AI security
- ChatGPT security
- prompt injection
- data loss prevention
- enterprise security
- PII redaction
- compliance
- audit logging
- Claude
- Gemini
- AI governance
- secret scanning
- policy enforcement
- SIEM
- SOC 2
- GDPR
- zero trust
- shadow AI
- AI firewall
- enterprise extension

---

## 🌐 Localization

### Initial Launch
- **Language**: English (US)
- **Markets**: Worldwide

### Future Localization Candidates
- English (UK)
- French
- German
- Spanish
- Hindi (India market)
- Japanese

---

## 📊 Store Listing Checklist

### Before Submission

- [ ] All icon sizes generated and optimized
- [ ] Manifest updated with correct icon paths
- [ ] Build script copies all icon files
- [ ] 5 screenshots captured (1280x800)
- [ ] Screenshots annotated with captions
- [ ] Small tile graphic created (440x280)
- [ ] Store logo prepared (300x300 for Edge)
- [ ] Short description under 132 characters
- [ ] Detailed description proofread
- [ ] Privacy policy URL verified: `https://soter.ai/privacy`
- [ ] Support URL verified: `https://soter.ai/support`
- [ ] Homepage URL verified: `https://soter.ai`
- [ ] Terms of service URL verified: `https://soter.ai/terms`
- [ ] Categories selected
- [ ] Tags/keywords added
- [ ] Version number matches manifest
- [ ] Extension package tested (unpacked)
- [ ] No console errors in production build
- [ ] All permission justifications documented

---

## 🚀 Submission Process

### Chrome Web Store

1. **Prepare Package**:
   ```bash
   npm run build:extension
   npm run package
   ```

2. **Upload**:
   - Go to Chrome Developer Dashboard
   - Click "New Item"
   - Upload `soter-extension-*.zip`
   - Fill in store listing
   - Add screenshots
   - Select "Private" visibility
   - Request private listing approval

3. **Review Notes**: See `review-notes.md`

### Edge Add-ons

1. **Prepare Package**: Same as Chrome

2. **Upload**:
   - Go to Microsoft Partner Center
   - Click "New Extension"
   - Upload same `.zip` file
   - Fill in store listing
   - Add screenshots
   - Select "Hidden" visibility
   - Submit for review

3. **Review Notes**: See `edge-hidden-listing.md`

---

## ⚠️ Current Status

### Blocking Issues for Store Submission

**P1 Issues:**
1. ⚠️ Icon sizes not optimized (all point to 192px)
2. ⚠️ No screenshots generated
3. ⚠️ No store listing graphics created

**Workarounds:**
- Icon issue: Browsers will auto-scale, but quality may suffer
- Screenshots: Can submit without, but approval less likely
- Graphics: Required for featured placement only

### Ready for Submission?

**Chrome/Edge Private Listing:**
- ✅ Extension builds successfully
- ✅ Privacy policy exists
- ✅ Permission justifications documented
- ⚠️ Screenshots recommended but not blocking
- ⚠️ Icon optimization recommended

**Verdict**: CAN submit but SHOULD optimize icons and create screenshots first for higher approval chances.

---

## 📝 Asset Creation Tools

### Recommended Tools

- **Icons**: Figma, Adobe Illustrator, Sketch
- **Screenshots**: Chrome DevTools Device Mode, Snagit, CleanShot
- **Graphics**: Canva (store tiles), Figma
- **Optimization**: ImageOptim, TinyPNG, Squoosh

### Quick Icon Generation

```bash
# Install ImageMagick
# Windows: choco install imagemagick
# Mac: brew install imagemagick

# Generate all sizes from 512px source
cd public
magick icon-512.png -resize 16x16 icon-16.png
magick icon-512.png -resize 32x32 icon-32.png
magick icon-512.png -resize 48x48 icon-48.png
magick icon-512.png -resize 128x128 icon-128.png
magick icon-512.png -resize 192x192 icon-192-new.png
```

---

## ✅ Final Checklist

Before marking store assets as complete:

- [ ] Generated icon-16.png
- [ ] Generated icon-32.png
- [ ] Generated icon-48.png
- [ ] Generated icon-128.png
- [ ] Updated manifest.json icon paths
- [ ] Updated build-extension.mjs to copy all icons
- [ ] Captured 5 production screenshots
- [ ] Added screenshot captions
- [ ] Created small tile (440x280)
- [ ] Created marquee promo (1400x560) - optional
- [ ] Tested build includes all assets
- [ ] Verified icons render correctly at all sizes

---

**Status**: ICONS FUNCTIONAL (all sizes exist via scaling), SCREENSHOTS PENDING  
**Blocking for Beta?**: NO  
**Blocking for Public Launch?**: YES (screenshots highly recommended)
