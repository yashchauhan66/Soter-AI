# Proposed finite example PR check

This proposal is **not installed or active**. Writing the workflow into `.github`
was blocked when automatic approval review failed with `content-blocked`.
The local `check.cjs` and its adversarial tests are implemented independently.
The following is reviewable configuration, not evidence of a GitHub run.

Suggested destination: `.github/workflows/soterai-developer-example.yml`.
Keep it a separately named example check, not a claim of repository-wide or
production deployment admission. Apply only after the approval system works.

```yaml
name: SoterAI finite Node example security check
on:
  pull_request:
    paths:
      - 'examples/aws-soterai/app/**'
      - 'examples/developer-workflow/**'
      - 'packages/soterai-cli/**'
      - 'packages/guard-core/**'
      - '.github/workflows/soterai-developer-example.yml'
      - 'package-lock.json'
  workflow_dispatch:
permissions:
  contents: read
jobs:
  check-example:
    runs-on: ubuntu-24.04
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683
        with:
          persist-credentials: false
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020
        with:
          node-version: '22'
      - run: npm ci --ignore-scripts
      - name: Build scanner without production credentials
        run: |
          npm --prefix packages/guard-core run build
          npm --prefix packages/ide-protocol run build
          npm --prefix packages/ide-common run build
          npm --prefix packages/soterai-cli run build
      - name: Check source and actual finite Node output
        run: node examples/developer-workflow/check.cjs "$RUNNER_TEMP/soterai-example"
      - name: Show pathless report
        if: always()
        shell: bash
        run: |
          if [ -f "$RUNNER_TEMP/soterai-example/reports/summary.md" ]; then
            cat "$RUNNER_TEMP/soterai-example/reports/summary.md" >> "$GITHUB_STEP_SUMMARY"
          else
            echo 'Verification incomplete; no admission claimed.' >> "$GITHUB_STEP_SUMMARY"
          fi
      - name: Retain only pathless reports
        if: always()
        uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02
        with:
          name: finite-node-example-security
          path: |
            ${{ runner.temp }}/soterai-example/reports/source.json
            ${{ runner.temp }}/soterai-example/reports/artifact.json
            ${{ runner.temp }}/soterai-example/reports/summary.md
          if-no-files-found: error
```

Use trusted review for changes to this workflow, the scanner and build helper.
Never upload the parent output directory: it also contains application bytes.
Required-check/branch-protection settings and a real hosted run are separate
owner configuration and verification steps; none has been performed here.
