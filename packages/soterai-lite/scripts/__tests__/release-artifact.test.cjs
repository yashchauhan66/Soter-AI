'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { fixture } = require('./release-package.test.cjs');
const api = () => require('../release-artifact.cjs');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

async function packaged() {
    const f = await fixture(() => {}, true);
    const output = path.join(f.root, 'current-candidate.vsix');
    const pack = await require('../package.cjs').packageBuild({ repoRoot: f.repo, packageRoot: f.root, buildReceiptPath: f.receiptPath, output });
    const pointer = path.join(f.repo, 'release-pointer.json');
    await api().writeReleasePointer({ repoRoot: f.repo, packageReceiptPath: path.join(f.attempt, 'package-receipt.json'), pointerPath: pointer });
    return { ...f, pack, pointer, output };
}

test('P0 release resolves the exact Lite identity and artifact from a verified pointer', async () => {
    const f = await packaged(), result = await api().resolveRelease({ repoRoot: f.repo, pointerPath: f.pointer });
    assert.equal(result.identity, 'soterai.soterai-ide-guard');
    assert.equal(result.version, '0.7.0');
    assert.equal(result.artifactPath, 'packages/soterai-lite/current-candidate.vsix');
    assert.equal(result.sha256, f.pack.sha256);
    assert.equal(result.releaseReady, false);
    assert.equal(result.preRelease, true);
});

test('P0 release never selects a different VSIX when the receipt artifact is missing', async () => {
    const f = await packaged();
    await fs.copyFile(f.output, path.join(f.root, 'decoy.vsix'));
    await fs.unlink(f.output);
    await assert.rejects(api().resolveRelease({ repoRoot: f.repo, pointerPath: f.pointer }));
});

test('P0 changed artifact, receipt, inventory and build input each fail closed', async () => {
    for (const target of ['artifact', 'receipt', 'inventory', 'build']) {
        const f = await packaged();
        const file = target === 'artifact' ? f.output : target === 'receipt' ? path.join(f.attempt, 'package-receipt.json')
            : target === 'inventory' ? path.join(f.attempt, 'final-release-inventory.json') : f.receiptPath;
        await fs.appendFile(file, 'changed');
        await assert.rejects(api().resolveRelease({ repoRoot: f.repo, pointerPath: f.pointer }), target);
    }
});

test('P0 coherent pointer cannot redirect to a legacy identity or wrong version', async () => {
    for (const change of [pack => { pack.identity = 'soterai.legacy'; }, pack => { pack.version = '0.6.3'; },
        pack => { pack.output = '../outside.vsix'; }, pack => { pack.output = 'packages/soterai-lite/file\nartifact_sha256=bad.vsix'; }]) {
        const f = await packaged(), receiptPath = path.join(f.attempt, 'package-receipt.json');
        const pack = JSON.parse(await fs.readFile(receiptPath, 'utf8')); change(pack);
        const raw = Buffer.from(JSON.stringify(pack)); await fs.writeFile(receiptPath, raw);
        const pointer = JSON.parse(await fs.readFile(f.pointer, 'utf8')); pointer.packageReceiptSha256 = sha(raw);
        await fs.writeFile(f.pointer, JSON.stringify(pointer));
        await assert.rejects(api().resolveRelease({ repoRoot: f.repo, pointerPath: f.pointer }));
    }
});

test('P0 pointer creation is create-only and failed validation leaves no success pointer', async () => {
    const f = await packaged();
    await assert.rejects(api().writeReleasePointer({ repoRoot: f.repo, packageReceiptPath: path.join(f.attempt, 'package-receipt.json'), pointerPath: f.pointer }));
    await fs.appendFile(f.output, 'changed');
    const failed = path.join(f.repo, 'failed-pointer.json');
    await assert.rejects(api().writeReleasePointer({ repoRoot: f.repo, packageReceiptPath: path.join(f.attempt, 'package-receipt.json'), pointerPath: failed }));
    await assert.rejects(fs.stat(failed), { code: 'ENOENT' });
});

test('P0 workflow definitions use receipt-driven artifact identity', async () => {
    const repo = path.resolve(__dirname, '../../../..');
    for (const name of ['cross-ide-release.yml', 'signed-release.yml']) {
        const source = await fs.readFile(path.join(repo, '.github/workflows', name), 'utf8');
        assert.match(source, /release-artifact\.cjs/);
        assert.doesNotMatch(source, /packages\/vscode-extension\/\*\.vsix|packages\/vscode-extension\/package\.json|--prefix packages\/vscode-extension run verify:vsix/);
    }
});
