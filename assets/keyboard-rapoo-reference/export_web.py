"""Pack evaluated geometry captured by 3ds Max into a self-contained glTF 2 GLB.
No external modeler or procedural replacement of the saved native scene.
"""
from pathlib import Path
import json, struct, math
import numpy as np

ROOT=Path(__file__).resolve().parent
PROJECT=ROOT.parents[1]
OUT=PROJECT/'deliverables'/'Keyboard_Rapoo_20261029'
source=PROJECT/'formspace/outputs/keyboard/native-meshes.json'
data=json.loads(source.read_text(encoding='utf-8-sig'))
g={'asset':{'version':'2.0','generator':'3ds Max 2026 evaluated meshes / Changxu native export'},'scene':0,'scenes':[{'nodes':[]}],'nodes':[],'meshes':[],'materials':[],'accessors':[],'bufferViews':[],'buffers':[]}
binary=bytearray(); mats={}; total_triangles=0
def linear(c): return c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4
def buffer(array,component,kind,target,bounds=False):
 while len(binary)%4:binary.append(0)
 offset=len(binary);raw=array.tobytes();binary.extend(raw)
 view=len(g['bufferViews']);g['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':len(raw),'target':target})
 a={'bufferView':view,'componentType':component,'count':len(array),'type':kind}
 if bounds:a.update(min=array.min(axis=0).astype(float).tolist(),max=array.max(axis=0).astype(float).tolist())
 idx=len(g['accessors']);g['accessors'].append(a);return idx
for o in data['objects']:
 v=np.asarray(o['vertices'],dtype=np.float64);f=np.asarray(o['faces'],dtype=np.int64)
 if not len(f):continue
 # Source is centimeters and Z-up. Browser is meters and Y-up.
 v=v[:,[0,2,1]]*np.array([.01,.01,-.01])
 tri=v[f];cross=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]);mag=np.linalg.norm(cross,axis=1)
 normal=cross/np.maximum(mag[:,None],1e-15)
 adjacent=[[] for _ in v]
 for fi,face in enumerate(f):
  for vi in face:adjacent[vi].append(fi)
 # Expand corners to retain hard edges, smoothing only within 45 degrees.
 normals=np.empty((len(f),3,3),dtype=np.float64)
 threshold=math.cos(math.radians(45))
 for fi,face in enumerate(f):
  for ci,vi in enumerate(face):
   ids=np.asarray(adjacent[vi]);keep=ids[normal[ids]@normal[fi]>=threshold-.001]
   n=cross[keep].sum(axis=0);normals[fi,ci]=n/max(np.linalg.norm(n),1e-15)
 positions=tri.reshape(-1,3).astype('<f4');normals=normals.reshape(-1,3).astype('<f4')
 packed,indices=np.unique(np.concatenate([positions,normals],axis=1),axis=0,return_inverse=True)
 positions=packed[:,:3].copy();normals=packed[:,3:].copy();indices=indices.astype('<u4')
 if o['material'] not in mats:
  mats[o['material']]=len(g['materials']);g['materials'].append({'name':o['material'],'pbrMetallicRoughness':{'baseColorFactor':[linear(c) for c in o['color']]+[1],'metallicFactor':.5 if 'Steel' in o['material'] else 0,'roughnessFactor':.48 if 'Keycaps' in o['material'] else .64}})
 primitive={'attributes':{'POSITION':buffer(positions,5126,'VEC3',34962,True),'NORMAL':buffer(normals,5126,'VEC3',34962)},'indices':buffer(indices,5125,'SCALAR',34963),'material':mats[o['material']]}
 mesh=len(g['meshes']);g['meshes'].append({'name':o['name'],'primitives':[primitive]})
 node=len(g['nodes']);g['nodes'].append({'name':o['name'],'mesh':mesh});g['scenes'][0]['nodes'].append(node)
 total_triangles+=len(f)
while len(binary)%4:binary.append(0)
g['buffers']=[{'byteLength':len(binary)}]
j=json.dumps(g,separators=(',',':'),ensure_ascii=False).encode('utf-8')
while len(j)%4:j+=b' '
result=struct.pack('<III',0x46546C67,2,12+8+len(j)+8+len(binary))+struct.pack('<II',len(j),0x4E4F534A)+j+struct.pack('<II',len(binary),0x004E4942)+binary
target=OUT/'Keyboard_Rapoo.glb';target.write_bytes(result)
report={'source':'3ds Max 2026 evaluated native meshes','objects':len(g['meshes']),'triangles':total_triangles,'materials':len(mats),'glbBytes':len(result),'externalResources':0,'units':'meters','axes':'Y-up'}
(OUT/'web-export.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report))
