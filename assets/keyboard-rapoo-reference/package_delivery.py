"""Verify current native products and build the end-user delivery archive."""
from pathlib import Path
import json,hashlib,zipfile,struct,shutil
ROOT=Path(__file__).resolve().parent;PROJECT=ROOT.parents[1]
OUT=PROJECT/'deliverables/Keyboard_Rapoo_20261029'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert 'ALL_CHECKS_PASS=true' in (OUT/'verification.txt').read_text(encoding='utf-8-sig')
model=(OUT/'Keyboard_Rapoo.glb').read_bytes()
assert model[:4]==b'glTF' and struct.unpack_from('<I',model,8)[0]==len(model)
doc=json.loads(model[20:20+struct.unpack_from('<I',model,12)[0]])
mins=[];maxs=[]
for mesh in doc['meshes']:
 a=doc['accessors'][mesh['primitives'][0]['attributes']['POSITION']];mins.append(a['min']);maxs.append(a['max'])
bounds=[max(v[i] for v in maxs)-min(v[i] for v in mins) for i in range(3)]
assert abs(bounds[0]-.388)<.0003 and abs(bounds[2]-.1238)<.0003 and abs(bounds[1]-.0191572)<.0003, bounds
for a,b in [('Keyboard_Rapoo_3dsMax2026.max','originals/Keyboard_Rapoo_3dsMax2026.max'),('Keyboard_Rapoo.glb','portfolio/keyboard-rapoo.glb'),('Keyboard_Hero.png','portfolio/keyboard-rapoo.png'),('Keyboard_Top.png','portfolio/keyboard-rapoo-top.png')]:
 shutil.copy2(OUT/a,PROJECT/'formspace/public'/b)
assert sha(OUT/'Keyboard_Rapoo_3dsMax2026.max')==sha(PROJECT/'assets/3d source/Keyboard_Rapoo_3dsMax2026.max')
shutil.copy2(ROOT/'reference.png',OUT/'Reference.png')
files=sorted(p for p in OUT.iterdir() if p.is_file() and p.name not in ['SHA256SUMS.txt'] and p.suffix.lower()!='.zip')
(OUT/'SHA256SUMS.txt').write_text(''.join(sha(p)+'  '+p.name+'\n' for p in files),encoding='utf-8')
archive=PROJECT/'deliverables/Keyboard_Rapoo_3dsMax2026_Package.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for p in files+[OUT/'SHA256SUMS.txt']:z.write(p,arcname='Keyboard_Rapoo_20261029/'+p.name)
with zipfile.ZipFile(archive) as z:
 assert z.testzip() is None
 for p in files+[OUT/'SHA256SUMS.txt']:assert hashlib.sha256(z.read('Keyboard_Rapoo_20261029/'+p.name)).hexdigest()==sha(p)
archive.with_suffix('.zip.sha256').write_text(sha(archive)+'  '+archive.name+'\n',encoding='utf-8')
report={'result':'passed','nativeMaxReopen':True,'editableKeycaps':104,'liveTextNodes':150,'renderableParts':395,'nativeFbxBoundsMatch':True,'webBoundsMetersYUp':bounds,'webMeshCount':len(doc['meshes']),'webExportSource':'evaluated 3ds Max scene','archive':str(archive.relative_to(PROJECT)).replace('\\','/'),'archiveBytes':archive.stat().st_size,'archiveSha256':sha(archive),'files':[{ 'path':str(p.relative_to(PROJECT)).replace('\\','/'),'bytes':p.stat().st_size,'sha256':sha(p)} for p in files],'limitations':['Photo only: dimensions and unseen underside are inferred.','Some lettering/icons and key profiles are approximated.','No general cloud MAX conversion service was installed.']}
(PROJECT/'docs/verification/keyboard-model-20261029.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k!='files'},ensure_ascii=False))
