from pathlib import Path
import math,json
ROOT=Path('C:/Users/SM/Desktop/3d'); OUT=ROOT/'formspace/outputs/teapot-native'; AS=ROOT/'assets/teapot'; TEXTURE=ROOT/'assets/3d source/Porcelain_Teapot_2026/peony_albedo.png'; OUT.mkdir(parents=True,exist_ok=True)
objects=[]
def sample(points,steps=7):
 out=[]
 for i in range(len(points)-1):
  a=points[max(0,i-1)];b=points[i];c=points[i+1];d=points[min(len(points)-1,i+2)]
  for k in range(steps):
   t=k/steps
   out.append([.5*((2*b[j])+(-a[j]+c[j])*t+(2*a[j]-5*b[j]+4*c[j]-d[j])*t*t+(-a[j]+3*b[j]-3*c[j]+d[j])*t*t*t) for j in range(len(b))])
 out.append(list(points[-1]));return out
def lathe(name,profile,mat,segments=128,texture=False):
 v=[];uv=[];faces=[]
 for r,z in profile:
  r=max(r,.001)
  for j in range(segments+1):
   t=2*math.pi*j/segments
   v.append([r*math.cos(t),r*math.sin(t),z]);uv.append([j/segments,(z-.6)/15.8 if texture else z/20])
 for i in range(len(profile)-1):
  for j in range(segments):
   a=i*(segments+1)+j;b=a+1;c=b+segments+1;d=a+segments+1;faces.extend([[a,b,c],[a,c,d]])
 objects.append(dict(name=name,material=mat,vertices=v,faces=faces,uv=uv))
def tube(name,path,radii,mat,sides=36,inner=False,redline=False):
 p=sample([[*a,r] for a,r in zip(path,radii)],6);v=[];uv=[];faces=[]
 def ring(i,rad):
  pos=p[i];nxt=p[min(i+1,len(p)-1)];prev=p[max(0,i-1)];dx=nxt[0]-prev[0];dz=nxt[2]-prev[2];norm=math.hypot(dx,dz);nx=-dz/norm;nz=dx/norm
  for j in range(sides+1):
   t=2*math.pi*j/sides
   v.append([pos[0]+nx*rad*math.cos(t),pos[1]+rad*math.sin(t),pos[2]+nz*rad*math.cos(t)]);uv.append([j/sides,i/(len(p)-1)])
 for i,pos in enumerate(p):ring(i,pos[3])
 if inner:
  for i in range(len(p)-1,-1,-1):ring(i,max(.08,p[i][3]-.19))
 rowcount=len(p)*(2 if inner else 1)
 for i in range(rowcount-1):
  for j in range(sides):
   a=i*(sides+1)+j;b=a+1;c=b+sides+1;d=a+sides+1;faces.extend([[a,c,b],[a,d,c]])
 objects.append(dict(name=name,material=mat,vertices=v,faces=faces,uv=uv))
outer=sample([(0.001,.6),(3.5,.6),(4.6,.85),(5.8,1.7),(7.6,3.4),(8.85,5.8),(9.25,8.3),(8.95,10.7),(8.05,12.65),(6.5,14.05),(5.55,14.9),(5.9,15.45),(6.15,15.7),(6.1,15.85)],6)
inner=[[max(.001,r-.24),z+.27 if z<1 else z] for r,z in reversed(outer)]
lathe('01_Body_Hollow_Editable',outer+inner,'BlueWhite_Peony',128,True)
lathe('02_Foot_Ring',sample([(3.85,.25),(4.2,.25),(4.4,.4),(4.42,.64),(4.35,.82),(4.1,.9),(3.85,.7),(3.85,.25)],4),'Porcelain_White',96)
lathe('03_Lid_Removable',list(reversed(sample([(0.001,17.7),(1.3,17.7),(2.8,17.5),(4.5,16.85),(5.7,16.04),(5.95,15.98),(6.05,15.83),(5.92,15.7),(5.4,15.72),(4.5,16.55),(2.7,17.2),(1.2,17.4),(.001,17.4)],5))),'Lid_Peony',128,True)
lathe('04_Knob_White',sample([(.001,17.65),(.72,17.65),(.78,17.9),(.65,18.05),(.56,18.3),(.85,18.6),(1.3,18.95),(1.42,19.35),(1.28,19.85),(.9,20.3),(.4,20.75),(.09,21.08),(.001,21.1)],5),'Porcelain_White',96)
lathe('05_Knob_Red_Tip',sample([(.001,21.04),(.08,21.04),(.1,21.15),(.05,21.42),(.001,21.42)],4),'Vermilion_Red',48)
sp=[(-6.3,0,5.2),(-9.7,0,6.0),(-11.3,0,8.0),(-11.7,0,11.3),(-12.5,0,14.0),(-14.0,0,15.7),(-15.5,0,16.0)]
tube('06_Spout_Hollow_Editable',sp,[1.9,1.62,1.35,1.2,1.08,.95,.83],'Porcelain_White',48,True)
handle=[(7.1,0,12.25),(8.65,0,15.7),(10.5,0,17.1),(12.65,0,16.9),(14.65,0,14.8),(15.6,0,12.2),(15.4,0,9.5),(13.7,0,6.8),(11.2,0,4.75),(6.7,0,3.1)]
tube('07_Handle_White_Editable',handle,[.67,.58,.52,.52,.54,.55,.57,.6,.66,.82],'Porcelain_White',32)
# Thin decorative red inlay on the visible outer face of the handle, kept independent.
redpath=[[x,y-.525,z] for x,y,z in handle]
tube('08_Handle_Red_Inlay',redpath,[.055]*len(handle),'Vermilion_Red',12)
for name,r,z,rad,mat in [('09_Mouth_Red_Rim',6.1,15.78,.055,'Vermilion_Red'),('10_Mouth_Inner_Red',5.94,15.72,.027,'Vermilion_Red'),('11_Lid_White_Bead',5.96,15.94,.07,'Porcelain_White'),('12_Knob_Red_Band',1.39,19.35,.045,'Vermilion_Red'),('13_Knob_Red_Band_Lower',1.32,19.1,.028,'Vermilion_Red')]:
 prof=[[r+rad*math.cos(2*math.pi*i/16),z+rad*math.sin(2*math.pi*i/16)] for i in range(17)]
 lathe(name,prof,mat,128)
