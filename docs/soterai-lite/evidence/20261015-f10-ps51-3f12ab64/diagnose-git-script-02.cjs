const fs = require('node:fs'), Module = require('node:module'), path = require('node:path');
const input = fs.readFileSync(path.join(__dirname,'diagnose-git-script-01.cjs'),'utf8');
const original = "const diagnostic=original.replace(\"catch { throw 'Checked PowerShell operation unavailable.' }\",'catch { throw $_ }');";
const replacement = "const diagnostic=original.replace(\"catch { throw 'Checked PowerShell operation unavailable.' }\",'catch { throw $_ }').replace(\"throw 'Unsupported Git.'\", \"throw ('Unsupported Git. code=' + $LASTEXITCODE + ' count=' + $version.Count + ' value=' + ($version -join '|'))\");";
if (!input.includes(original)) throw new Error('Diagnostic source mismatch');
const copy = input.replace(original,replacement).replaceAll('git-script-diagnostic-01.json','git-script-diagnostic-02.json');
const moduleCopy = new Module(__filename, module); moduleCopy.filename=__filename; moduleCopy.paths=module.paths; moduleCopy._compile(copy,__filename);
