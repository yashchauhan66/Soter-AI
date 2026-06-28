export const GITHUB_CODE_REVIEW_WORKFLOW = `name: SoterAI AI Code Security Review

on:
  pull_request:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read

jobs:
  security-review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Review changed code
        env:
          SOTERAI_API_URL: \${{ vars.SOTERAI_API_URL }}
          SOTERAI_API_KEY: \${{ secrets.SOTERAI_API_KEY }}
          BASE_SHA: \${{ github.event.pull_request.base.sha || github.event.before }}
          HEAD_SHA: \${{ github.sha }}
        shell: bash
        run: |
          set -euo pipefail
          : "\${SOTERAI_API_URL:?Set the SOTERAI_API_URL repository variable}"
          : "\${SOTERAI_API_KEY:?Set the SOTERAI_API_KEY repository secret}"
          failed=0
          while IFS= read -r file; do
            [ -z "\${file}" ] && continue
            diff_content="$(git diff --unified=20 "\${BASE_SHA}" "\${HEAD_SHA}" -- "\${file}" | head -c 24000)"
            payload="$(jq -n --arg code "\${diff_content}" --arg filename "\${file}" \\
              '{code: $code, filename: $filename, context: {environment: "production", internetExposed: true, aiGenerated: true}}')"
            response="$(curl --fail-with-body --silent --show-error \\
              -H "Content-Type: application/json" \\
              -H "x-api-key: \${SOTERAI_API_KEY}" \\
              --data "\${payload}" \\
              "\${SOTERAI_API_URL%/}/api/code-security/review")"
            decision="$(jq -r '.decision' <<<"\${response}")"
            count="$(jq -r '.findings | length' <<<"\${response}")"
            echo "\${file}: \${decision} (\${count} findings)"
            jq -r '.findings[] | "  [\\(.severity)] line \\(.line) \\(.ruleId): \\(.title)"' <<<"\${response}"
            if [ "\${decision}" = "FAIL" ]; then failed=1; fi
          done < <(git diff --name-only --diff-filter=ACMR "\${BASE_SHA}" "\${HEAD_SHA}" -- \\
            '*.js' '*.jsx' '*.ts' '*.tsx' '*.py' '*.go' '*.rb' '*.php' '*.java' '*.cs')
          exit "\${failed}"
`;