# A darker cobalt interior at the spout opening makes the actual bore easy to read.
objects[-1]['name']=objects[-1]['name']
(AS/'geometry-spec.json').write_text(json.dumps({'units':'centimeters','reference':'single supplied front photograph','estimatedHeightCm':21.42,'components':[dict(name=o['name'],material=o['material'],vertices=len(o['vertices']),triangles=len(o['faces'])) for o in objects]},indent=2),encoding='utf8')
ms=['-- Custom reference reconstruction, native Max editable meshes.','resetMaxFile #noPrompt','units.SystemType=#centimeters;units.SystemScale=1.0','global TeaParts=#()','global TeaMats=#()','fn layerFor s=(local l=LayerManager.getLayerFromName s; if l==undefined do l=LayerManager.newLayerFromName s; l)','local bodyMat=standardMaterial name:"BlueWhite_Peony" diffuse:(color 245 247 244) specularLevel:95 glossiness:75','bodyMat.diffuseMap=bitmaptexture filename:@"'+str(TEXTURE)+'"','bodyMat.diffuseMapEnable=true','append TeaMats bodyMat','local lidMat=copy bodyMat;lidMat.name="Lid_Peony";append TeaMats lidMat','local whiteMat=standardMaterial name:"Porcelain_White" diffuse:(color 245 248 244) specularLevel:100 glossiness:78;append TeaMats whiteMat','local redMat=standardMaterial name:"Vermilion_Red" diffuse:(color 169 52 27) specularLevel:75 glossiness:70;append TeaMats redMat']
mi={'BlueWhite_Peony':1,'Lid_Peony':2,'Porcelain_White':3,'Vermilion_Red':4}
fmt=lambda a:'['+','.join(format(x,'.6f') for x in a)+']'
for o in objects:
 ms+=['(', 'local vs=#('+','.join(map(fmt,o['vertices']))+')','local fs=#('+','.join(fmt([x+1 for x in f]) for f in o['faces'])+')','local uv=#('+','.join(fmt([*p,0]) for p in o['uv'])+')','local n=mesh name:"'+o['name']+'" vertices:vs faces:fs','setNumTVerts n uv.count;buildTVFaces n','for i=1 to uv.count do setTVert n i uv[i]','for i=1 to fs.count do (setTVFace n i fs[i];setFaceSmoothGroup n i 1)','update n','convertToPoly n','n.material=TeaMats['+str(mi[o['material']])+'];n.wirecolor=n.material.diffuse','setUserProp n "Assembly" "Porcelain_Teapot"','setUserProp n "EditablePart" true','(layerFor "01_TEAPOT_EDITABLE_PARTS").addNode n','append TeaParts n',')']
ms+=['local ground=plane name:"Studio_Ground" width:1000 length:1000 pos:[0,0,0]','ground.material=standardMaterial name:"Studio_Paper" diffuse:(color 210 214 208)','(layerFor "02_STUDIO").addNode ground','local ct=targetObject name:"Hero_Target" pos:[0,0,10.5]','local cam=targetCamera name:"Camera_Hero" pos:[15,-73,30] target:ct;cam.fov=32','(layerFor "02_STUDIO").addNode cam;(layerFor "02_STUDIO").addNode ct','local ct2=targetObject name:"Detail_Target" pos:[0,0,10.5]','local cam2=targetCamera name:"Camera_Alternate" pos:[-25,-65,34] target:ct2;cam2.fov=34','(layerFor "02_STUDIO").addNode cam2;(layerFor "02_STUDIO").addNode ct2','renderers.current=Default_Scanline_Renderer()','backgroundColor=color 218 221 214;ambientColor=color 38 40 44','local l=omniLight name:"Key_Softbox" pos:[-25,-35,50] multiplier:1.0','try(l.castShadows=true;l.shadowGenerator=ShadowMap();l.mapSize=2048)catch()','l=omniLight name:"Fill_Softbox" pos:[35,-18,28] multiplier:.55','l=omniLight name:"Rim_Softbox" pos:[5,30,40] multiplier:.65','select TeaParts;viewport.setCamera cam;clearSelection()','renderWidth=1400;renderHeight=1100','saveMaxFile @"'+str(OUT/'3d.max')+'" quiet:true','fileIn @"'+str(AS/'pipeline/export_native.ms')+'"','render camera:cam outputFile:@"'+str(OUT/'Teapot_Hero.png')+'" width:1400 height:1100 vfb:false','render camera:cam2 outputFile:@"'+str(OUT/'Teapot_Alternate.png')+'" width:1400 height:1100 vfb:false']
(OUT/'build_teapot.ms').write_text('(\n'+'\n'.join(ms)+'\n)',encoding='utf-8-sig')
print(json.dumps({'objects':len(objects),'triangles':sum(len(o['faces']) for o in objects),'scriptBytes':(OUT/'build_teapot.ms').stat().st_size}))
