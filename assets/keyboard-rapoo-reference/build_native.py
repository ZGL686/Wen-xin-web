"""Generate native Max geometry + live text MAXScript. No Blender used.
Run with ordinary Python; then execute build_keyboard.ms in 3ds Max 2026.
"""
from pathlib import Path
import json,math
ROOT=Path(__file__).resolve().parent
PROJECT=ROOT.parents[1]
OUT=PROJECT/'deliverables'/'Keyboard_Rapoo_20261029'
RUNTIME=PROJECT/'formspace'/'outputs'/'keyboard'
OUT.mkdir(parents=True,exist_ok=True);RUNTIME.mkdir(parents=True,exist_ok=True)
layout=json.loads((ROOT/'layout.json').read_text(encoding='utf-8'))
objects=[]
def rr(w,h,r,n=6):
 p=[]
 for cx,cy,start in [(w/2-r,h/2-r,0),(-w/2+r,h/2-r,90),(-w/2+r,-h/2+r,180),(w/2-r,-h/2+r,270)]:
  for i in range(n+1):
   a=math.radians(start+90*i/n);p.append([cx+r*math.cos(a),cy+r*math.sin(a)])
 return p
def ring(name,rings,material,layer,offset=(0,0,0),slope=False,dish=0,parent=''):
 v=[];f=[];N=len(rr(*rings[0][:3]))
 for w,h,r,z in rings:
  for x,y in rr(w,h,r):v.append([x+offset[0],y+offset[1],z+offset[2]+(.036*(y+offset[1]) if slope else 0)])
 f.append(list(reversed(range(N))))
 for k in range(len(rings)-1):
  for j in range(N):f.append([k*N+j,k*N+(j+1)%N,(k+1)*N+(j+1)%N,(k+1)*N+j])
 last=(len(rings)-1)*N
 if dish:
  v.append([offset[0],offset[1],rings[-1][3]+offset[2]-dish]);c=len(v)-1
  for j in range(N):f.append([last+j,last+(j+1)%N,c])
 else:f.append([last+j for j in range(N)])
 objects.append(dict(name=name,vertices=v,faces=f,material=material,layer=layer,parent=parent))
def cuboid(name,loc,dims,material,layer,r=.05,parent=''):
 w,h,d=dims;r=min(r,w/3,h/3,d/3);x,y,z=loc
 ring(name,[(w-2*r,h-2*r,r,z-d/2),(w,h,r,z-d/2+r),(w,h,r,z+d/2-r),(w-2*r,h-2*r,r,z+d/2)],material,layer,(x,y,0),parent=parent)
def px(x,y):return ((x-1012)*.02,(407-y)*.02)
def pz(y):return 1.02+.036*y
ring('Case_Lower',[(38.65,12.25,.88,.24),(38.80,12.38,.93,.38),(38.80,12.38,.93,.70),(38.68,12.28,.90,.84)],0,'01_Case')
ring('Case_Assembly_Seam',[(38.72,12.30,.91,.82),(38.74,12.32,.91,.87)],2,'01_Case')
ring('Case_Upper_Frame',[(38.72,12.30,.91,.87),(38.74,12.32,.91,1.02),(38.61,12.21,.87,1.15)],0,'01_Case',slope=True)
wells=[('Typing',(47,211,1469,596)),('Modifiers',(48,598,1375,706)),('F1_F4',(147,104,473,204)),('F5_F8',(479,104,799,204)),('F9_F12',(804,104,1134,204)),('Esc',(46,104,136,205)),('TopNav',(1478,105,1724,205)),('Print',(1727,104,1975,205)),('NavColumn',(1480,213,1577,504)),('Numpad',(1583,213,1973,705)),('Arrows',(1377,538,1672,709))]
for n,(x0,y0,x1,y1) in wells:
 x,y=px((x0+x1)/2,(y0+y1)/2);w,h=(x1-x0)*.02,(y1-y0)*.02
 ring('Well_'+n,[(w,h,.14,1.15),(w-.04,h-.04,.13,1.17)],2,'02_Switch_Seats',(x,y,0),True)
