// Rebuild the Marketplace/IDE banner from the existing product mark.
// This is a brand illustration, not an application screenshot.
'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');

async function main() {
  const root = path.resolve(__dirname, '../..');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="560" viewBox="0 0 1600 560">
    <defs>
      <linearGradient id="bg" x2="1" y2="1"><stop stop-color="#101B2A"/><stop offset="1" stop-color="#07111D"/></linearGradient>
      <radialGradient id="glow"><stop stop-color="#F96403" stop-opacity=".16"/><stop offset="1" stop-color="#F96403" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="1600" height="560" rx="24" fill="url(#bg)"/>
    <rect x="1" y="1" width="1598" height="558" rx="23" fill="none" stroke="#2A3747"/>
    <circle cx="1320" cy="240" r="310" fill="url(#glow)"/>
    <g fill="none" stroke="#47515F" stroke-opacity=".45">
      <circle cx="1320" cy="238" r="164"/><circle cx="1320" cy="238" r="207"/>
    </g>
    <g font-family="Segoe UI, Arial, sans-serif">
      <text x="76" y="88" fill="#FF8C43" font-size="28" font-weight="700" letter-spacing="4">SOTERAI SECRET GUARD</text>
      <text x="72" y="203" fill="#F7F9FC" font-size="76" font-weight="700">Check secrets before</text>
      <text x="72" y="290" fill="#F7F9FC" font-size="76" font-weight="700">your next AI prompt.</text>
      <text x="76" y="351" fill="#B5C3D4" font-size="28">Local checks. Reviewed previews. Your choice to copy.</text>
      <path d="M76 408 H1524" stroke="#2A3747"/>
      <g font-size="26" font-weight="600">
        <text x="76" y="469" fill="#FF8C43">01</text><text x="132" y="469" fill="#E3EAF3">Scan locally</text>
        <text x="564" y="469" fill="#FF8C43">02</text><text x="620" y="469" fill="#E3EAF3">Review the preview</text>
        <text x="1100" y="469" fill="#FF8C43">03</text><text x="1156" y="469" fill="#E3EAF3">Copy when ready</text>
      </g>
      <text x="76" y="519" fill="#9CAFC4" font-size="21">WINDOWS x64 PREVIEW</text>
      <text x="1524" y="519" fill="#9CAFC4" font-size="21" text-anchor="end">NO SOTERAI ACCOUNT FOR LOCAL CHECKS</text>
    </g>
  </svg>`;
  const logo = await sharp(path.join(root, 'packages/soterai-lite/media/logo_circle_whiter.png'))
    .resize(248, 248).png().toBuffer();
  const banner = await sharp(Buffer.from(svg)).composite([{ input: logo, left: 1196, top: 114 }])
    .png({ compressionLevel: 9 }).toBuffer();
  for (const name of ['soterai-lite', 'vscode-extension']) {
    const destination = path.join(root, 'packages', name, 'media', 'readme-hero.png');
    await fs.writeFile(destination, banner);
    console.log(`${path.relative(root, destination)} (${banner.length} bytes)`);
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
