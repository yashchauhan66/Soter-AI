'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { Resvg } = require('@resvg/resvg-js');
const repo = path.resolve(__dirname, '../..');
const destination = path.resolve(repo, process.argv[2] ?? path.relative(repo, path.join(__dirname, 'assets')));
if (!destination.startsWith(repo + path.sep) || fs.existsSync(destination)) throw Error('Choose a new output directory inside the workspace.');
const logo = fs.readFileSync(path.join(repo, 'packages/soterai-lite/media/logo_circle_whiter.png')).toString('base64');
const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const text = (x, y, size, value, color = '#f8fafc', weight = 400, extra = '') => `<text x="${x}" y="${y}" font-family="Arial, sans-serif" font-size="${size}" font-weight="${weight}" fill="${color}" ${extra}>${escape(value)}</text>`;
function codeCard(x, y, width, height, scale = 1) {
  return `<g transform="translate(${x},${y}) scale(${scale})">
    <rect width="${width}" height="${height}" rx="22" fill="#121e30" stroke="#334155"/>
    <rect x="0" y="0" width="6" height="${height}" rx="3" fill="#f96403"/>
    ${text(28, 38, 12, 'REVIEWED CONTEXT', '#fdba74', 700, 'letter-spacing="2"')}
    ${text(28, 83, 20, 'HTTP 503 in connect()', '#e2e8f0', 700)}
    ${text(28, 126, 17, 'DB_PASSWORD = [REDACTED]', '#86efac')}
    ${text(28, 160, 17, 'API_PASSWORD = [REDACTED]', '#86efac')}
    ${text(28, 210, 17, 'Useful context stays in the preview.', '#cbd5e1')}
    <line x1="28" x2="${width - 28}" y1="237" y2="237" stroke="#334155"/>
    ${text(28, 270, 13, 'Synthetic illustration · not an editor screenshot', '#94a3b8')}
  </g>`;
}
function graphic(square) {
  const width = square ? 1080 : 1200, height = square ? 1080 : 630;
  const body = square ? `
    <image href="data:image/png;base64,${logo}" x="74" y="67" width="65" height="65"/>
    ${text(160, 108, 31, 'SoterAI Secret Guard', '#f8fafc', 700)}
    ${text(78, 208, 16, 'SECRET PROTECTION FOR AI CODING', '#fdba74', 700, 'letter-spacing="2"')}
    ${text(72, 306, 78, 'Check secrets', '#f8fafc', 700)}
    ${text(72, 396, 78, 'before your next', '#f8fafc', 700)}
    ${text(72, 486, 78, 'AI prompt.', '#fdba74', 700)}
    ${codeCard(76, 552, 760, 306, 1.22)}
    ${text(78, 990, 24, 'Local checks. Reviewed copy. Optional vault.', '#cbd5e1')}
    ${text(78, 1040, 19, 'Windows preview  ·  soterai.in', '#94a3b8')}
  ` : `
    <image href="data:image/png;base64,${logo}" x="66" y="55" width="56" height="56"/>
    ${text(141, 92, 27, 'SoterAI Secret Guard', '#f8fafc', 700)}
    ${text(70, 175, 13, 'SECRET PROTECTION FOR AI CODING', '#fdba74', 700, 'letter-spacing="1.7"')}
    ${text(66, 255, 62, 'Check secrets', '#f8fafc', 700)}
    ${text(66, 327, 62, 'before your next', '#f8fafc', 700)}
    ${text(66, 399, 62, 'AI prompt.', '#fdba74', 700)}
    ${text(70, 468, 19, 'Local checks. Reviewed copy. Optional vault.', '#cbd5e1')}
    ${codeCard(704, 174, 426, 304)}
    <line x1="70" x2="1130" y1="545" y2="545" stroke="#334155"/>
    ${text(70, 586, 18, 'Windows preview  ·  Review before sharing', '#94a3b8')}
    ${text(1130, 586, 20, 'soterai.in', '#f8fafc', 700, 'text-anchor="end"')}
  `;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <title>SoterAI Secret Guard promotional illustration</title>
    <desc>Check secrets before your next AI prompt. Synthetic redacted example; not an editor screenshot. Windows preview.</desc>
    <defs><radialGradient id="glow"><stop stop-color="#f96403" stop-opacity="0.16"/><stop offset="1" stop-color="#f96403" stop-opacity="0"/></radialGradient></defs>
    <rect width="100%" height="100%" fill="#0b1220"/>
    <circle cx="${width}" cy="0" r="680" fill="url(#glow)"/>
    ${body}
  </svg>`;
}
fs.mkdirSync(destination, { recursive: true });
const artifacts = [];
for (const square of [false, true]) {
  const name = square ? 'social-1080x1080' : 'social-1200x630', svg = graphic(square);
  const rendered = new Resvg(svg, { font: { loadSystemFonts: true, defaultFontFamily: 'Arial' } }).render();
  fs.writeFileSync(path.join(destination, name + '.svg'), svg, { flag: 'wx' });
  fs.writeFileSync(path.join(destination, name + '.png'), rendered.asPng(), { flag: 'wx' });
  artifacts.push({ name, width: rendered.width, height: rendered.height, role: 'promotional-illustration', syntheticData: true, editorScreenshot: false });
}
fs.writeFileSync(path.join(destination, 'manifest.json'), JSON.stringify({ brand: 'SoterAI Secret Guard', artifacts }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(artifacts));