x,y=px(1305,155);cuboid('Top_Blank_Utility_Panel',(x,y,pz(y)+.28),(6.15,1.62,.25),0,'01_Case',.1)
for k in layout['keys']:
 x,y,z=k['center_cm'];w,h=k['width_cm'],k['depth_cm'];t=k['top_cm'];n=k['name']
 ring('Cap_'+n,[(w-.04,h-.04,.10,z+.025),(w,h,.115,z+.10),(w-.06,h-.07,.11,t-.12),(w-.19,h-.18,.10,t-.025),(w-.25,h-.24,.09,t)],1,'03_Keycaps',(x,y,0),parent=n)
 cuboid('Stem_'+n,(x,y,z),(.45,.45,.13),2,'02_Switch_Seats',.035,n)
 if n=='Windows':
  for i in [-1,1]:
   for j in [-1,1]:cuboid('Windows_Logo_%s_%s'%(i,j),(x+i*.135,y+j*.135,t+.009),(.21,.21,.012),3,'04_Legends',.003,n)
cuboid('Underside_Service_Panel',(0,0,.235),(34.8,9.1,.12),0,'05_Underside',.04)
for x in [-15.4,15.4]:
 for y in [-4.7,4.7]:cuboid('Rubber_Pad_%s_%s'%(x,y),(x,y,.14),(2.1,.72,.22),4,'05_Underside',.07)
for x in [-17,0,17]:
 for y in [-4.35,4.35]:
  ring('Underside_Screw_%s_%s'%(x,y),[(.26,.26,.129,.15),(.26,.26,.129,.18)],5,'05_Underside',(x,y,0))
  cuboid('Screw_Slot_%s_%s'%(x,y),(x,y,.144),(.16,.025,.012),2,'05_Underside',.002)
def num(x):return f'{float(x):.7f}'.rstrip('0').rstrip('.') or '0'
def vec(v):return '['+','.join(num(x) for x in v)+']'
def s(x):return json.dumps(str(x),ensure_ascii=False)
def path(p):return '@"'+str(p).replace('"','')+'"'
def arr(v):return '#('+','.join(v)+')'
mats=[('ABS_Case_Graphite',(24,26,28),35,25),('ABS_Keycaps_Charcoal',(41,43,45),38,30),('Recess_Deep_Black',(10,11,12),12,12),('Legends_Warm_White',(220,222,218),10,10),('Rubber_Feet',(12,13,14),5,7),('Steel_Screws',(65,68,72),65,60)]
lines=['-- Native 3ds Max 2026 reference-driven 104-key keyboard. Centimeters.',
'-- Runs in a NEW scene. Photo scale/unseen underside inferred.',
'(', 'global keyboardWorldMesh', 'local buildLog=createFile '+path(RUNTIME/'native-build.log'), 'try (',
'resetMaxFile #noPrompt','units.SystemType=#centimeters; units.SystemScale=1.0; units.DisplayType=#metric; units.MetricType=#centimeters',
'global Keyboard_Parts=#(); global Keyboard_Caps=#(); global Keyboard_Legends=#(); global Keyboard_Groups=#()',
'local root=point name:"KEYBOARD_RAPOO_ROOT" size:0.6 box:true cross:false',
'setUserProp root "Description" "104 keys. User photo reference. Proportional visual reconstruction."',
'setUserProp root "Units" "1 system unit = 1 centimeter"',
'global Keyboard_Materials=#(); local mats=Keyboard_Materials; local layers=#()',
'fn layerFor nm = (local l=LayerManager.getLayerFromName nm; if l==undefined do l=LayerManager.newLayerFromName nm; l)',
'fn attachPart n lay parentObj = (n.parent=parentObj; (layerFor lay).addNode n; setUserProp n "Assembly" lay; append Keyboard_Parts n; n)',
'with undo off (']
for n,c,sp,gl in mats:lines += ['m=standardMaterial name:'+s(n)+' diffuse:(color '+' '.join(map(str,c))+') specularLevel:'+str(sp)+' glossiness:'+str(gl),'append mats m']
for k in layout['keys']:
 lines += ['g=point name:'+s('KEY_'+k['name'])+' size:0.12 box:false cross:false','g.parent=root; (layerFor "06_Key_Assemblies").addNode g; append Keyboard_Groups g','setUserProp g "KeyName" '+s(k['name'])]
