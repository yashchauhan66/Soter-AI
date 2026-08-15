# Publishing to Open VSX: Cursor, Windsurf, VSCodium, Kiro, Antigravity

SoterAI IDE Guard ships **one** audited VSIX. VS Code is already published to the
Visual Studio Marketplace; every other supported host resolves Open VSX, directly
or through a branded proxy, so the remaining work is a single `ovsx publish` plus
per-host proof — not five separate store submissions.

## Why one publish covers five editors

`extensionsGallery.serviceUrl` read from each installed host's own
`resources/app/product.json` on this machine, 2026-07-31:

| Host | Version | Gallery it actually queries |
| --- | --- | --- |
| VS Code | (separate channel) | Visual Studio Marketplace — already published |
| Cursor | 3.10.17 | `https://marketplace.cursorapi.com/_apis/public/gallery` |
| Windsurf | 1.110.1 | `https://marketplace.windsurf.com/vscode/gallery` |
| VSCodium | not installed here | `https://open-vsx.org/vscode/gallery` |
| Kiro | 1.0.212 | `https://open-vsx.org/vscode/gallery` |
| Antigravity | 1.107.0 | `https://open-vsx.org/vscode/gallery` |

Kiro, Antigravity, and VSCodium hit Open VSX directly. Cursor and Windsurf front
it with their own endpoints — Cursor documents its move to Open VSX as the
upstream source, and Windsurf's endpoint is an Open VSX mirror. Both add an
indexing delay on their side, and neither is under our control: treat "available
in Cursor/Windsurf search" as unproven until a search-install actually works
there, no matter what Open VSX says.

`engines.vscode` is `^1.85.0`, which is below every verified host API base above,
and the manifest declares no `enabledApiProposals` and no `extensionKind` — so
the same artifact is loadable everywhere without fork-specific builds.

## Steps only the release account holder can do

These require an interactive login and cannot be scripted from here:

1. Sign in to <https://open-vsx.org> with the release GitHub account.
2. Claim the `soterai` namespace: `npx ovsx create-namespace soterai`.
   As of 2026-07-31 `GET https://open-vsx.org/api/soterai` returns **404** — the
   namespace does not exist yet, so a publish would fail.
3. Mint a scoped access token at <https://open-vsx.org/user-settings/tokens>.
4. Provide it as the environment variable `OVSX_PAT` (local) or a protected CI
   secret. Never commit it, never pass it as a CLI argument, never echo it.
5. Optional but recommended: request namespace verification so the listing shows
   an ownership badge instead of an unverified publisher.
6. Confirm access without printing the token: `npx ovsx verify-pat soterai`.

## Release sequence

```powershell
npm ci
npm run openvsx:package                       # same VSIX as the VS Marketplace path

# Prove the packaged artifact really runs in each installed host (not just installs)
$env:SOTERAI_PACKAGED_RUNTIME = '1'
$env:SOTERAI_SKIP_PACKAGE = '1'
npm run test:cursor
npm run test:windsurf
npm run test:kiro
npm run test:antigravity
npm run test:vscodium                         # needs VSCodium installed

npm run openvsx:preflight                     # must print READY
$env:OVSX_PAT = '<from the secret store>'
npm run openvsx:publish                       # re-runs the preflight with --require-token
```

`test:*` installs the VSIX into a throwaway `--user-data-dir`/`--extensions-dir`,
launches the real editor, runs seven in-host checks (activation, broker startup,
strict policy load, secret redaction, controlled terminal, MCP routing, lockdown
and recovery), writes `artifacts/editor-runtime/<host>.json`, and verifies a clean
uninstall. Set `SOTERAI_REQUIRE_EDITOR=1` in CI so a missing host fails instead of
reporting SKIP. `SOTERAI_PROBE_TIMEOUT_MS` raises the per-host budget (default
240000) for slow-booting forks.

## What the preflight refuses to let through

`npm run openvsx:preflight` (`scripts/openvsx-publish-preflight.mjs`) writes
`artifacts/openvsx/publish-preflight.json` and exits non-zero on any blocker:

- Manifest: publisher, license, icon, repository, description, no proposed APIs,
  and an `engines.vscode` floor that every verified host API base can satisfy.
- Artifact: the VSIX for the manifest's exact version exists, its ZIP central
  directory is readable, the shipped `extension/package.json` matches the source
  on name/version/publisher/main, and the full contributed-command surface
  travels inside the package.
- Leak surface: no `.env`, private keys, certs, `node_modules`, TypeScript
  sources, or nested VSIX in the archive.
- Registry: the `soterai` namespace resolves, the version is not already
  published (Open VSX rejects overwrites), and the local version is ahead of the
  published one.
- Parity: a `PASS` runtime-evidence file for the *packaged version* exists for
  every Open VSX host installed on the machine. Hosts that are not installed are
  reported as UNVERIFIED warnings rather than assumed working.
- `OVSX_PAT` presence — blocking only under `--require-token`, which the publish
  helper always passes. The token's value is never read or printed.

Use `--offline` to skip the two registry calls when running without network.

## After the publish

Sideloading proved nothing about the registry. For each host, confirm the store
path itself:

- Open the Extensions view, search `SoterAI IDE Guard`, install **from search**.
- Check publisher, version, README rendering, license link, and icon on the
  listing.
- Re-run activation, broker health, canary, offline, and wrong-token smoke tests
  from the installed (not sideloaded) copy.
- Cursor and Windsurf may lag Open VSX by hours; recheck rather than assuming.
- Do not add a host to any "available on" claim until search-install succeeded
  there.

## Honest limits

- A successful install proves manifest acceptance. Only the in-host probe proves
  activation and feature behavior, and it covers seven checks — not the entire
  command surface.
- VSCodium is unverified on this machine (`codium` is not installed). Its runtime
  parity is an assumption until a probe run exists.
- Cursor, Windsurf, and Antigravity expose no supported hook into their own
  prompt-building pipelines. SoterAI protects what is explicitly scanned or
  routed through it and broker traffic pointed at the local endpoint; it does not
  transparently intercept a fork's proprietary AI features.
- Cursor additionally runs a separate, newer *plugins* marketplace that expects a
  public repo and a `.cursor-plugin/plugin.json`. That is a different artifact
  format and an optional extra channel; the Open VSX path above is what makes the
  existing VSIX installable in Cursor today.
- `repository.url` and `bugs.url` now point at the canonical
  `yashchauhan66/Soter-AI` (both verified `200`, 0 redirects). They previously
  named `Ai-Security-Guard`, which only resolved through GitHub's rename
  redirect. This changes published metadata: the next publish repoints the
  Repository link on the listing. Reverting is a one-line manifest edit if the
  release owner prefers the old value.

Primary references: [Open VSX project/CLI](https://github.com/eclipse/openvsx),
[Open VSX registry API](https://open-vsx.org/swagger-ui/index.html), and
[Cursor's Open VSX transition announcement](https://forum.cursor.com/t/extension-marketplace-changes-transition-to-openvsx/109138).
Everything about installed-host behavior above was read from each editor's own
`product.json` and reproduced by `scripts/test-vscode-family.mjs`.
