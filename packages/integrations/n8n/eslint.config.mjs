import js from '@eslint/js';
import { n8nCommunityNodesPlugin } from '@n8n/eslint-plugin-community-nodes';
import { globalIgnores } from 'eslint/config';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import importX from 'eslint-plugin-import-x';
import basePlugin from 'eslint-plugin-n8n-nodes-base';
import tseslint from 'typescript-eslint';

// Same Cloud, node-description and credential rules as @n8n/node-cli 0.51.4.
// Import the official plugins directly: this package does not use the CLI's
// generators or AI SDK, so those dependencies need not enter the build toolchain.
const community = n8nCommunityNodesPlugin.configs.recommended;
const config = tseslint.config(
  globalIgnores(['dist']),
  {
    files: ['**/*.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommended, community, importX.configs['flat/recommended']],
    rules: { 'prefer-spread': 'off', 'no-console': 'error' },
  },
  {
    plugins: { 'n8n-nodes-base': basePlugin },
    settings: { 'import-x/resolver-next': [createTypeScriptImportResolver()] },
  },
  {
    files: ['package.json', '**/*.node.json'],
    extends: [community],
    rules: { ...basePlugin.configs.community.rules },
    languageOptions: { parser: tseslint.parser, parserOptions: { extraFileExtensions: ['.json'] } },
  },
  {
    files: ['./credentials/**/*.ts'],
    rules: {
      ...basePlugin.configs.credentials.rules,
      'n8n-nodes-base/cred-class-field-documentation-url-miscased': 'off',
      'n8n-nodes-base/cred-class-field-type-options-password-missing': 'off',
    },
  },
  {
    files: ['./nodes/**/*.ts'],
    rules: {
      ...basePlugin.configs.nodes.rules,
      'n8n-nodes-base/node-class-description-inputs-wrong-regular-node': 'off',
      'n8n-nodes-base/node-class-description-outputs-wrong': 'off',
      'n8n-nodes-base/node-param-type-options-max-value-present': 'off',
    },
  },
);

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