for o in objects:
 tri=[];hidden=[[],[],[]]
 for f in o['faces']:
  for j in range(1,len(f)-1):
   tri.append([f[0]+1,f[j]+1,f[j+1]+1]);fi=len(tri)
   if j!=1:hidden[0].append(fi)
   if j!=len(f)-2:hidden[2].append(fi)
 parent=('getNodeByName '+s('KEY_'+o['parent'])) if o['parent'] else 'root'
 lines+=['n=mesh name:'+s(o['name'])+' vertices:'+arr(vec(v) for v in o['vertices'])+' faces:'+arr(vec(f) for f in tri)]
 for e,ids in enumerate(hidden):
  if ids:lines+=['for fi in #{'+','.join(map(str,ids))+'} do setEdgeVis n fi '+str(e+1)+' false']
 lines+=['update n; convertToPoly n; polyop.autoSmooth n; addModifier n (Weighted_Normals())', 'n.material=mats['+str(o['material']+1)+']; n.wirecolor=n.material.diffuse; centerPivot n','attachPart n '+s(o['layer'])+' ('+parent+')']
 if o['name'].startswith('Cap_'):lines+=['append Keyboard_Caps n']
lines += ['fn addLegend nm txt fontName fontSize left top z maxWidth keyName = (',
 'local t=text name:nm text:txt font:fontName size:fontSize pos:[0,0,0]; t.alignment=1',
 'local b=nodeGetBoundingBox t (matrix3 1); local wid=b[2].x-b[1].x',
 'if wid>maxWidth do (t.size*=maxWidth/wid; b=nodeGetBoundingBox t (matrix3 1))',
 't.pos=[left-b[1].x,top-b[2].y,z]; t.material=Keyboard_Materials[4]; t.wirecolor=color 220 222 218',
 'local ex=Extrude(); ex.amount=0.003; addModifier t ex',
 'attachPart t "04_Legends" (getNodeByName ("KEY_"+keyName)); append Keyboard_Legends t',
 'setUserProp t "Editing" "Live Text + Extrude. Change text/font/size in Modify panel."; t)']
for k in layout['keys']:
 n=k['name'];txt=k['legend'];x,y,_=k['center_cm'];w,h=k['width_cm'],k['depth_cm'];size=k['size'];z=k['top_cm']+.012
 if n=='Menu':txt='▤';size=.55
 if not txt:continue
 lx,ly=x-w/2+.25,y+h/2-.24
 if n.startswith('Arrow_'):lx,ly,size=x-.27,y+.28,.68
 # Native live Text + Extrude, retype in Modify panel; geometry exported from its actual evaluated mesh.
 for row,part in enumerate(txt.split('\n')):
  font='Segoe UI Symbol' if any(ord(c)>255 for c in part) else 'Arial'
  row_size=size if row==0 else size*.85
  lines+=['addLegend '+s('Legend_'+n+'_'+str(row+1))+' '+s(part)+' '+s(font)+' '+num(row_size)+' '+num(lx)+' '+num(ly-row*.74)+' '+num(z)+' '+num(w-.48)+' '+s(n)]
 if n=='Fn':
  lines+=['c=circle name:"Fn_Outline" radius:0.32 pos:'+vec([x,y,z]),'c.render_renderable=true; c.render_thickness=0.024; c.render_sides=6; c.material=mats[4]; attachPart c "04_Legends" (getNodeByName "KEY_Fn")']
# Function symbols: separate native live text nodes, below F legends.
icons=['↶','↷','⌂','□','♫','▷Ⅱ','■','◀','▶','−','+','×']
for i,icon in enumerate(icons,1):
 k=next(k for k in layout['keys'] if k['name']=='F'+str(i));x,y,_=k['center_cm'];z=k['top_cm']+.012
 lines+=['addLegend '+s('Function_Icon_F'+str(i))+' '+s(icon)+' "Segoe UI Symbol" 0.27 '+num(x-.18)+' '+num(y-.26)+' '+num(z)+' 0.65 '+s('F'+str(i))]
