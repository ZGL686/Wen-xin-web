import bpy, math, json, os, sys
from mathutils import Vector
ROOT = os.path.dirname(os.path.abspath(__file__))
SPECS = [('house','房子 · 空间习作',(0.56,0.64,0.63)),('cabinet','柜子 · 收纳练习',(0.70,0.56,0.34)),('lamp','AURELIA · 玉石灯',(0.25,0.48,0.38)),('sofa','柔软沙发',(0.68,0.49,0.34))]
reports=[]
for slug,title,color in [SPECS[-1]]:
    objpath=os.path.join(ROOT,slug+'.obj')
    if not os.path.exists(objpath):
        reports.append({'id':slug,'error':'OBJ missing'}); continue
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=os.path.join(ROOT,slug+'.fbx'))
    meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
    if not meshes:
        reports.append({'id':slug,'error':'No mesh'}); continue
    pts=[o.matrix_world@Vector(p) for o in meshes for p in o.bound_box]
    mn=Vector(tuple(min(p[i] for p in pts) for i in range(3)))
    mx=Vector(tuple(max(p[i] for p in pts) for i in range(3)))
    size=mx-mn; center=(mn+mx)/2; factor=3/max(size)
    for o in meshes:
        o.location=(o.location-center)*factor
        o.scale*=factor
        o.location.z+=size.z*factor/2
        if not o.data.materials:
            m=bpy.data.materials.new('Studio material');m.diffuse_color=(*color,1);o.data.materials.append(m)
        for m in o.data.materials:
            m.use_nodes=True
            p=m.node_tree.nodes.get('Principled BSDF')
            if p:
                p.inputs['Roughness'].default_value=0.48 if slug=='lamp' else 0.65
                if slug=='lamp':p.inputs['Metallic'].default_value=0.12
        # Preserve deliberate flat surfaces; smooth rounded surfaces only.
        pass # Preserve FBX source smoothing and custom normals
    # Export only actual model geometry.
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:o.select_set(True)
    bpy.context.view_layer.objects.active=meshes[0]
    glb=os.path.join(ROOT,slug+'.glb')
    bpy.ops.export_scene.gltf(filepath=glb,export_format='GLB',use_selection=True,export_apply=True)
    scene=bpy.context.scene
    scene.render.engine='CYCLES';scene.cycles.samples=48
    scene.cycles.use_denoising=True
    scene.render.resolution_x=1000;scene.render.resolution_y=900;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.render.film_transparent=True
    scene.world=bpy.data.worlds.new('Studio world');scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value=(0.45,0.50,0.48,1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value=0.55
    target=Vector((0,0,size.z*factor*.48))
    camloc=Vector((6,-7,5))
    if slug=='cabinet':camloc=Vector((7,-4.5,4.7))
    bpy.ops.object.camera_add(location=camloc)
    camera=bpy.context.object;camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=4.7;scene.camera=camera
    for loc,energy,scale in [((1,-4,7),850,5),((-4,2,4),650,4),((4,3,5),950,3)]:
        bpy.ops.object.light_add(type='AREA',location=loc);light=bpy.context.object;light.data.energy=energy;light.data.shape='DISK';light.data.size=scale;light.rotation_euler=(target-light.location).to_track_quat('-Z','Y').to_euler()
    scene.view_settings.view_transform='AgX'
    scene.render.filepath=os.path.join(ROOT,slug+'.png');bpy.ops.render.render(write_still=True)
    report={'id':slug,'title':title,'objects':len(meshes),'vertices':sum(len(o.data.vertices) for o in meshes),'triangles':sum(len(o.data.polygons) for o in meshes),'source_bounds':list(size),'glb':slug+'.glb','image':slug+'.png','preview_note':'Real source geometry. Basic colors approximated from source material; native MAX remains original.'}
    reports.append(report)
    with open(os.path.join(ROOT,'sofa-assets.json'),'w',encoding='utf8') as f:json.dump(reports,f,ensure_ascii=False,indent=2)
with open(os.path.join(ROOT,'sofa-assets.json'),'w',encoding='utf8') as f:json.dump(reports,f,ensure_ascii=False,indent=2)
print('ASSETS_COMPLETE',json.dumps(reports,ensure_ascii=False))


