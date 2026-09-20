#!/usr/bin/env python3
import json, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.request import Request, urlopen
from pathlib import Path
import sys
root=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root))
from cli.lazydev import _ProviderProxy, PROVIDERS
state={'calls':0,'models':[]}
class Upstream(BaseHTTPRequestHandler):
    def log_message(self,*args): pass
    def do_POST(self):
        length=int(self.headers.get('Content-Length','0') or 0)
        body=json.loads(self.rfile.read(length).decode())
        state['calls']+=1; state['models'].append(body.get('model'))
        if state['calls']==1:
            payload=b'{"error":{"message":"rate limited"}}'
            self.send_response(429); self.send_header('Retry-After','0'); self.send_header('Content-Length',str(len(payload))); self.send_header('Content-Type','application/json'); self.end_headers(); self.wfile.write(payload); return
        payload=json.dumps({'id':'ok','object':'chat.completion','model':body.get('model'),'choices':[{'index':0,'message':{'role':'assistant','content':'ok'},'finish_reason':'stop'}]}).encode()
        self.send_response(200); self.send_header('Content-Length',str(len(payload))); self.send_header('Content-Type','application/json'); self.end_headers(); self.wfile.write(payload)
up=ThreadingHTTPServer(('127.0.0.1',0),Upstream); threading.Thread(target=up.serve_forever,daemon=True).start()
provider=next(p for p in PROVIDERS if p['id']=='openrouter')
pc={'apiKey':'test','model':'z-ai/glm-5.2:free','baseUrl':f'http://127.0.0.1:{up.server_address[1]}/v1','modelInfo':{'context':1048576,'output':8192,'toolUse':False}}
proxy=_ProviderProxy(provider,pc)
try:
    req=Request(f'http://127.0.0.1:{proxy.port}/v1/chat/completions',data=json.dumps({'model':pc['model'],'messages':[{'role':'user','content':'hi'}]}).encode(),headers={'Authorization':f'Bearer {proxy.token}','Content-Type':'application/json'},method='POST')
    with urlopen(req,timeout=12) as response:
        body=json.loads(response.read().decode())
    assert response.status==200, response.status
    assert state['calls']==2, state
    assert state['models']==[pc['model'],pc['model']], state
    assert body['model']==pc['model'],body
    print('PASS: OpenRouter-style 429 is retried and succeeds without changing the selected model')
finally:
    proxy.close(); up.shutdown(); up.server_close()