lines += ['format "KEYCAPS=% LIVE_LEGENDS=% PARTS=%\\n" Keyboard_Caps.count Keyboard_Legends.count Keyboard_Parts.count to:buildLog',
'local camLayer=layerFor "07_Cameras"',
'local ct=targetObject name:"CAM_Hero_Target" pos:[0,0,1]',
'local cam=targetCamera name:"CAM_Hero" pos:[26,-38,45] target:ct; cam.fov=48; camLayer.addNode cam; camLayer.addNode ct',
'local ct2=targetObject name:"CAM_Top_Target" pos:[0,0,1]',
'local cam2=targetCamera name:"CAM_Top" pos:[0,-0.01,75] target:ct2; cam2.fov=32; camLayer.addNode cam2; camLayer.addNode ct2',
'renderWidth=1800; renderHeight=1050; backgroundColor=color 236 237 235; ambientColor=color 62 62 62',
'try (renderers.current=Default_Scanline_Renderer()) catch()',
'local lightsLayer=layerFor "08_Studio_Lights"',
'local l=omniLight name:"Studio_Key" pos:[-20,-25,40] multiplier:0.65; lightsLayer.addNode l',
'l=omniLight name:"Studio_Fill" pos:[28,-7,24] multiplier:0.30; lightsLayer.addNode l',
'l=omniLight name:"Studio_Rim" pos:[0,20,25] multiplier:0.40; lightsLayer.addNode l',
'select Keyboard_Parts; try (max zoomext sel all) catch(); clearSelection()',
'try (viewport.setCamera cam) catch()',
'saveMaxFile '+path(OUT/'Keyboard_Rapoo_3dsMax2026.max')+' quiet:true',
'format "SAVED_MAX\\n" to:buildLog; flush buildLog',
'pluginManager.loadClass FBXEXP; FBXExporterSetParam "ASCII" false; FBXExporterSetParam "Animation" false; FBXExporterSetParam "Cameras" false; FBXExporterSetParam "Lights" false; FBXExporterSetParam "SmoothingGroups" true; FBXExporterSetParam "UpAxis" "Z"',
'fileIn '+path(ROOT/'world_mesh.ms'),
'local fbxCopies=#(); for p in Keyboard_Parts do (local c=mesh mesh:(keyboardWorldMesh p) name:("FBX_"+p.name); c.material=p.material; append fbxCopies c)',
'select fbxCopies; exportFile '+path(OUT/'Keyboard_Rapoo.fbx')+' #noPrompt selectedOnly:true using:FBXEXP; delete fbxCopies; clearSelection()',
'format "EXPORTED_FBX\\n" to:buildLog; flush buildLog',
'local jf=createFile '+path(RUNTIME/'native-meshes.json'),
'format "{\\"objects\\":[" to:jf; local first=true',
'for n in Keyboard_Parts do (',
'local msh=keyboardWorldMesh n; if msh.numfaces>0 do (',
'if not first do format "," to:jf; first=false',
'format "{\\"name\\":\\"%\\",\\"material\\":\\"%\\",\\"color\\":[%,%,%],\\"vertices\\":[" n.name n.material.name (n.material.diffuse.r/255.0) (n.material.diffuse.g/255.0) (n.material.diffuse.b/255.0) to:jf',
'for i=1 to msh.numverts do (local v=getVert msh i; if i>1 do format "," to:jf; format "[%,%,%]" v.x v.y v.z to:jf)',
'format "],\\"faces\\":[" to:jf; for i=1 to msh.numfaces do (local f=getFace msh i; if i>1 do format "," to:jf; format "[%,%,%]" ((f.x as integer)-1) ((f.y as integer)-1) ((f.z as integer)-1) to:jf)',
'format "]}" to:jf))',
'format "]}" to:jf; close jf',
'format "MESH_EXPORT_DONE\\n" to:buildLog; flush buildLog',
'render camera:cam outputFile:'+path(OUT/'Keyboard_Hero.png')+' width:1800 height:1050 vfb:false',
'format "HERO_RENDERED\\n" to:buildLog; flush buildLog',
'render camera:cam2 outputFile:'+path(OUT/'Keyboard_Top.png')+' width:2000 height:850 vfb:false',
'format "TOP_RENDERED\\nSUCCESS\\n" to:buildLog',
')',') catch (format "ERROR: %\\n" (getCurrentException()) to:buildLog)', 'close buildLog',')']
(ROOT/'build_keyboard.ms').write_text('\n'.join(lines)+'\n',encoding='utf-8-sig')
(ROOT/'geometry-spec.json').write_text(json.dumps({'key_count':104,'parts':len(objects),'units':'centimeters','design_scale':'approximately 388 x 124 mm, inferred from reference'},indent=2),encoding='utf-8')
print('NATIVE_SCRIPT_READY',len(objects),'mesh parts; 104 independent caps; live text')
