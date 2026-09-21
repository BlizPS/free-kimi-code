#!/usr/bin/env python3
from pathlib import Path
import os, subprocess, tempfile

ROOT = Path(__file__).resolve().parents[1]
sh = (ROOT / 'install.sh').read_text(encoding='utf-8')
py = (ROOT / 'cli' / 'lazydev.py').read_text(encoding='utf-8')

assert 'write_codex_android_wrapper()' not in sh
assert 'install_codex_android_wrapper()' not in sh
assert "exec tmux -f /dev/null" not in sh
assert "['tmux', '-f', '/dev/null'" not in py
assert 'command = [codex, *args]' in py
assert 'CODEX_INSTALL_URL="https://chatgpt.com/codex/install.sh"' in sh
assert 'if ! sh "$script" >"$log" 2>&1; then' in sh
assert 'CODEX_INSTALLED_BIN="$CODEX_BIN_DIR/codex"' in sh
assert 'codex.bin' in sh  # only legacy migration/detection, never a public replacement

# Exercise the legacy wrapper migration in an isolated shell.
with tempfile.TemporaryDirectory() as td:
    t = Path(td)
    bin_dir = t / 'bin'; bin_dir.mkdir()
    real = bin_dir / 'codex.bin'
    wrapper = bin_dir / 'codex'
    real.write_text('#!/bin/sh\nprintf "codex 0.155.1\\n"\n')
    real.chmod(0o755)
    wrapper.write_text('#!/bin/sh\necho "Codex TUI compatibility: tmux"\nexec tmux -f /dev/null new-session -A -s codex-lazydev "$@"\n')
    wrapper.chmod(0o755)
    # Extract just the function body between repair_legacy_codex_wrappers and find_codex.
    a = sh.index('repair_legacy_codex_wrappers() {')
    b = sh.index('\nfind_codex() {', a)
    fn = sh[a:b]
    harness = t / 'test.sh'
    harness.write_text(f'''#!/bin/sh\nset -eu\nCODEX_BIN_DIR="{bin_dir}"\nDEFAULT_EXTERNAL_BIN_DIR="{bin_dir}"\nHOME="{t}"\nLAZYDEV_HOME="{t}/lazydev"\nLAZYDEV_BIN_DIR="{bin_dir}"\nPREFIX=""\nsay() {{ printf '%s\n' "$*"; }}\n{fn}\nrepair_legacy_codex_wrappers\n[ -x "{bin_dir}/codex" ]\n! grep -Eq 'tmux|codex-lazydev|Codex TUI compatibility' "{bin_dir}/codex"\n"{bin_dir}/codex" --version\n''')
    harness.chmod(0o755)
    out = subprocess.run([str(harness)], text=True, capture_output=True, check=True)
    assert 'codex 0.155.1' in out.stdout

print('PASS: Codex direct-only regression and legacy wrapper recovery')

# Responses bridge regression: Codex needs a completed assistant message output item,
# not only output_text.delta, otherwise /copy reports "No agent response to copy".
import importlib.util
import json
import threading
import http.server
import urllib.request

spec = importlib.util.spec_from_file_location("lazydev_cli_test", ROOT / "cli" / "lazydev.py")
mod = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(mod)

class _FakeChatHandler(http.server.BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        return
    def do_POST(self):
        size=int(self.headers.get("Content-Length", "0") or "0")
        _=self.rfile.read(size)
        body={
            "id":"chatcmpl_test",
            "choices":[{"message":{"role":"assistant","content":"Hello from the routed model.","tool_calls":[]},"finish_reason":"stop"}],
            "usage":{"prompt_tokens":5,"completion_tokens":6,"total_tokens":11},
        }
        raw=json.dumps(body).encode()
        self.send_response(200)
        self.send_header("Content-Type","application/json")
        self.send_header("Content-Length",str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

fake=http.server.ThreadingHTTPServer(("127.0.0.1",0), _FakeChatHandler)
thread=threading.Thread(target=fake.serve_forever, daemon=True); thread.start()
class _FakeProxy: pass
fp=_FakeProxy(); fp.port=fake.server_address[1]; fp.token="fake-token"
responses=mod._ResponsesProxy(fp, {"id":"test","base":"http://127.0.0.1"}, {"model":"test-model","modelInfo":{}})
try:
    req=urllib.request.Request(
        f"http://127.0.0.1:{responses.port}/v1/responses",
        data=json.dumps({"model":"test-model","input":[{"type":"message","role":"user","content":[{"type":"input_text","text":"hi"}]}],"stream":True}).encode(),
        headers={"Authorization":f"Bearer {responses.token}","Content-Type":"application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10) as r:
        stream=r.read().decode()
    events=[]
    for block in stream.split("\n\n"):
        for line in block.splitlines():
            if line.startswith("data: "):
                events.append(json.loads(line[6:]))
    kinds=[e.get("type") for e in events]
    assert "response.output_item.added" in kinds
    assert "response.output_text.delta" in kinds
    assert "response.output_item.done" in kinds
    assert kinds.index("response.output_item.added") < kinds.index("response.output_item.done") < kinds.index("response.completed")
    added=[e for e in events if e.get("type")=="response.output_item.added"][-1]
    assert added["item"]["status"] == "in_progress"
    done=[e for e in events if e.get("type")=="response.output_item.done"][-1]
    assert done["item"]["type"] == "message"
    assert done["item"]["role"] == "assistant"
    assert done["item"]["status"] == "completed"
    assert "phase" not in done["item"]
    assert done["item"]["content"][0]["text"] == "Hello from the routed model."
finally:
    responses.close()
    fake.shutdown(); fake.server_close()
    thread.join(timeout=1)

print('PASS: Codex Responses bridge emits assistant output_item.done so native TUI transcript/copy can see the response')
