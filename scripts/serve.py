"""dist を http で配る(Windows は .js を text/plain で返すことがあるので型を決め打ちする)。python scripts/serve.py <dir> <port>"""
import functools, http.server, sys
class H(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json", ".webmanifest": "application/manifest+json"}
    def log_message(self, *a): pass
http.server.ThreadingHTTPServer(("127.0.0.1", int(sys.argv[2])), functools.partial(H, directory=sys.argv[1])).serve_forever()
