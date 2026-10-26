import os,json,struct,hashlib
ROOT = os.path.dirname(os.path.abspath(__file__))
SRC=os.path.join(os.path.dirname(ROOT), 'source')
with open(os.path.join(ROOT,'source-hashes.json'),encoding='utf-8-sig') as f:hashes={i['file']:i for i in json.load(f)}
specs=[('house','房子 · 空间习作','房子3d.max',[1.5191809,1.5262720,1.3118610],'3ds Max visible geometry → OBJ → Blender → GLB'),('cabinet','格序 · 收纳柜','柜子_补齐完成.max',[0.3525040,2.1,1.7999987],'3ds Max visible Boolean result → OBJ → Blender → GLB'),('lamp','AURELIA · 玉石灯','AURELIA_Jade_Lamp.max',[0.6606001,0.7119200,1.6009070],'3ds Max native FBX → Blender → GLB'),('sofa','Cloud Bear · 云朵熊沙发','Sofa_3dsMax2026.max',[2.6500001,1.263,1.3142061],'3ds Max native FBX → Blender → GLB')]
result=[]
for slug,title,source,bounds,method in specs:
    path=os.path.join(ROOT,slug+'.glb')
    with open(path,'rb') as f:
        data=f.read()
    magic,version,size=struct.unpack_from('<4sII',data)
    assert magic==b'glTF' and version==2 and size==len(data)
    ln,typ=struct.unpack_from('<I4s',data,12)
    assert typ==b'JSON'
    doc=json.loads(data[20:20+ln])
    triangles=sum(doc['accessors'][p['indices']]['count']//3 for m in doc['meshes'] for p in m['primitives'])
    meshcount=sum('mesh' in n for n in doc['nodes'])
    pngpath=os.path.join(ROOT,slug+'.png')
    png=open(pngpath,'rb').read(33)
    assert png[:8]==b'\x89PNG\r\n\x1a\n'
    w,h=struct.unpack_from('>II',png,16)
    assert png[25]==6
    currenthash=hashlib.sha256(open(os.path.join(SRC,source),'rb').read()).hexdigest().upper()
    assert currenthash==hashes[source]['sha256']
    result.append({'id':slug,'title':title,'original_file':source,'original_bytes':hashes[source]['bytes'],'original_sha256':currenthash,'source_unchanged':True,'source_bounds_metres':bounds,'visible_meshes':meshcount,'triangles':triangles,'glb':slug+'.glb','glb_bytes':len(data),'glb_sha256':hashlib.sha256(data).hexdigest(),'image':slug+'.png','image_size':[w,h],'image_transparent':True,'conversion':method,'viewer_scale':'Longest source dimension normalized to 3 viewer units. Refer to source_bounds_metres for physical dimensions.','material_note':'真实源几何。网页材质为基础色与粗糙度近似；3ds Max 原始材质、灯光和效果以 MAX 文件为准。','status':'verified'})
with open(os.path.join(ROOT,'assets.json'),'w',encoding='utf8') as f:json.dump(result,f,ensure_ascii=False,indent=2)
print(json.dumps([{'id':a['id'],'meshes':a['visible_meshes'],'triangles':a['triangles'],'glb_bytes':a['glb_bytes'],'source_unchanged':a['source_unchanged']} for a in result],ensure_ascii=False))
