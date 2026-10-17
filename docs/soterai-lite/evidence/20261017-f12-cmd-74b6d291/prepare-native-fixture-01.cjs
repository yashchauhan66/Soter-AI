const fs=require('node:fs'),path=require('node:path');const repo=path.resolve(__dirname,'../../../..'),file=n=>path.join(repo,n);
let source=fs.readFileSync(file('packages/vscode-extension/src/__tests__/host/litePowerShell51.host.ts'),'utf8')
 .replaceAll('F10','F12').replaceAll('f10','f12').replaceAll('ps51','cmd').replaceAll('PS51','CMD').replaceAll('PS5.1','cmd').replaceAll('PS5.1','cmd')
 .replaceAll('SoterAI PowerShell 5.1 (checked commands)','SoterAI cmd (checked commands)').replaceAll('CheckedPowerShell','CheckedCmd').replaceAll('checkedPowerShell','checkedCmd').replaceAll('checked PowerShell','checked cmd')
 .replaceAll('"version"','"ver"').replaceAll('"pwd"','"cd"').replaceAll('"ls ."','"dir ."').replaceAll('"env"','"set"')
 .replaceAll('Get-Date; Get-Content','ver&type').replaceAll('Get-Content ','type ').replaceAll('cat note.txt','type note.txt')
 .replaceAll('sleep -Milliseconds 2000','timeout /t 2 /nobreak');
// No Git preparation or Git support is transferred into the cmd contract.
let start=source.indexOf('/** Trusted fixture preparation only:'),end=source.indexOf('/** Capture registration',start);if(start<0||end<0)throw Error('Fixture markers missing');source=source.slice(0,start)+source.slice(end);
source=source.replace('const GIT = "C:\\\\Program Files\\\\Git\\\\cmd\\\\git.exe";\n','').replace('const STAGED_PREFIX = "Staged changes only; unstaged and untracked files are not inspected.\\n";\n','');
source=source.replace('Actual installed finite cmd returns version, location, date and public directory names through the native PTY and completed registered output filter.','Actual installed finite cmd returns Windows version, location and public directory names through the native PTY and completed registered output filter.')
 .replace('Actual PS worker output','Actual cmd worker output').replace('Approved head/tail/literal-search and reviewed exclusive copy','Approved literal find and reviewed exclusive copy')
 .replaceAll('finite PS sleep','finite cmd wait').replace('Actual pinned Git through the checked PS worker reports staged-only unborn-index metadata and excludes unstaged content/untracked filenames.','Git/interpreters/expansions are unsupported whole input and never admit an unchecked worker.')
 .replace('real native PTY/PS/task','real native PTY/cmd/task').replace('completes actual cmd.','completes actual cmd.');
source=source.replaceAll('/^5\\.1(?:\\.|$)/','/Windows.*Version/');
source=source.replace('"Write-Output \'" + value + "\'"', `'echo "' + value + '"'`);
start=source.indexOf('            await check(5, async () => {');end=source.indexOf('            await check(6,',start);
if(start<0||end<0)throw Error('H05 marker missing');
source=source.slice(0,start)+String.raw`            await check(5, async () => {
                assert.ok(activeTerminal); nativeSubchecks["F12-H05"] = "VERSION";
                const version = await checked(activeTerminal, "ver"); assert.equal(version.status, "COMPLETE"); assert.match(version.stdout, /Windows.*Version/);
                nativeSubchecks["F12-H05"] = "LOCATION"; const location = await checked(activeTerminal, "cd"); assert.equal(location.status, "COMPLETE");
                const actual = resolve(location.stdout.trim()), expected = resolve(folder().uri.fsPath); nativeLocationIdentity = { exact: actual === expected, platformEquivalent: actual.toLowerCase() === expected.toLowerCase() }; assert.equal(nativeLocationIdentity.platformEquivalent, true);
                nativeSubchecks["F12-H05"] = "LISTING"; const listing = await checked(activeTerminal, "dir ."); assert.equal(listing.status, "COMPLETE"); assert.ok(listing.stdout.split("\n").includes("note.txt"));
                nativeSubchecks["F12-H05"] = "OWNERSHIP"; const current = await status(); assert.ok(current.workers.some(row => row.state === "EXITED" && row.exitCode === 0)); const durable = context.globalState.get<Snapshot[]>(OWNERSHIP); assert.ok(durable?.some(row => row.id === current.workers.at(-1)?.id));
            });
`+source.slice(end);
start=source.indexOf('            await check(10,');end=source.indexOf('            await check(11,',start);if(start<0||end<0)throw Error('H10 marker missing');
source=source.slice(0,start)+String.raw`            await check(10, async () => { assert.ok(activeTerminal); const found = await checked(activeTerminal, 'find "second" note.txt'); assert.equal(found.status, "COMPLETE"); assert.equal(found.stdout, "second public\n"); const result = await checked(activeTerminal, "copy note.txt approved-copy.txt"); assert.equal(result.status, "COMPLETE"); assert.equal(result.stdout, ""); assert.equal(await readFile(join(folder().uri.fsPath, "approved-copy.txt"), "utf8"), NOTE); withheld(await checked(activeTerminal, "copy note.txt approved-copy.txt")); });
`+source.slice(end);
start=source.indexOf('            await check(16,');end=source.indexOf('\n        }',start);if(start<0||end<0)throw Error('H16 marker missing');
source=source.slice(0,start)+String.raw`            await check(16, async () => { assert.ok(activeTerminal); const count = (await status()).workers.length; for (const input of ["git status", "cmd /c type .env.f12", "echo %PATH%", "set TOKEN=value", "ver|set"]) withheld(await checked(activeTerminal, input)); assert.equal((await status()).workers.length, count); });`+source.slice(end);
fs.writeFileSync(file('packages/vscode-extension/src/__tests__/host/liteCmd.host.ts'),source,{flag:'wx'});
const old=path.join(repo,'docs/soterai-lite/evidence/20261015-f10-ps51-3f12ab64');
const launcher=fs.readFileSync(path.join(old,'run-native-01.ps1'),'utf8');fs.writeFileSync(path.join(__dirname,'run-native-ps51-01.ps1'),launcher,{flag:'wx'});fs.writeFileSync(path.join(__dirname,'run-native-cmd-01.ps1'),launcher.replaceAll('F10','F12').replaceAll('f10','f12').replaceAll('PS5.1','cmd'),{flag:'wx'});
const build=fs.readFileSync(path.join(old,'build-native-host-01.cjs'),'utf8').replaceAll('litePowerShell51.host.ts','liteCmd.host.ts').replaceAll('lite-powershell51-host.js','lite-cmd-host.js');fs.writeFileSync(path.join(__dirname,'build-native-host-01.cjs'),build,{flag:'wx'});
