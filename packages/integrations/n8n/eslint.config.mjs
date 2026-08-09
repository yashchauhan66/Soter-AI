import { config } from '@n8n/node-cli/eslint';

export default [
  ...config,
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
];
