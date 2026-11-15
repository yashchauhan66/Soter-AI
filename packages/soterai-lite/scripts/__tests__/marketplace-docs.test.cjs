'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

test('Marketplace README puts the canonical install links before advanced documentation', () => {
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
  const identity = `${manifest.publisher}.${manifest.name}`;
  const introduction = readme.slice(0, 2000);
  assert.ok(introduction.includes(`https://marketplace.visualstudio.com/items?itemName=${identity}`),
    'Readers need the actual VS Code Marketplace install link near the top.');
  assert.ok(introduction.includes(`https://open-vsx.org/extension/${manifest.publisher}/${manifest.name}`),
    'Readers need the canonical Open VSX listing near the top.');
  assert.ok(readme.includes(`code --install-extension ${identity} --pre-release`),
    'The documented CLI install must select the pre-release channel.');
  assert.ok(readme.includes('https://github.com/yashchauhan66/Soter-AI/blob/main/packages/soterai-lite/USER-GUIDE.md'),
    'The Marketplace page needs an absolute guide URL because packaging preserves reviewed Markdown bytes.');
  assert.ok(readme.length <= 10000, 'Keep the Marketplace page scannable; put the technical reference in the user guide.');
});

test('The detailed user guide and PNG banner are included in both package allowlists', () => {
  const { FINAL_ASSETS } = require('../audit-release.cjs');
  for (const file of ['USER-GUIDE.md', 'media/readme-hero.png']) {
    assert.ok(fs.existsSync(path.join(root, file)), `Missing shipped documentation: ${file}`);
    assert.ok(manifest.files.includes(file), `The manifest excludes ${file}`);
    assert.ok(FINAL_ASSETS.includes(file), `The immutable package receipt excludes ${file}`);
  }
  const banner = fs.readFileSync(path.join(root, 'media/readme-hero.png'));
  assert.deepEqual(banner.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  assert.ok(banner.length < 300000, 'Keep the static README banner below 300 KB.');
});

test('The bundled user guide documents real command titles and setting defaults', () => {
  const file = path.join(root, 'USER-GUIDE.md');
  assert.ok(fs.existsSync(file), 'A bundled user guide is required.');
  const guide = fs.readFileSync(file, 'utf8');
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
  const titles = new Set(manifest.contributes.commands.map(c => `${c.category}: ${c.title}`));
  const claimed = [...(readme + '\n' + guide).matchAll(/`(SoterAI: [^`]+)`/g)].map(m => m[1]);
  assert.ok(new Set(claimed).size >= 10, 'Document usable workflows, not only headings.');
  assert.deepEqual([...new Set(claimed)].filter(title => !titles.has(title)), [], 'Unknown command title.');
  const rows = [...guide.matchAll(/^\| `(soterai\.[\w.]+)` \| `([^`]+)` \|/gm)];
  assert.ok(rows.length >= 6, 'Document the core defaults.');
  for (const [, key, displayed] of rows) {
    const setting = manifest.contributes.configuration.properties[key];
    assert.ok(setting, `Unknown setting ${key}`);
    assert.equal(displayed, String(setting.default), `Incorrect default for ${key}`);
  }
});

test('Reader-facing documentation retains preview, network and recovery boundaries', () => {
  const guidePath = path.join(root, 'USER-GUIDE.md');
  assert.ok(fs.existsSync(guidePath), 'A bundled user guide is required.');
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
  const guide = fs.readFileSync(guidePath, 'utf8');
  assert.match(readme, /not release-ready or independently reviewed/i);
  assert.match(readme, /Registry links may serve an older version/i);
  assert.match(readme, /independent uploads/i);
  assert.match(readme, /Configured provider requests/i);
  assert.match(guide, /soterai\.showAllCommands/);
  assert.match(guide, /absent or empty/);
  assert.match(guide, /never merge snapshots/i);
  assert.match(guide, /same editor profile/i);
  assert.match(guide, /Pre-commit \(F26a\) is an opt-in candidate pending native verification/);
  assert.match(readme, /current Coverage view marks live AI-tool routes as Uncovered/);
});

test('Marketplace documentation uses portable HTTPS links and valid source-bound anchors', () => {
  const md = require('markdown-it')({ html: true });
  const docs = ['README.md', 'USER-GUIDE.md', 'PRIVACY.md', 'CHANGELOG.md'];
  const sourceBase = 'https://github.com/yashchauhan66/Soter-AI/blob/main/packages/soterai-lite/';
  const imageBase = 'https://raw.githubusercontent.com/yashchauhan66/Soter-AI/main/packages/soterai-lite/';
  const tokens = file => md.parse(fs.readFileSync(path.join(root, file), 'utf8'), {});
  const anchors = file => new Set(tokens(file).flatMap((token, i, all) => token.type === 'heading_open'
    ? [all[i + 1].content.toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-')]
    : []));
  let images = 0;
  for (const doc of docs) {
    const walk = items => {
      for (const token of items) {
        if (token.type === 'image') {
          images++;
          const src = token.attrGet('src');
          assert.ok(src.startsWith(imageBase) && src.endsWith('.png'), `A source-bound HTTPS PNG is required: ${src}`);
          assert.ok(fs.existsSync(path.join(root, src.slice(imageBase.length))), `Missing local source for ${src}`);
          assert.ok(token.content.length > 12, 'Use descriptive image alternative text.');
        }
        if (token.type === 'link_open') {
          const href = token.attrGet('href');
          assert.ok(href.startsWith('https://') || href.startsWith('#'), `Unportable Marketplace link in ${doc}: ${href}`);
          let target = doc, fragment;
          if (href.startsWith('#')) fragment = href.slice(1);
          else if (href.startsWith(sourceBase)) {
            const parts = href.slice(sourceBase.length).split('#');
            target = parts[0]; fragment = parts[1];
            assert.ok(!target.includes('..') && fs.existsSync(path.join(root, target)), `Missing source-bound document: ${target}`);
          }
          if (fragment) assert.ok(anchors(target).has(fragment), `Broken heading link: ${doc} -> ${href}`);
        }
        if (token.children) walk(token.children);
      }
    };
    walk(tokens(doc));
  }
  assert.equal(images, 1, 'Keep the Marketplace page lightweight with one deliberate brand header.');
});
