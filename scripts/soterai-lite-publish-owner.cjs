// This build task prepares local artifacts only; publishing needs owner finalization.
console.error('SoterAI Lite publishing is not enabled for this local candidate. Finalize docs/soterai-lite/release-identity.json and follow PUBLISHING-RUNBOOK.md after exact-object review.');
process.exitCode = 1;
