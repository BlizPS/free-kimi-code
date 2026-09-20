from __future__ import annotations

import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from runtime.ui_artifact_policy import audit_html_file

with tempfile.TemporaryDirectory() as tmp:
    base = Path(tmp)
    html = base / 'index.html'
    html.write_text('''<img src="assets/missing.png"><div style="background-image:url(https://example.com/image.png)"></div>''', encoding='utf-8')
    issues = audit_html_file(html)
    assert any('missing local image asset' in x for x in issues)
    assert any('placeholder image URL' in x for x in issues)
    (base / 'assets').mkdir()
    (base / 'assets' / 'ok.png').write_bytes(b'png')
    html.write_text('<img src="assets/ok.png"><div style="background-image:url(data:image/svg+xml;base64,AAAA)"></div>', encoding='utf-8')
    assert audit_html_file(html) == []
print('PASS: UI artifact image QA detects broken assets and ignores valid local/data assets')
