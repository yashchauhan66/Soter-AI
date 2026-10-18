const fs=require('node:fs'),path=require('node:path'),edit=(n,f)=>{const p=path.join(__dirname,n);fs.writeFileSync(p,f(fs.readFileSync(p,'utf8')));};
edit('f15c-evidence-lib.cjs',s=>s.replace(/const git = \(\.\.\.args\) => cp\.execFileSync\([^\n]+\);/, 'const git = require("./git-batch-01.cjs").createGit(repo);'));
edit('check-staged-01.cjs',s=>s.replace('const entries = new Map(index.entries.map(entry => [entry.path, entry]));','git.preload("", index.entries.map(entry => entry.path));\nconst entries = new Map(index.entries.map(entry => [entry.path, entry]));'));
edit('verify-commit-01.cjs',s=>s.replace('for (const entry of index.entries)', 'git.preload(revision, index.entries.map(entry => entry.path));\nfor (const entry of index.entries)'));
edit('transition-lib-01.cjs',s=>s.replace('for(const e of index.entries)', 'git.preload(sourceRevision,index.entries.map(e=>e.path));for(const e of index.entries)'));
console.log('Equivalent explicit Git batch reads enabled; all existing SHA/path/current-file assertions retained.');
