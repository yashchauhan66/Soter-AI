from pathlib import Path
import json
import xml.etree.ElementTree as ET
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from PIL import Image
from playwright.sync_api import sync_playwright

repository = Path(__file__).resolve().parents[2]
assets = repository / 'public/brand/logo-concepts-20261114'
evidence = repository / 'output/branding/logo-gallery-20261114'
evidence.mkdir(parents=True, exist_ok=True)
manifest = json.loads((assets / 'manifest.json').read_text(encoding='utf-8'))
assert len(manifest['concepts']) == 10
svg_count = 0
for file in assets.glob('*.svg'):
    tree = ET.fromstring(file.read_text(encoding='utf-8'))
    assert tree.tag.endswith('svg')
    assert not any(element.tag.endswith(('script', 'image', 'text')) for element in tree.iter())
    assert not any('href' in key for element in tree.iter() for key in element.attrib)
    svg_count += 1
for concept in manifest['concepts']:
    name = f"{concept['id']}-{concept['slug']}"
    for size in (1024, 512, 128, 64, 32, 24, 16):
        with Image.open(assets / f'{name}.{size}.png') as image:
            assert image.size == (size, size)
            alpha = image.getchannel('A')
            assert alpha.getextrema() == (0, 255)
            if size >= 128:
                x0, y0, x1, y1 = alpha.getbbox()
                assert x0 > 0 and y0 > 0 and x1 < size and y1 < size, f'{name}: clipped image bounds'

errors = []
class PreviewHandler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

server = ThreadingHTTPServer(('127.0.0.1', 0), partial(PreviewHandler, directory=str(assets)))
server_thread = Thread(target=server.serve_forever, daemon=True)
server_thread.start()
with sync_playwright() as playwright:
    browser = playwright.chromium.launch(
        executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe', headless=True,
        args=['--disable-background-networking', '--disable-component-update', '--no-first-run', '--disable-sync'],
    )
    try:
        page = browser.new_page(viewport={'width': 1440, 'height': 1000}, device_scale_factor=1)
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(f'http://127.0.0.1:{server.server_port}/index.html', wait_until='networkidle')
        assert page.locator('article.concept').count() == 10
        assert page.locator('.main-logo').count() == 10
        assert page.evaluate('Array.from(document.images).every(image => image.complete && image.naturalWidth > 0)')
        page.screenshot(path=str(evidence / 'gallery-light.png'), full_page=True)
        page.get_by_role('button', name='Wordmark', exact=True).click()
        page.get_by_role('button', name='Dark background', exact=True).click()
        assert page.locator('html').get_attribute('data-theme') == 'dark'
        page.wait_for_function('Array.from(document.images).every(image => image.complete && image.naturalWidth > 0)')
        assert page.locator('.main-logo').first.get_attribute('src').endswith('.wordmark-dark.svg')
        page.get_by_role('button', name='One color', exact=True).click()
        page.wait_for_function('Array.from(document.images).every(image => image.complete && image.naturalWidth > 0)')
        assert page.locator('.main-logo').first.get_attribute('src').endswith('.wordmark-white.svg')
        page.get_by_role('button', name='Choose Keystone Crest', exact=True).click()
        assert page.locator('article.is-selected').count() == 1
        assert '02 Keystone Crest' in page.locator('#selection').inner_text()
        with page.expect_download() as download_event:
            page.get_by_role('link', name='Download Keystone Crest SVG', exact=True).click()
        download = download_event.value
        assert download.suggested_filename == '02-keystone-crest.wordmark-white.svg'
        download.save_as(str(evidence / 'download-verified.svg'))
        assert (evidence / 'download-verified.svg').read_bytes() == (assets / download.suggested_filename).read_bytes()
        page.screenshot(path=str(evidence / 'gallery-dark-wordmarks.png'), full_page=True)
        page.get_by_role('button', name='Clear', exact=True).click()
        assert page.locator('article.is-selected').count() == 0
        page.get_by_role('button', name='Light background', exact=True).click()
        page.get_by_role('button', name='Brand', exact=True).click()
        page.get_by_role('button', name='Symbol', exact=True).click()
        page.set_viewport_size({'width': 390, 'height': 844})
        page.wait_for_function('Array.from(document.images).every(image => image.complete && image.naturalWidth > 0)')
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        assert page.locator('article.concept').count() == 10
        page.screenshot(path=str(evidence / 'gallery-mobile.png'), full_page=True)
        assert not errors, errors
    finally:
        browser.close()
        server.shutdown()
        server.server_close()
        server_thread.join(timeout=5)
report = {
    'concepts': 10, 'standaloneSvgsValidated': svg_count,
    'transparentPngsValidated': 70, 'clippedSymbols': 0,
    'browser': 'Chrome headless, isolated temporary profile',
    'desktopAndMobile': 'PASS', 'themeAndVariantControls': 'PASS',
    'selectionAndReset': 'PASS', 'svgDownloadExactBytes': 'PASS', 'pageErrors': errors,
}
(evidence / 'verification.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report))
