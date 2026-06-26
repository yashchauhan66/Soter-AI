# NPM Publish Checklist for n8n-nodes-soterai

Follow these steps to publish the SoterAI n8n community node to npm.

---

## Pre-Publish Checks

- [ ] Version in `package.json` is correct and follows semver (e.g. `0.1.0`).
- [ ] `CHANGELOG.md` has an entry for the new version.
- [ ] All changes are committed and pushed to the `main` branch.
- [ ] `npm run build` succeeds without errors.
- [ ] `npm run lint` passes with no type errors.
- [ ] The `dist/` directory contains the compiled `.js` and `.d.ts` files:
  - `dist/nodes/SoterGuard.node.js`
  - `dist/credentials/SoterApi.credentials.js`
- [ ] Tested locally in n8n by copying `dist/` to `~/.n8n/custom/` (or equivalent) and verifying all 5 actions work.

## Publish via CI (Recommended)

1. Tag the commit with the version:
   ```bash
   git tag n8n-v0.1.0
   git push origin n8n-v0.1.0
   ```
2. The `publish-n8n.yml` GitHub Actions workflow will automatically build and publish to npm.
3. Monitor the workflow run at: `https://github.com/yashchauhan66/Soter-AI/actions`

## Publish Manually

1. Log in to npm:
   ```bash
   npm login
   ```
2. Build the package:
   ```bash
   npm run build
   ```
3. Publish with public access and provenance:
   ```bash
   npm publish --access public --provenance
   ```
   If publishing without provenance (local machine), omit `--provenance`:
   ```bash
   npm publish --access public
   ```

## Post-Publish Verification

- [ ] Verify the package is live:
  ```bash
  npm view n8n-nodes-soterai
  ```
- [ ] Confirm it appears at: https://www.npmjs.com/package/n8n-nodes-soterai
- [ ] Install in a test n8n instance via **Settings > Community Nodes > Install** and enter `n8n-nodes-soterai`.
- [ ] Verify the **SoterAI** node appears in the node panel.
- [ ] Test at least one action (e.g. Input Guard) with a real API key.

## n8n Creator Portal Submission

After publishing to npm, submit the node to the n8n Creator Portal for official listing:

1. Go to: https://creators.n8n.io
2. Sign in with your n8n account (or create one).
3. Click **Submit a Node**.
4. Enter the npm package name: `n8n-nodes-soterai`
5. Fill in the description, category (Security / AI), and screenshots.
6. Submit for review. The n8n team typically reviews within 1-2 weeks.

## Version Bump Procedure

For subsequent releases:

1. Update the version in `package.json`.
2. Add a new section to `CHANGELOG.md`.
3. Commit: `git commit -am "release: n8n-nodes-soterai v0.x.x"`
4. Tag: `git tag n8n-v0.x.x`
5. Push: `git push origin main --tags`
