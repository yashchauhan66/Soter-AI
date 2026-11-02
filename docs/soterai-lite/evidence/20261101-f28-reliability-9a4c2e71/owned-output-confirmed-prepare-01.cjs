'use strict';
const fs = require('node:fs'), path = require('node:path');
const source = path.resolve('packages/vscode-extension/src/__tests__/host/liteLogVaultRuntime.host.ts');
let text = fs.readFileSync(source, 'utf8');
function once(before, after) {
  if (text.split(before).length !== 2) throw Error('Expected exactly one fixture replacement');
  text = text.replace(before, after);
}
once('const pause = milliseconds => new Promise(done => setTimeout(done, milliseconds));', `const pause = milliseconds => new Promise(done => setTimeout(done, milliseconds));
// F28_OBSERVATION_WAIT_BEGIN: extracted component tests execute this exact helper.
async function waitForObservation(read, pause, now, file, budgetMs = 5000) {
  const deadline = now() + budgetMs;
  while (now() < deadline) {
    try { if (read(file, "utf8") === "observed") return true; }
    catch (error) { if (error.code !== "ENOENT") throw error; }
    await pause(Math.min(25, Math.max(1, deadline - now())));
  }
  return false;
}
// F28_OBSERVATION_WAIT_END`);
once('  await pause(phase.endsWith("withdrawal") ? 2600 : 650);', `  // The observer must inspect pending output before the finite app completes.
  // Only synthetic scheduling changes: no extra IPC or product capabilities.
  // Missing acknowledgement fails finitely within 5s; withdrawal retains 2600ms.
  if (!phase.endsWith("withdrawal") && !await waitForObservation(fs.readFileSync, pause, Date.now,
      ".synthetic-f25-" + phase + "-observed.txt")) throw new Error("Synthetic observation deadline.");
  await pause(phase.endsWith("withdrawal") ? 2600 : 650);`);
once('async function status(): Promise<PublicStatus> {', `// F28_OBSERVATION_CONFIRM_BEGIN: extracted component tests execute this exact helper.
async function confirmPendingObservation(phase: Phase, check: () => void | Promise<void>): Promise<void> {
    await check();
    await writeFile(join(folder().uri.fsPath, ".synthetic-f25-" + phase + "-observed.txt"), "observed", { flag: "wx" });
}
// F28_OBSERVATION_CONFIRM_END
async function status(): Promise<PublicStatus> {`);
once('        await proof(phase); assert.equal(task.closed, false); assert.equal(task.writes.length, 0);', `        await proof(phase);
        await confirmPendingObservation(phase, () => { assert.equal(task.closed, false); assert.equal(task.writes.length, 0); });`);
once(`        assert.equal(debug.terminated, false); assert.equal(events(debug, "output").length, 0);
        if (phase === "debug-raw") {
            let rejected = false;
            try { await debug.session.customRequest("evaluate", { expression: "process.env.DATABASE_URL" }); } catch { rejected = true; }
            assert.equal(rejected, true);
        }`, `        await confirmPendingObservation(phase, async () => {
            assert.equal(debug.terminated, false); assert.equal(events(debug, "output").length, 0);
            if (phase === "debug-raw") {
                let rejected = false;
                try { await debug.session.customRequest("evaluate", { expression: "process.env.DATABASE_URL" }); } catch { rejected = true; }
                assert.equal(rejected, true);
            }
        });`);
once('            const task = await runTask(controlId); await proof("control"); assert.equal(task.writes.length, 0);', `            const task = await runTask(controlId); await proof("control");
            await confirmPendingObservation("control", () => { assert.equal(task.writes.length, 0); });`);
const output = path.join(__dirname, 'owned-output-confirmed-01.host.ts');
fs.writeFileSync(output, text, {flag:'wx'});
fs.writeFileSync(output+'.txt', text, {flag:'wx'});
console.log(JSON.stringify({status:'FIXTURE_ONLY_PREPARED_NOT_TESTED_OR_NATIVE', source, output}));
