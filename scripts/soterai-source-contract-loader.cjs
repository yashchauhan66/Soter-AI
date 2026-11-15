'use strict';
// Source drills use the same first-party aliases as Lite's package builder.
// Existing package/dist output is not evidence for the current source graph.
const Module = require('node:module'), path = require('node:path');
const repo = path.resolve(__dirname, '..'), load = Module._load;
const aliases = { '@soterai/guard-core': 'packages/guard-core/src/index.ts',
  '@soterai/ide-common': 'packages/ide-common/src/index.ts', '@soterai/ide-protocol': 'packages/ide-protocol/src/index.ts' };
Module._load = function (request, parent, isMain) {
  return load.call(this, Object.hasOwn(aliases, request) ? path.join(repo, aliases[request]) : request, parent, isMain);
};
