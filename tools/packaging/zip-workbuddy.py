from pathlib import Path
import hashlib
import json
import zipfile
import sys
from datetime import datetime, timezone, timedelta

repository = Path(__file__).resolve().parents[2]
package_name = sys.argv[1] if len(sys.argv) > 1 else 'FormSpace_WorkBuddy_China_' + datetime.now(timezone(timedelta(hours=8))).strftime('%Y%m%d')
if not package_name.replace('_', '').replace('-', '').isalnum():
    raise RuntimeError('Use a simple archive name.')
base = repository / 'deliverables' / package_name
archive = base.parent / (package_name + '.zip')
excluded = {'node_modules', '.git', '.sites-runtime', '.wrangler', 'dist'}
if archive.exists():
    raise RuntimeError('Archive already exists; preserve it and choose a new name.')

files = sorted(p for p in base.rglob('*') if p.is_file() and not any(part in excluded for part in p.relative_to(base).parts))
for file in files:
    name = file.relative_to(base).as_posix()
    if file.name.startswith('.env') or file.suffix in {'.pem', '.key', '.log'}:
        raise RuntimeError(f'Unexpected private/runtime file: {name}')

with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9, strict_timestamps=False) as output:
    for file in files:
        output.write(file, (Path(base.name) / file.relative_to(base)).as_posix())

with zipfile.ZipFile(archive, 'r') as package:
    bad = package.testzip()
    if bad:
        raise RuntimeError('ZIP integrity failure: ' + bad)
    for file in files:
        member = (Path(base.name) / file.relative_to(base)).as_posix()
        if hashlib.sha256(package.read(member)).digest() != hashlib.sha256(file.read_bytes()).digest():
            raise RuntimeError('ZIP file hash mismatch: ' + member)
    required = ['源码/package-lock.json', '源码/src/App.tsx', '源码/src/ModelViewer.tsx', '源码/worker/api.ts', '02_发给WorkBuddy的任务.md', 'FILE_MANIFEST.sha256']
    for name in required:
        package.getinfo(base.name + '/' + name)
    originals = [n for n in package.namelist() if '/public/originals/' in n and n.endswith('.max')]
    models = [n for n in package.namelist() if '/public/portfolio/' in n and n.endswith('.glb')]
    covers = [n for n in package.namelist() if '/public/portfolio/' in n and n.endswith('.webp')]
    if len(originals) != 4 or len(models) != 4 or len(covers) != 4:
        raise RuntimeError('Missing original models or previews')
    manifest = json.loads(package.read(base.name + '/源码/.openai/hosting.json'))
    if 'project_id' in manifest:
        raise RuntimeError('Existing Site identity included')

digest = hashlib.sha256(archive.read_bytes()).hexdigest()
archive.with_suffix('.zip.sha256').write_text(digest + '  ' + archive.name + '\n', encoding='utf-8')
print(json.dumps({'archive': str(archive), 'bytes': archive.stat().st_size, 'files': len(files), 'originalMax': len(originals), 'glb': len(models), 'covers': len(covers), 'sha256': digest, 'zipIntegrity': 'passed'}, ensure_ascii=False))
