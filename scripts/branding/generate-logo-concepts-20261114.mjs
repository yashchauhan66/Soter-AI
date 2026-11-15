import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';

const require = createRequire(import.meta.url);
const fontkit = require('fontkit');
const repo = path.resolve(import.meta.dirname, '../..');
const output = path.join(repo, 'public/brand/logo-concepts-20261114');
const primary = '#F96403', ink = '#172738', paper = '#FFFFFF';
const font = fontkit.openSync('C:/Windows/Fonts/seguisb.ttf');
const regular = fontkit.openSync('C:/Windows/Fonts/segoeui.ttf');
const esc = s => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const outline = (text, x, y, size, color, face = font, tracking = -0.35) => {
  const run = face.layout(text), scale = size / face.unitsPerEm;
  let cursor = x;
  return run.glyphs.map((glyph, i) => {
    const p = run.positions[i];
    const result = `<path fill="${color}" transform="translate(${(cursor + p.xOffset * scale).toFixed(3)} ${(y - p.yOffset * scale).toFixed(3)}) scale(${scale.toFixed(6)} ${(-scale).toFixed(6)})" d="${glyph.path.toSVG()}"/>`;
    cursor += p.xAdvance * scale + tracking;
    return result;
  }).join('');
};
const advance = (text, size, tracking = -0.35) => font.layout(text).positions.reduce((sum, p) => sum + p.xAdvance * size / font.unitsPerEm + tracking, 0);
const word = (x, y, size, tone, accent) => outline('Soter', x, y, size, tone) + outline('AI', x + advance('Soter', size) + 0.6, y, size, accent);
const roundedRing = (x, y, w, h, r, inset) => {
  const rect = (a,b,c,d,e) => `M${a+e} ${b}H${a+c-e}Q${a+c} ${b} ${a+c} ${b+e}V${b+d-e}Q${a+c} ${b+d} ${a+c-e} ${b+d}H${a+e}Q${a} ${b+d} ${a} ${b+d-e}V${b+e}Q${a} ${b} ${a+e} ${b}Z`;
  return rect(x,y,w,h,r) + rect(x+inset,y+inset,w-2*inset,h-2*inset,Math.max(2,r-inset));
};
export const concepts = [
  { id:'01', slug:'boundary-s', name:'Boundary S', meaning:'A custom S built from opposing enclosure bands. A memorable signature for controlled AI access.', recommended:true,
    shapes:(a,b)=>`<path fill="${a}" d="M106 16H42L18 40V66L42 82H90V94H18V112H86L110 88V62L86 46H38V34H106Z"/>` },
  { id:'02', slug:'keystone-crest', name:'Keystone Crest', meaning:'An S-shaped negative passage cut into a compact shield. The clearest immediate security signal.', recommended:true,
    shapes:(a,b)=>`<path fill="${a}" fill-rule="evenodd" d="M64 10L112 28V58C112 87 92 108 64 120C36 108 16 87 16 58V28Z M88 38H56L40 52V64L56 74H76V82H44V94H78L92 80V66L76 56H56V50H88Z"/>` },
  { id:'03', slug:'guarded-core', name:'Guarded Core', meaning:'A protected diamond core with a controlled entrance. A direct link to securing agents and their tools.', recommended:true,
    shapes:(a,b)=>`<path fill="${a}" d="M64 12L86 34L72 48L64 40L40 64L64 88L88 64L82 58L96 44L116 64L64 116L12 64Z"/><path fill="${b}" d="M88 14L114 40L106 48L80 22Z M64 52L76 64L64 76L52 64Z"/>` },
  { id:'04', slug:'sentry-gate', name:'Sentry Gate', meaning:'Architectural boundaries protect an upright core. Access control expressed in a developer-friendly mark.',
    shapes:(a,b)=>`<path fill="${b}" d="M18 18H68V34H36V88H54V106H18Z M110 110H60V94H92V40H74V22H110Z"/><rect fill="${a}" x="52" y="49" width="24" height="30" rx="12"/>` },
  { id:'05', slug:'trust-link', name:'Trust Link', meaning:'Two substantial links form a trusted connection. Designed for secure integrations, permissions and collaboration.',
    shapes:(a,b)=>`<g transform="rotate(-35 64 64)"><path fill="${a}" fill-rule="evenodd" d="${roundedRing(12,27,70,44,12,14)}"/><path fill="${b}" fill-rule="evenodd" d="${roundedRing(46,57,70,44,12,14)}"/></g>` },
  { id:'06', slug:'sentinel-fold', name:'Sentinel Fold', meaning:'Three bold folds form an upright guardian. An abstract, confident identity built around protection.',
    shapes:(a,b)=>`<path fill="${a}" d="M20 26L68 12L108 32L80 48L66 32L36 42Z M58 56L76 66L54 84L68 96V116L20 88V50L40 62V78Z"/><path fill="${b}" d="M108 42V80L78 108V86L88 72V54Z"/>` },
  { id:'07', slug:'policy-seal', name:'Policy Seal', meaning:'A strong octagonal boundary with verification built into its negative space. Assurance without visual clutter.',
    shapes:(a,b)=>`<path fill="${a}" fill-rule="evenodd" d="M38 14H92L114 36V86L90 114H36L14 88V38Z M32 60L48 76L88 36L100 48L48 100L20 72Z"/>` },
  { id:'08', slug:'agent-orbit', name:'Agent Orbit', meaning:'Opposing protective bands surround a square agent core. A softer expression of secure, controlled autonomy.',
    shapes:(a,b)=>`<path fill="${a}" d="M66 12A50 50 0 0 0 16 62V84H34V62A32 32 0 0 1 66 30H88V12Z"/><path fill="${b}" d="M62 116A50 50 0 0 0 112 66V44H94V66A32 32 0 0 1 62 98H40V116Z"/><path fill="${a}" d="M64 46L82 64L64 82L46 64Z"/>` },
  { id:'09', slug:'vault-cut', name:'Vault Cut', meaning:'A clipped enclosure with an angular key aperture. A restrained identity for secrets, credentials and privacy.',
    shapes:(a,b)=>`<path fill="${a}" fill-rule="evenodd" d="M36 12H108Q116 12 116 20V92L92 116H20Q12 116 12 108V36Z M64 36L84 56L72 68V92H56V68L44 56Z"/>` },
  { id:'10', slug:'guard-rail', name:'Guard Rail', meaning:'Execution lanes stop at a decisive policy boundary. A minimal direction for enforcement and safe automation.',
    shapes:(a,b)=>`<path fill="${a}" d="M14 20H82V38H14Z M26 55H66V73H26Z M14 90H82V108H14Z"/><path fill="${b}" d="M92 14H110V114H92Z"/>` },
];

