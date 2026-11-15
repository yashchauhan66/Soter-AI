from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

directory = Path(__file__).resolve().parents[2] / 'public/brand/logo-concepts-20261114'

class PreviewHandler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        # A managed server's captured stderr can fill while many SVG variants
        # load. Request logs are unnecessary for this local asset preview.
        pass

server = ThreadingHTTPServer(('127.0.0.1', 8876), partial(PreviewHandler, directory=str(directory)))
try:
    server.serve_forever()
finally:
    server.server_close()
