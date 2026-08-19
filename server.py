"""Life Organizer — servidor local (porta 3337). Uso: python server.py [porta]"""
import http.server
import socketserver
import os
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 3337
os.chdir(os.path.dirname(os.path.abspath(__file__)))

class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        '.js': 'application/javascript',
        '.json': 'application/json',
        '.webmanifest': 'application/manifest+json',
    }
    def log_message(self, fmt, *args):
        pass

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"Life Organizer rodando em http://localhost:{PORT}")
    httpd.serve_forever()