'use strict';
async function guard() {
  throw new Error('PREPARED_UNBOUND_NOT_EXECUTED: exact F27 all15/four runtimes/84 machine flags/full1016/compiler/backend/current source/host/vendor/driver admission is absent.');
}
module.exports = { guard };
if (require.main === module) guard().catch(() => {
  console.error('UNBOUND_F27_AFFECTED_NO_LAUNCH');
  process.exitCode = 1;
});