const svg = (name, description, viewBox, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" role="img" aria-labelledby="title desc"><title id="title">${esc(name)}</title><desc id="desc">${esc(description)}</desc>${body}</svg>\n`;
const files = [];
async function emit(relative, bytes) {
  await writeFile(path.join(output, relative), bytes, { flag:'wx' });
  files.push({ path:relative, bytes:Buffer.byteLength(bytes), sha256:createHash('sha256').update(bytes).digest('hex') });
}
function render(source, width) { return new Resvg(source, { fitTo:{ mode:'width',value:width } }).render().asPng(); }
async function build() {
  try { await access(output); throw Error('Existing design collection is preserved; choose a new dated directory.'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  await mkdir(output,{recursive:true});
  for (const c of concepts) {
    const basename = `${c.id}-${c.slug}`;
    const variants = [ ['mark',primary,ink,false],['mark-dark',primary,paper,false],['mark-mono',ink,ink,false],['mark-white',paper,paper,false],
      ['wordmark',primary,ink,true],['wordmark-dark',primary,paper,true],['wordmark-mono',ink,ink,true],['wordmark-white',paper,paper,true] ];
    for (const [variant,a,b,isWord] of variants) {
      const body = isWord ? `<g transform="translate(2 10) scale(.82)">${c.shapes(a,b)}</g>${word(130,88,64,b,a)}` : c.shapes(a,b);
      const source = svg(`SoterAI — ${c.name}`, c.meaning, isWord ? '0 0 360 128' : '0 0 128 128',body);
      await emit(`${basename}.${variant}.svg`,source);
      if (variant==='mark') {
        for (const size of [1024,512,128,64,32,24,16]) {
          const raster = size<128 ? await sharp(render(source,512)).resize(size,size,{kernel:'lanczos3'}).png().toBuffer() : render(source,size);
          await emit(`${basename}.${size}.png`,raster);
        }
      }
      if (variant==='wordmark' || variant==='wordmark-dark') await emit(`${basename}.${variant}.png`,render(source,1440));
    }
  }
  const sheetWidth=2400,sheetHeight=2860,cardW=1112,cardH=490;
  let sheet = `<rect width="${sheetWidth}" height="${sheetHeight}" fill="#F4F4F0"/>`;
  sheet += outline('SoterAI',88,119,65,ink) + outline('TEN SECURITY IDENTITIES',90,172,21,'#65717D',regular,1.4);
  sheet += outline('Original vector concepts · 14 November 2026',90,213,21,'#65717D',regular,.05);
  concepts.forEach((c,i)=>{
    const x=80+(i%2)*1128,y=256+Math.floor(i/2)*508;
    sheet+=`<rect x="${x}" y="${y}" width="${cardW}" height="${cardH}" rx="24" fill="white"/>`;
    sheet+=outline(c.id,x+34,y+51,19,'#65717D',regular,1)+outline(c.name,x+82,y+53,25,ink);
    if(c.recommended) sheet+=outline('SHORTLIST',x+901,y+49,14,'#B23B0B',font,1);
    sheet+=`<g transform="translate(${x+445} ${y+90}) scale(1.72)">${c.shapes(primary,ink)}</g>`;
    sheet+=`<g transform="translate(${x+35} ${y+325}) scale(.48)">${c.shapes(ink,ink)}</g>${word(x+111,y+371,42,ink,primary)}`;
    sheet+=`<rect x="${x+561}" y="${y+311}" width="515" height="105" rx="12" fill="${ink}"/><g transform="translate(${x+594} ${y+331}) scale(.48)">${c.shapes(paper,paper)}</g>${word(x+669,y+376,42,paper,paper)}`;
    sheet+=outline('FAVICON',x+34,y+459,13,'#65717D',regular,1);
    sheet+=`<g transform="translate(${x+141} ${y+434}) scale(.1875)">${c.shapes(primary,ink)}</g><g transform="translate(${x+188} ${y+437}) scale(.125)">${c.shapes(ink,ink)}</g>`;
    sheet+=outline('24 px / 16 px',x+233,y+459,15,'#65717D',regular,.1);
    sheet+=`<circle cx="${x+1016}" cy="${y+451}" r="11" fill="${primary}"/><circle cx="${x+1052}" cy="${y+451}" r="11" fill="${ink}"/>`;
  });
  sheet+=outline('SoterAI / Brand exploration',88,2830,17,'#65717D',regular,.2);
  const contact = svg('SoterAI: ten security logo concepts','Light, dark, monochrome and favicon comparisons of ten original logo directions.',`0 0 ${sheetWidth} ${sheetHeight}`,sheet);
  await emit('contact-sheet.svg',contact);
  await emit('contact-sheet.png',render(contact,sheetWidth));
  const brief = { brand:'SoterAI',date:'2026-11-14',method:'Original hand-authored vector geometry; outlined wordmark; no image generation API',palette:{graphic:primary,ink,white:paper,accessibleOrangeText:'#B23B0B'},recommended:['01','02','03'],concepts:concepts.map(({shapes,...c})=>c),variants:'8 SVG + 9 PNG per concept',files };
  await emit('manifest.json',JSON.stringify(brief,null,2)+'\n');
  console.log(JSON.stringify({output:path.relative(repo,output),concepts:concepts.length,files:files.length,contactSheet:'contact-sheet.png'}));
}
await build();
