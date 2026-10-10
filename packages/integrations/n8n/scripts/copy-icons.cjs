const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
let count = 0;
function copyIcons(relative) {
  for (const entry of fs.readdirSync(path.join(root, relative), { withFileTypes: true })) {
    const next = path.join(relative, entry.name);
    if (entry.isDirectory()) copyIcons(next);
    else if (entry.isFile() && entry.name.endsWith('.svg')) {
      const target = path.join(root, 'dist', next);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(path.join(root, next), target);
      count++;
    }
  }
}
copyIcons('nodes');
copyIcons('credentials');
console.log(`Copied ${count} SVG icons into dist.`);
