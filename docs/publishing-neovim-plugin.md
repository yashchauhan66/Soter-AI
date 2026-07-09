# Publishing the SoterAI IDE Guard Neovim plugin

Status date: 2026-07-06. Neovim has no central, reviewed marketplace. Publishing
means a public Git repository, tagged releases, and plugin-manager install
instructions — optionally listed in community indexes. Do not treat a listing as
a support claim; the checks in `docs/neovim-test-report.md` must pass first.

## Distribution model

- Source is Lua; there is no compiled artifact and nothing to sign for a store.
- Consumers install by pointing a plugin manager at the repository and a tag.
- The plugin directory must expose `plugin/` and `lua/` at the repository root
  (or be the root itself) so Neovim's `runtimepath` discovery works.

Recommended published repository name: `soterai/ide-guard-neovim` (adjust to the
real org). The plugin's `require` namespace is `soterai` (`lua/soterai/…`).

## Release checklist

1. Confirm `docs/neovim-test-report.md` procedures pass on a real Neovim host
   (0.7 baseline and a 0.10+ host for the async path).
2. Ensure the repository root has `plugin/soterai.lua`, `lua/soterai/`,
   `README.md`, and `LICENSE`.
3. Update the version reference in the README/changelog if maintained.
4. Tag a release with semantic versioning:

   ```sh
   git tag -a v0.1.0 -m "SoterAI IDE Guard for Neovim v0.1.0"
   git push origin v0.1.0
   ```

5. Create a GitHub release from the tag with notes that state the honest
   limitations (broker required, line-wise selection, no universal
   interception).

## Install instructions to publish

### lazy.nvim

```lua
{ "soterai/ide-guard-neovim", version = "*" } -- or tag = "v0.1.0"
```

### packer.nvim

```lua
use({ "soterai/ide-guard-neovim", tag = "v0.1.0" })
```

### Native packages / manual

```sh
git clone --branch v0.1.0 https://github.com/soterai/ide-guard-neovim \
  ~/.config/nvim/pack/soterai/start/ide-guard-neovim
```

## Optional discoverability

- Submit to the `awesome-neovim` list (security/tools section) via pull request.
- Register the repository on dotfyle so tagged versions are indexed.

These are community indexes, not gatekept marketplaces; approval is editorial and
does not validate behavior.

## Credential handling (important)

- **Never** commit a broker token, `~/.soterai/broker/auth-token`, or any real
  secret to the plugin repository or release notes.
- The plugin reads the token from the user's token file at request time. Do not
  add a default token, and do not print the token in examples.
- CI that runs the headless load test (`docs/neovim-test-report.md`, step 2)
  needs no secret — it does not require a broker. Broker round-trip and canary
  jobs, if automated, must inject the token via a protected CI secret and a
  throwaway broker instance, never a real user token.
- Keep release automation free of any step that reads or echoes the token file.

## Post-publish verification

After the release is public, install it from a clean config with each supported
manager and re-run steps 2–4 of the test report. Only after those pass on the
published tag should Neovim move from "adapter written" to "supported" in the
feasibility matrix.
