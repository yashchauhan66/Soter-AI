// Phase 10 JS SDK smoke test (run from install-test dir)
const path = require('path');
const sdk = require('@soterai/core');

const keys = Object.keys(sdk);
console.log('SDK loaded OK. exports:', keys.length);
console.log('top-level keys (first 10):', keys.slice(0, 10).join(', '));

// 1) Construct client with invalid key — should not throw on construction
let constructed = false;
try {
  const { SoterClient } = sdk;
  if (typeof SoterClient === 'function') {
    const c = new SoterClient({ apiKey: 'invalid-test-key' });
    constructed = typeof c === 'object';
    console.log('SoterClient constructed with invalid key (safe):', constructed);
  } else {
    console.log('SoterClient not directly exported; checking for analogous client...');
    const clientLike = keys.find((k) => /client/i.test(k));
    console.log('clientLike export present:', clientLike, typeof sdk[clientLike]);
  }
} catch (err) {
  console.log('Construction error (must be safe/typed, not a crash):', err && err.message);
}

// 2) Types entrypoint resolves
try {
  const typesEntry = require.resolve('@soterai/core', { paths: [process.cwd()] });
  console.log('main entry resolved:', typesEntry);
} catch (err) {
  console.log('Cannot resolve main entry:', err.message);
}

// 3) Index export shape sanity
const mustHaves = ['client', 'errors'];
const lower = keys.map((k) => k.toLowerCase());
const present = mustHaves.filter((m) => lower.some((k) => k.includes(m)));
console.log('must-have exports present:', present.join(', ') || '(none — list exports below)');
