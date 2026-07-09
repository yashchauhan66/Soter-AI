# Publishing to Open VSX and testing Cursor-compatible hosts

Open VSX consumes a VSIX; SoterAI intentionally uses the same audited artifact as VS Code rather than building a fork-specific package. Compatibility is still established per editor and version.

## Namespace and token setup

1. Sign in to Open VSX and ensure the `soterai` namespace is owned/authorized by the release account.
2. Create a scoped access token in Open VSX user settings.
3. Store it as the protected CI secret `OVSX_PAT`, or set it in the current process environment for a one-time local release. Never commit it.
4. Verify namespace access without printing the token:

```powershell
npx ovsx verify-pat soterai
```

## Package, test, publish

```powershell
npm ci
npm run openvsx:package
npm run test:cursor
npm run test:vscodium
$env:OVSX_PAT = '<injected by secret store>'
npm run openvsx:publish
```

`openvsx:package` produces the same `soterai-ide-guard-<version>.vsix` as the VS Marketplace path. The publish helper reads the version from the manifest, refuses to run without the artifact and `OVSX_PAT`, and invokes the locally locked `ovsx` CLI without putting the token on the command line.

After registry publication:

- Install by registry search in VSCodium and Cursor, not only by sideloading.
- Confirm publisher, version, README, license, icon/assets, and install source.
- Repeat activation, command, broker, canary, offline, and wrong-token smoke tests.
- Allow for Cursor's marketplace proxy review/indexing delay; do not claim registry availability until search/install succeeds in the product.

## Host compatibility notes

- Cursor, VSCodium, Windsurf, and other Code-OSS editors can differ in API version, marketplace proxy, remote extension placement, secret-store backend, workspace trust behavior, and proprietary AI surfaces.
- SoterAI has no supported hook into Cursor or Windsurf's private prompt-building pipeline. It protects context explicitly scanned/routed through SoterAI and broker traffic configured to use the local endpoint.
- A successful VSIX install proves manifest/package acceptance, not command activation or feature behavior.
- VSCodium remains unverified on any machine where `codium` is unavailable. The test script reports SKIP by default; CI/release qualification must set `SOTERAI_REQUIRE_EDITOR=1` so a missing required host fails.

Primary references: [Open VSX project/CLI](https://github.com/eclipse/openvsx), [Open VSX registry API](https://open-vsx.org/swagger-ui/index.html), and [Cursor's Open VSX transition announcement](https://forum.cursor.com/t/extension-marketplace-changes-transition-to-openvsx/109138).

