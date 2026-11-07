from pathlib import Path
import hashlib
import json
import re
import sys
import zipfile
from datetime import datetime, timezone, timedelta

repository = Path(__file__).resolve().parents[2]
name = sys.argv[1] if len(sys.argv) > 1 else 'Changxu_WorkBuddy_China_' + datetime.now(timezone(timedelta(hours=8))).strftime('%Y%m%d')
if not re.fullmatch(r'[A-Za-z0-9_-]+', name):
    raise RuntimeError('Use a simple archive name.')
base = repository / 'formspace' / 'outputs' / 'handovers' / name
archive = repository / 'deliverables' / (name + '.zip')
archive.parent.mkdir(parents=True, exist_ok=True)
if archive.exists():
    raise RuntimeError('Archive exists; preserve it and choose a new name.')

def digest_file(file):
    with file.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()

manifest = {}
for line in (base / 'FILE_MANIFEST.sha256').read_text(encoding='utf-8').splitlines():
    digest, relative = line.split('  ', 1)
    candidate = (base / relative).resolve()
    if not candidate.is_relative_to(base.resolve()) or relative in manifest:
        raise RuntimeError('Invalid manifest path: ' + relative)
    manifest[relative] = digest
excluded = {'node_modules', '.git', '.sites-runtime', '.wrangler', 'dist', '.server-data', '__pycache__'}
files = sorted(p for p in base.rglob('*') if p.is_file() and not any(part in excluded for part in p.relative_to(base).parts))
if {p.relative_to(base).as_posix() for p in files} != set(manifest) | {'FILE_MANIFEST.sha256'}:
    raise RuntimeError('Manifest does not match the delivery file set.')
for file in files:
    relative = file.relative_to(base).as_posix()
    if file.is_symlink() or file.suffix.lower() in {'.pem', '.key', '.log', '.db', '.sqlite'} or (file.name.startswith(('.env', '.dev.vars')) and not file.name.endswith('.example')):
        raise RuntimeError('Private/runtime file: ' + relative)
    with file.open('rb') as stream:
        if stream.read(100).startswith(b'version https://git-lfs.github.com/spec/v1'):
            raise RuntimeError('LFS pointer: ' + relative)
    if relative in manifest and digest_file(file) != manifest[relative]:
        raise RuntimeError('Manifest hash mismatch: ' + relative)
with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6, strict_timestamps=False) as output:
    for file in files:
        output.write(file, name + '/' + file.relative_to(base).as_posix())
with zipfile.ZipFile(archive) as package:
    bad = package.testzip()
    if bad:
        raise RuntimeError('ZIP integrity failure: ' + bad)
    for relative, digest in manifest.items():
        with package.open(name + '/' + relative) as stream:
            if hashlib.file_digest(stream, 'sha256').hexdigest() != digest:
                raise RuntimeError('ZIP hash mismatch: ' + relative)
    for relative in ['源码/package-lock.json', '源码/server/node-server.mjs', '源码/server/r2-cos-bucket.mjs', '源码/src/Favorites.tsx', '源码/worker/api.ts', '02_发给WorkBuddy的任务.md', '03_迁移说明.md', '03_国内部署与数据迁移.md', 'deploy/nginx.conf.example', 'deploy/changxu.service.example', 'deploy/server.env.example', 'validation.json', '06_本地打包验收.json']:
        package.getinfo(name + '/' + relative)
    if 'project_id' in json.loads(package.read(name + '/源码/.openai/hosting.json')):
        raise RuntimeError('Existing Site identity included.')
    metadata = json.loads(package.read(name + '/交接清单.json'))
    originals = [n for n in package.namelist() if '/源码/public/originals/' in n and n.endswith('.max')]
    if len(originals) != len(metadata['builtInWorks']):
        raise RuntimeError('Built-in original count mismatch.')
    expected_max = len(metadata['builtInWorks']) + 3
    if sum(n.endswith('.max') for n in package.namelist()) != expected_max:
        raise RuntimeError('Supplementary MAX files missing.')
digest = digest_file(archive)
archive.with_suffix('.zip.sha256').write_text(digest + '  ' + archive.name + '\n', encoding='utf-8')
print(json.dumps({'archive': str(archive), 'bytes': archive.stat().st_size, 'files': len(files), 'originalMax': expected_max, 'sha256': digest, 'zipIntegrity': 'passed', 'manifestHashes': len(manifest)}, ensure_ascii=False))
