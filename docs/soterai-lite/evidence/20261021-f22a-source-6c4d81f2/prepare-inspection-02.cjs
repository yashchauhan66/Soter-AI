const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const sha = b => crypto.createHash('sha256').update(b).digest('hex'), input = fs.readFileSync(path.join(__dirname, 'inspect-vsix-01.ps1'));
const expected = JSON.parse(fs.readFileSync(path.join(__dirname, 'host-fixture-inputs-01.json'), 'utf8')).records.find(r => r.path === 'inspect-vsix-01.ps1'); assert.equal(sha(input), expected.sha256);
let text = input.toString('utf8'); assert.equal(text.split('machineSettings=70;').length, 2);
text = text.replace('machineSettings=70;', "machineSettings=@($taskManifest.contributes.configuration.properties.PSObject.Properties|Where-Object{$_.Value.scope -ceq 'machine'}).Count;");
const marker = 'Assert-F22aManifest $taskBuildManifest'; assert.equal(text.split(marker).length, 2);
text = text.replace(marker, marker + `
if(@($taskVerifiedInputs|Where-Object{$_.path -ceq 'node_modules/@babel/parser/lib/index.js'}).Count -ne 1){throw 'Exact bundled parser source input missing.'}
if(@($taskVerifiedInputs|Where-Object{$_.path -ceq 'packages/vscode-extension/src/config-scanners/SourceSecretPlan.ts'}).Count -ne 1){throw 'Exact source planner runtime input missing.'}
$taskLicenseEntry=$taskContents['extension/LICENSE.md']
$taskLicenseText=[Text.UTF8Encoding]::new($false,$true).GetString($taskLicenseEntry)
if(-not $taskLicenseText.Contains('@babel/parser 7.29.7') -or -not $taskLicenseText.Contains('Copyright (C) 2012-2014 by various contributors') -or -not $taskLicenseText.Contains('Permission is hereby granted, free of charge')){throw 'Bundled parser permission notice missing.'}
`);
fs.writeFileSync(path.join(__dirname, 'inspect-vsix-02.ps1'), text, { flag: 'wx' });
const receipt = { status: 'PREPARED_NOT_RUN', source: { name: 'inspect-vsix-01.ps1', sha256: sha(input) }, output: { name: 'inspect-vsix-02.ps1', bytes: Buffer.byteLength(text), sha256: sha(text) }, reason: 'Prelaunch static review caught report-only legacy machineSettings=70 after assertions already required71. New report measures the actual manifest and explicitly verifies bundled parser/planner provenance and MIT permission notice. Original helper retained unexecuted.' };
fs.writeFileSync(path.join(__dirname, 'inspection-preparation-02.json'), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' }); console.log(JSON.stringify(receipt));
