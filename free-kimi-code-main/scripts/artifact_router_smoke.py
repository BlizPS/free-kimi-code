from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from runtime.artifact_router import route_written_artifact

with tempfile.TemporaryDirectory() as tmp:
    base = Path(tmp)
    cwd = base / 'workspace'
    cwd.mkdir()
    os.environ['LAZYDEV_ARTIFACT_DIR'] = str(base / 'lazydevfile')
    source = base / 'legacy' / 'lazydevfile' / 'sejarah.html'
    source.parent.mkdir(parents=True)
    source.write_text('<html></html>', encoding='utf-8')
    moved = route_written_artifact(str(source), 'buat website sejarah Indonesia', str(cwd))
    assert moved is not None
    assert moved[1] == base / 'lazydevfile' / 'sejarah.html'
    assert moved[1].is_file() and not source.exists()
    project = base / 'project'
    project.mkdir()
    (project / 'package.json').write_text('{}', encoding='utf-8')
    index = project / 'index.html'
    index.write_text('<html></html>', encoding='utf-8')
    assert route_written_artifact(str(index), 'buat website', str(project)) is None
    del os.environ['LAZYDEV_ARTIFACT_DIR']
print('PASS: standalone artifact routing fixes legacy aliases and preserves repo source files')
