'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
let source = fs.readFileSync(path.join(__dirname, 'installed-owner-custody-proposed-02.ps1'), 'utf8');
const lines = source.split('\n').filter(line => line.includes('if($taskBinding.runRoot -cnotmatch '));
assert.equal(lines.length, 2);
const literal = line => { const start = line.indexOf("'"); return line.slice(start, line.indexOf("'", start + 1) + 1); };
assert.notEqual(literal(lines[0]), literal(lines[1]));
// Literal callback avoids JavaScript $' replacement-string suffix expansion.
const corrected = lines[1].replace(literal(lines[1]), () => literal(lines[0]));
assert.equal(source.split(lines[1]).length - 1, 1); source = source.replace(lines[1], () => corrected);
source = '# Successor04: literal callback preserves the exact anchored initial run-root regex.\n' + source;
fs.writeFileSync(path.join(__dirname, 'installed-owner-custody-proposed-04.ps1'), source, { flag: 'wx' });
fs.writeFileSync(path.join(__dirname, 'custody-preparation-failures-01.json'), JSON.stringify({
  status: 'INERT_PREPARATION_FAILURES_RETAINED_NO_HOST_OR_QUERY',
  source02: 'PowerShell parser accepted syntax, but initial run-root regex escaped separators incorrectly. Not invoked against a binding or live owner.',
  source03: 'Generator03 used JavaScript replacement text containing dollar-apostrophe from a regex end anchor. Output source03 was malformed; actual PowerShell parser refused it before dot-source or controls/CIM/listener/token calls.',
  controlsAttempt03: { actualToolExitCode: 1, outcome: 'F32 custody source syntax errors.', behavioralControlsExecuted: 0 },
  correction04: 'Generate from original02, copy first checked root-regex literal through callback replacements and preserve every other source byte, then run pure synthetic controls.',
  publicVendorAttempt01LabelCorrection: 'The earlier failure receipt field named stdout holds combined exec tool output. Generator01 itself emits that constant diagnostic via console.error; per-stream capture was not performed. Exit1 and no observation JSON remain correct.',
  codeLaunches: 0, cimQueries: 0, listenerQueries: 0, signalsRequested: 0,
}, null, 2) + '\n', { flag: 'wx' });
