# Developer workflow checks

The local example checks `examples/aws-soterai/app`, produces its actual finite
single-file Node output, then scans that output separately. Findings exit 1;
incomplete checks exit 2. A missing, empty or unreadable entry cannot become a
successful build. Share only the `reports` directory: its summaries omit values,
filenames, source snippets and fingerprints. The example performs no deployment.

After building the local CLI, run:

```sh
node examples/developer-workflow/check.cjs <new-output-directory>
```

For another supported project, use the CLI around your reviewed build:

```sh
node packages/soterai-cli/dist/cli.js ci scan --root <source> --mode source --format github
# Run the project's reviewed credential-free build.
node packages/soterai-cli/dist/cli.js ci scan --root <actual-output> --mode artifact --format summary-json
```

Retain nonzero exit codes and scan the actual output directory. Source mode
excludes `.git` and `node_modules`; artifact mode has no default exclusions.
Inputs over 128 KiB per file, unsupported archives/binaries, inaccessible data
and exhausted budgets make coverage incomplete. Do not ignore those results to
force admission. JSON/SARIF formats retain sanitized locations for local review;
use `summary-json`/`github` when filenames themselves should stay private.

This finite example does not gate the whole repository, Next.js/Docker delivery,
or future pull requests. A GitHub workflow was prepared during this work but its
application was blocked by automatic approval review failing with
`content-blocked`. No workflow or repository protection setting was changed.
Adoption requires a reviewed credential-free build/output scope, trusted review
of the workflow/scanner and a required check in branch protection.
