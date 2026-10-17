// Version-only follow-up: compare a fresh constant executable extension with
// the absent PATHEXT environment. No production mutation or test execution here.
const fs = require('node:fs'), Module = require('node:module'), path = require('node:path');
const input = fs.readFileSync(path.join(__dirname, 'diagnose-git-script-03.cjs'), 'utf8');
const needle = "GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0', GIT_ATTR_NOSYSTEM: '1', GIT_PROTOCOL_FROM_USER: '0' };";
if (!input.includes(needle)) throw new Error('Diagnostic03 environment source mismatch');
const copy = input.replace(needle, "GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0', GIT_ATTR_NOSYSTEM: '1', GIT_PROTOCOL_FROM_USER: '0', PATHEXT: '.EXE' };")
    .replaceAll('git-script-diagnostic-03.json', 'git-script-diagnostic-04.json')
    .replace('versionOnly: true, diagnosticCopy: true, results', "versionOnly: true, fixedPathext: '.EXE', diagnosticCopy: true, results");
const moduleCopy = new Module(__filename, module); moduleCopy.filename = __filename; moduleCopy.paths = module.paths; moduleCopy._compile(copy, __filename);
