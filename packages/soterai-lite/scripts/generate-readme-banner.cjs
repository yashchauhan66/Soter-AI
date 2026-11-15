'use strict';
// Render the README artwork from the existing extension icon. No product UI or results are simulated.
const fs = require('node:fs');
const path = require('node:path');
const { Resvg } = require('@resvg/resvg-js');
const root = path.resolve(__dirname, '..');
const pngPath = path.join(root, 'media/readme-hero.png');
const svgPath = path.join(root, 'media/readme-hero.svg');
for (const target of [pngPath, svgPath]) {
  if (fs.existsSync(target)) throw new Error(`Refusing to overwrite existing artwork: ${target}`);
}
const icon = fs.readFileSync(path.join(root, 'media/logo_circle_whiter.png')).toString('base64');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="384" viewBox="0 0 1440 384">
  <title>SoterAI Secret Guard</title>
  <desc>Check secrets before your next AI prompt. Local checks, reviewed context and optional encrypted vault. Brand header, not a product screenshot.</desc>
  <rect width="1440" height="384" rx="16" fill="#171a1f"/>
  <image href="data:image/png;base64,${icon}" x="52" y="40" width="64" height="64"/>
  <g font-family="Segoe UI, Arial, sans-serif">
    <text x="136" y="84" font-size="34" font-weight="600" fill="#f5f7fa">SoterAI Secret Guard</text>
    <text x="1384" y="82" text-anchor="end" font-size="24" font-weight="600" letter-spacing="1.2" fill="#b6bfc9">WINDOWS PREVIEW</text>
    <text x="56" y="186" font-size="62" font-weight="700" letter-spacing="-1.1" fill="#f5f7fa">Check secrets before</text>
    <text x="56" y="264" font-size="62" font-weight="700" letter-spacing="-1.1" fill="#ff984f">your next AI prompt.</text>
    <line x1="1020" y1="146" x2="1020" y2="274" stroke="#454c56" stroke-width="1"/>
    <text x="1060" y="174" font-size="26" fill="#e0e5eb">Scan locally.</text>
    <text x="1060" y="219" font-size="26" fill="#e0e5eb">Review the preview.</text>
    <text x="1060" y="264" font-size="26" fill="#e0e5eb">Copy when ready.</text>
    <line x1="56" y1="320" x2="1384" y2="320" stroke="#454c56" stroke-width="1"/>
    <text x="56" y="359" font-size="24" fill="#b6bfc9">Code &amp; debug context</text>
    <text x="1384" y="359" text-anchor="end" font-size="24" fill="#b6bfc9">Optional encrypted vault</text>
  </g>
</svg>`;
const image = new Resvg(svg, { font: { loadSystemFonts: true, defaultFontFamily: 'Segoe UI' } }).render();
fs.writeFileSync(svgPath, svg + '\n', { flag: 'wx' });
const png = image.asPng();
fs.writeFileSync(pngPath, png, { flag: 'wx' });
console.log(JSON.stringify({ png: pngPath, source: svgPath, width: image.width, height: image.height, bytes: png.length, role: 'brand-header-not-product-evidence' }));
