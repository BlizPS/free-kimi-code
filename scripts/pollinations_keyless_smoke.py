#!/usr/bin/env python3
import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.request import Request, urlopen
from pathlib import Path
import sys

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root))
from cli.lazydev import _ProviderProxy, PROVIDERS

captured = {}

class Upstream(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        pass
    def do_POST(self):
        captured['path'] = self.path
        captured['authorization'] = self.headers.get('Authorization')
        length = int(self.headers.get('Content-Length', '0') or '0')
        captured['body'] = json.loads(self.rfile.read(length).decode())
        payload = b'Anonymous Pollinations response'
        self.send_response(200)
        self.send_header('Content-Type', 'text/plain; charset=utf-8')
        self.send_header('Content-Length', str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

upstream = ThreadingHTTPServer(('127.0.0.1', 0), Upstream)
threading.Thread(target=upstream.serve_forever, daemon=True).start()
port = upstream.server_address[1]
provider = next(p for p in PROVIDERS if p['id'] == 'pollinations')
pc = {'apiKey': 'sk-stale-account-key', 'model': 'openai', 'baseUrl': f'http://127.0.0.1:{port}/', 'modelInfo': {'context': 32768, 'output': 8192, 'toolUse': False}}
proxy = _ProviderProxy(provider, pc)
try:
    request_body = {'model': 'openai', 'messages': [{'role': 'user', 'content': 'hi'}], 'stream': True}
    req = Request(f'http://127.0.0.1:{proxy.port}/v1/chat/completions', data=json.dumps(request_body).encode(), headers={'Authorization': f'Bearer {proxy.token}', 'Content-Type': 'application/json'}, method='POST')
    with urlopen(req, timeout=10) as response:
        body = json.loads(response.read().decode())
    assert captured.get('path') == '/', captured
    assert captured.get('authorization') is None, captured
    assert captured['body'].get('stream') is False, captured
    assert body['choices'][0]['message']['content'] == 'Anonymous Pollinations response', body
    assert body['model'] == 'openai', body
    print('PASS: Pollinations legacy path is keyless at runtime, stale keys are not forwarded, and text responses normalize to OpenAI completion JSON.')
finally:
    proxy.close()
    upstream.shutdown(); upstream.server_close()
