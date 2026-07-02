# Final Public Upload Instructions (STORE_ACCOUNT_BLOCKED)

The automated agent is currently running without an interactive browser session logged into the Chrome Web Store Developer Dashboard or the Microsoft Partner Center. As a result, the final submission to the stores is **STORE_ACCOUNT_BLOCKED** due to missing authentication / 2FA / Payment blocks.

Please follow these exact manual steps to publish Soter.

## Step 1: Chrome Web Store
1. Go to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
2. Click **New Item** or select the existing Soter item.
3. Upload the package located at:
   `C:\Users\USER\OneDrive\Desktop\Ai-Agent-Security-Guard\apps\extension\dist\soter-extension-v0.1.0.zip`
4. Copy the listing details from `docs/extension-store/chrome-web-store-listing.md`.
5. Upload the generated screenshots and the `promo-large-920x680.png` banner from `docs/extension-store/screenshots/`.
6. Go to the **Privacy Practices** tab:
   - Provide the exact justifications from `docs/extension-store/permission-justification.md`.
   - Link your privacy policy (`docs/extension-store/privacy-policy.md`).
7. In **Reviewer Notes**, paste the contents of `docs/extension-store/reviewer-notes.md`.
8. Set Visibility to **Public**.
9. Click **Submit for Review**.

## Step 2: Microsoft Edge Add-ons
1. Go to the [Microsoft Partner Center](https://partner.microsoft.com/en-us/dashboard/microsoftedge/overview).
2. Create a new extension.
3. Upload `soter-extension-v0.1.0.zip`.
4. Copy the metadata from `docs/extension-store/edge-addons-listing.md`.
5. Upload screenshots and promotional assets.
6. Provide support and privacy URLs.
7. Click **Submit for Certification**.
