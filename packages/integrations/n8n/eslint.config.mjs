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
    // shared/description.ts holds the INodeTypeBaseDescription that every
    // version spreads. It is not a node file, so the *.node.ts filename
    // convention does not apply to it.
    files: ['nodes/**/shared/description.ts'],
    rules: {
      'n8n-nodes-base/node-filename-against-convention': 'off',
    },
  },
  {
    // The version classes receive baseDescription (which carries `icon` and
    // `iconColor`) as a constructor argument and spread it. The rule reads the
    // description object literal statically, so it cannot see through the
    // spread and reports a missing icon that is in fact present at runtime.
    files: ['nodes/**/v[0-9]*/*.node.ts'],
    rules: {
      '@n8n/community-nodes/icon-validation': 'off',
    },
  },
  {
    // With a VersionedNodeType only the entry file belongs in `n8n.nodes`;
    // listing the version classes there would register three nodes instead of
    // one. The rule counts every *.node.ts file, so it reports the two version
    // classes as unregistered. `scripts/validate-package.cjs` asserts the real
    // invariant instead: `n8n.nodes` must name the entry file and it must exist.
    files: ['package.json'],
    rules: {
      '@n8n/community-nodes/node-registration-complete': 'off',
    },
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
