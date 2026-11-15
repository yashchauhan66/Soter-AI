import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('pending and unavailable hero requests are not labelled as recorded results', () => {
  const source = readFileSync(new URL('../components/sa/HeroDemo.tsx', import.meta.url), 'utf8');
  const bar = source.slice(source.indexOf('className="sa-hero-demo__bar"'), source.indexOf('className="sa-field"'));
  assert.ok(bar.includes("shown.kind === 'recorded'"), 'only the recorded state gets the dated recorded label');
  assert.ok(bar.includes('No engine result'), 'an unavailable live request must not be described as a recording');
});
