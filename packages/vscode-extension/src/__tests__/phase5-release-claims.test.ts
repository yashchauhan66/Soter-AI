import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '../../../..');
const unsupported = [
    /all AI agents \(including CLI tools\) see only placeholders/i,
    /Raw secrets sent to AI:\s*no/i,
    /Verified protected|Reproducible local proof on a synthetic canary/i,
    /The model sees placeholders and safe metadata, not raw sensitive values/i,
    /one local choke point for anything you are about to send/i,
    /zero known gaps in the detected workspace state/i,
    /hide them from ALL AI agents|Nothing leaves your machine by default\.|Safe to send\.|vault for real protection/i,
];

test('release claim checks detect their unsupported examples as a positive control', () => {
    const examples = ['all AI agents (including CLI tools) see only placeholders', 'Raw secrets sent to AI: no',
        'Verified protected', 'The model sees placeholders and safe metadata, not raw sensitive values',
        'one local choke point for anything you are about to send', 'zero known gaps in the detected workspace state', 'Migrate now to hide them from ALL AI agents?'];
    examples.forEach((text, index) => assert.ok(unsupported[index].test(text)));
});

test('canonical release UI and docs avoid the identified unconditional confidentiality claims', () => {
    const paths = ['packages/vscode-extension/src/extension.ts', 'packages/vscode-extension/src/launchCommands.ts',
        'packages/vscode-extension/src/commands.ts', 'packages/vscode-extension/src/advanced/commands.ts',
        'packages/vscode-extension/src/advanced/posture.ts', 'packages/vscode-extension/src/firewall/scanners.ts',
        'packages/vscode-extension/src/secret-shield/AutoVaultMigration.ts',
        'packages/vscode-extension/src/secret-broker/commands.ts', 'packages/vscode-extension/README.md',
        'docs/vscode-local-secret-privacy-proof.md', 'docs/ide-guard-limitations.md', 'docs/protected-secret-vault.md',
        'docs/ai-context-firewall.md', 'docs/marketplace-assets/soterai-long-description.md', 'docs/vscode-extension-readiness.md'];
    for (const path of paths) {
        const text = readFileSync(resolve(root, path), 'utf8');
        unsupported.forEach(pattern => assert.doesNotMatch(text, pattern, path));
        if (!['packages/vscode-extension/src/commands.ts', 'packages/vscode-extension/src/advanced/commands.ts',
            'packages/vscode-extension/src/advanced/posture.ts', 'packages/vscode-extension/src/firewall/scanners.ts'].includes(path)) {
            assert.match(text, /UNTESTED/, `${path} must retain the architecture limitation`);
        }
    }
});

test('palette names describe managed setup and preview without claiming full protection or observed model traffic', () => {
    const manifest = JSON.parse(readFileSync(resolve(root, 'packages/vscode-extension/package.json'), 'utf8'));
    const titles = new Map(manifest.contributes.commands.map((command: {command: string; title: string}) => [command.command, command.title]));
    assert.equal(titles.get('soterai.enableFullProtection'), 'Configure Managed Controls');
    assert.equal(titles.get('soterai.previewWhatAIWillSee'), 'Preview Managed AI Context');
});
