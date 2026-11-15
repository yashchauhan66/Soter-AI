"""Build SoterAI's seven bespoke logo letters. Requires FontTools (build only)."""
import argparse
from datetime import datetime
from hashlib import sha256
from io import BytesIO
import json
from pathlib import Path
import sys
import xml.etree.ElementTree as ET

parser = argparse.ArgumentParser()
parser.add_argument('--tools-dir', help='Optional isolated FontTools wheel directory')
parser.add_argument('--out-dir', help='Defaults to public/brand in this repository')
args = parser.parse_args()
if args.tools_dir:
    sys.path.insert(0, str(Path(args.tools_dir).resolve()))
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.svgLib.path import parse_path
from fontTools.feaLib.builder import addOpenTypeFeaturesFromString

root = Path(__file__).resolve().parents[1]
out = Path(args.out_dir) if args.out_dir else root / 'public/brand'
# Original outlines: softened geometry with clipped terminals and an architectural A.
# Coordinates use the font's upward y-axis; these are not outlines from a third-party font.
letters = {
    'S': (625, 'M563 627L494 548Q415 623 310 623Q194 623 194 543Q194 482 296 448L389 417Q579 351 579 203Q579 -11 310 -11Q145 -11 38 74L108 164Q201 87 302 87Q465 87 465 202Q465 270 356 309L254 343Q84 400 84 540Q84 717 296 717Q457 717 563 627Z'),
    'o': (580, 'M290 -10Q20 -10 20 260Q20 530 290 530Q560 530 560 260Q560 -10 290 -10Z M290 96Q451 96 451 260Q451 424 290 424Q129 424 129 260Q129 96 290 96Z'),
    't': (370, 'M112 650L219 690V520H348V425H219V157Q219 89 294 89H348V-5Q313 -14 272 -14Q112 -14 112 151V425H20V520H112Z'),
    'e': (570, 'M540 245H126Q134 94 279 94Q400 94 465 166L532 101Q441 -10 275 -10Q18 -10 18 262Q18 530 282 530Q540 530 540 273Z M127 331H430Q414 434 282 434Q149 434 127 331Z'),
    'r': (365, 'M33 0V520H131L142 447Q205 530 313 530H339V425H290Q143 425 143 263V0Z'),
    'A': (645, 'M24 0L255 700H382L622 0H505L452 161H185L134 0Z M218 263H418L317 570Z'),
    'I': (260, 'M20 680L40 700H240V611H183V89H240V0H20V89H77V611H20Z'),
}
order = ['.notdef', *letters]
fb = FontBuilder(1000, isTTF=True)
fb.setupGlyphOrder(order)
fb.setupCharacterMap({ord(ch): ch for ch in letters})
glyphs = {}
for name in order:
    pen = TTGlyphPen(None)
    if name != '.notdef':
        parse_path(letters[name][1], pen)
    glyphs[name] = pen.glyph()
fb.setupGlyf(glyphs)
metrics = {'.notdef': (500, 0)}
for ch, (advance, _) in letters.items():
    glyphs[ch].recalcBounds(fb.font['glyf'])
    metrics[ch] = (advance, glyphs[ch].xMin)
fb.setupHorizontalMetrics(metrics)
fb.setupHorizontalHeader(ascent=850, descent=-150, lineGap=0)
fb.setupNameTable({'familyName': 'SoterAI Signature', 'styleName': 'SemiBold',
    'uniqueFontIdentifier': 'SoterAI Signature 1.0', 'fullName': 'SoterAI Signature SemiBold',
    'psName': 'SoterAI-Signature-SemiBold', 'version': 'Version 1.0'})
fb.setupOS2(sTypoAscender=850, sTypoDescender=-150, sTypoLineGap=0, usWinAscent=850,
    usWinDescent=150, sxHeight=520, sCapHeight=700, usWeightClass=600, fsSelection=0)
fb.setupPost()
pairs = [('S', 'o', -20), ('o', 't', -25), ('t', 'e', -15), ('e', 'r', -5), ('r', 'A', -35), ('A', 'I', -15)]
addOpenTypeFeaturesFromString(fb.font, 'feature kern {\n' + '\n'.join(f'pos {a} {b} {amount};' for a, b, amount in pairs) + '\n} kern;')
stamp = int((datetime(2020, 1, 1) - datetime(1904, 1, 1)).total_seconds())
fb.font['head'].created = stamp
fb.font['head'].modified = stamp
fb.font.recalcTimestamp = False
fb.font.flavor = 'woff'
font_bytes = BytesIO()
fb.font.save(font_bytes)
font_bytes = font_bytes.getvalue()

# Combine the exact retained cube paths with the exact custom lettering outlines.
master = root / 'public/brand/soterai-symbol.svg'
master_raw = master.read_bytes()
assert sha256(master_raw).hexdigest() == '6bf900b7c47b928fb49ebd3895a3db7a10133e1bee51b321328b355bd234a648', 'Retain the previous cube unchanged'
ET.register_namespace('', 'http://www.w3.org/2000/svg')
cube = ''.join(ET.tostring(child, encoding='unicode').strip() for child in ET.fromstring(master_raw) if child.tag.endswith('path'))
x = 0
paths = []
kerns = {(a, b): k for a, b, k in pairs}
previous = None
for ch in 'SoterAI':
    if previous:
        x += kerns.get((previous, ch), 0)
    paths.append(f'<path data-letter="{ch}" transform="translate({x} 0)" d="{letters[ch][1]}"/>')
    x += letters[ch][0]
    previous = ch
width = round(82 + x * .05 + 10, 2)
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="80" viewBox="0 0 {width} 80" role="img" aria-labelledby="signature-title" data-brand-symbol="sentinel-s" data-lettering="soterai-signature">
<title id="signature-title">SoterAI — retained cube and custom Signature lettering</title>
<g transform="translate(0 8)">{cube}</g>
<g fill="#14110f" transform="translate(82 58) scale(.05 -.05)">{''.join(paths)}</g>
</svg>'''.encode()
# Build all buffers before replacing generated outputs.
outputs = {'soterai-signature.woff': font_bytes, 'soterai-wordmark.svg': svg}
out.mkdir(parents=True, exist_ok=True)
for filename, data in outputs.items():
    (out / filename).write_bytes(data)
print(json.dumps({'family': 'SoterAI Signature', 'letters': list(letters), 'kerningPairs': pairs,
    'wordAdvance': x, 'cubeSha256': sha256(master_raw).hexdigest(),
    'outputs': {name: {'bytes': len(data), 'sha256': sha256(data).hexdigest()} for name, data in outputs.items()}}, indent=2))
