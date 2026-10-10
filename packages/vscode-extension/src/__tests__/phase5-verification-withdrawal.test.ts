import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const wrapper = resolve(__dirname, '../../../../docs/secretguard/guarantee-program-2026-10-09/phase4/verify-all.ps1');
const cases = [
    ['-ExpandedDependencyChecks:$false', 'dependency checks are disabled'],
    ['-NoProcessTermination:$false', 'does not close or kill Code.exe'],
    ['-DisableUniqueEvidence', 'Unique recording disabled'],
] as const;

for (const [flag, message] of cases) {
    test(`verification withdrawal refuses before creating evidence or launching a host: ${flag}`, { skip: process.platform !== 'win32' }, () => {
        const owned = mkdtempSync(join(tmpdir(), 'soterai-wrapper-withdrawal-'));
        const output = join(owned, 'must-not-exist');
        try {
            const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
                `& $env:SOTERAI_WRAPPER_PATH ${flag} -OutputRoot $env:SOTERAI_WRAPPER_OUTPUT`], {
                env: { ...process.env, SOTERAI_WRAPPER_PATH: wrapper, SOTERAI_WRAPPER_OUTPUT: output },
                encoding: 'utf8', timeout: 15000,
            });
            assert.equal(result.error, undefined);
            assert.notEqual(result.status, 0);
            assert.ok((result.stdout + result.stderr).includes(message));
            assert.equal(existsSync(output), false);
        } finally { rmdirSync(owned); }
    });
}

test('verification PowerShell parses successfully as a positive control', { skip: process.platform !== 'win32' }, () => {
    const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
        '$tokens=$null; $errors=$null; [void][System.Management.Automation.Language.Parser]::ParseFile($env:SOTERAI_WRAPPER_PATH,[ref]$tokens,[ref]$errors); if($errors.Count){$errors | Out-String; exit 1}; Write-Output "PARSE_OK"'], {
        env: { ...process.env, SOTERAI_WRAPPER_PATH: wrapper }, encoding: 'utf8', timeout: 15000,
    });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.stdout.includes('PARSE_OK'));
});
