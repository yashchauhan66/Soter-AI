import { config } from '@n8n/node-cli/eslint';

export default [
  ...config,
  {
    // The in-package test suite and its compiled output. `files` in package.json
    // publishes neither, so a `node:test` import here is not a dependency of the
    // published node — linting them under the n8n Cloud rules reports
    // incompatibilities for code n8n never receives.
    ignores: ['test/**', 'test-build/**'],
  },
  {
    // localEngine.ts folds evasions before matching, so its normalisation
    // regexes deliberately enumerate combining marks and invisible controls in
    // order to strip them. The character classes are written as `\uXXXX`
    // escapes; the rule still pairs adjacent escapes into graphemes and reports
    // them. `allowEscape` is the documented way to say "these are escapes, and
    // matching the mark itself is the intent" while keeping the rule on for
    // literal combined characters pasted into source.
    files: ['nodes/**/shared/localEngine.ts'],
    rules: {
      'no-misleading-character-class': ['error', { allowEscape: true }],
    },
  },
];
