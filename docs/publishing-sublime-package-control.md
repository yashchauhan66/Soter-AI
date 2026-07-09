# Publishing the SoterAI IDE Guard package to Package Control

Status date: 2026-07-06. This is a submission checklist and record. Package
Control is a community-maintained, repository-indexed channel: a package is added
by opening a pull request against the `packagecontrol/channel` repository that
points at a tagged public GitHub repo. There is no binary upload.

Do not describe Sublime Text as supported until the package loads in a clean
Sublime install, completes a broker-backed scan and redact, and passes the
canary privacy test (see `docs/sublime-test-report.md`).

## How Package Control distribution works

- Package Control reads a central channel/repository JSON. Submission = a PR to
  the default channel referencing your GitHub repository.
- Users then install by name via `Package Control: Install Package`.
- A `.sublime-package` file is simply a zip of the package directory. Package
  Control builds/installs from the tagged Git source; you do not upload a zip to
  a marketplace.
- Releases are driven by Git tags (semantic versions) or by branch, declared in
  the channel entry's `releases` block.

## Repository requirements

- [ ] Public GitHub repository whose root **is** the package (the Sublime
      package files at the repo root), or a documented subfolder mapping. The
      current source lives at `extensions/sublime/`; publishing needs either a
      dedicated repo with these files at the root, or a `subfolder` release
      entry pointing at `extensions/sublime`.
- [ ] `README.md` at the package root with install steps, configuration, and the
      honest-limitations section (already written).
- [ ] `LICENSE` present and referenced.
- [ ] `messages.json` + `messages/install.txt` for first-run guidance
      (already present).
- [ ] `.python-version` requesting the `3.8` plugin host (already present).
- [ ] No committed secrets: no broker token, no `.soterai/` token file, no
      `.env`. The token is read at runtime from settings or `token_path`.
- [ ] Package name reserved/consistent: `SoterAI IDE Guard` (channel entry
      `name`), install folder `SoterAI Guard`.

## Metadata and compatibility

- [ ] Tag a semantic version (for example `v0.1.0`) once the in-editor tests
      pass. Package Control prefers tagged releases.
- [ ] Declare Sublime Text build compatibility in the channel `releases` entry
      (`sublime_text": ">=4000"`), because the package targets the ST4 Python
      3.8 host.
- [ ] Confirm the package contains only the intended files (no test scratch,
      no `__pycache__`, no `.pyc`). Add a `.gitignore` for `__pycache__/` and
      `*.pyc`.

## Channel submission steps

1. [ ] Verify the package loads and every command works in a clean Sublime Text
       4 profile (move the NOT RUN rows in the test report to PASS).
2. [ ] Push the package to its public GitHub repo and create the version tag.
3. [ ] Fork `packagecontrol/channel`, add the repository entry (name, details
       URL, author, and a `releases` block with the tag rule and
       `sublime_text` range).
4. [ ] Run the channel's local validation/lint if provided, then open the PR.
5. [ ] Respond to maintainer review; naming collisions and missing README/LICENSE
       are the common rejections.
6. [ ] After merge, confirm the package appears via
       `Package Control: Install Package` in a clean profile and installs.

## Credential handling (reviewer-facing)

- The package never bundles a token. At runtime it reads the bearer token from
  the `token` setting or, preferably, from the file at `token_path`
  (default `~/.soterai/broker/auth-token`).
- The token is never logged, never shown in the output panel, and never included
  in error messages.
- All broker traffic is loopback only; nothing is sent to SoterAI Cloud by the
  package itself.

## Honest positioning in the listing

- Describe the package as a thin adapter to a local broker, not a standalone
  scanner.
- State the limitations verbatim from the README: no silent interception of
  other tools or the terminal; redaction reduces but does not guarantee removal;
  no "100% secure" claims.

## Primary references

- [Package Control: submitting a package](https://packagecontrol.io/docs/submitting_a_package)
- [Package Control: packages and channels](https://packagecontrol.io/docs/channels_and_repositories)
- [Sublime Text packages](https://www.sublimetext.com/docs/packages.html)
- [Sublime Text Python API environments (3.8 host)](https://www.sublimetext.com/docs/api_environments.html)
