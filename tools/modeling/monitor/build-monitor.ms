-- Native, brand-neutral desktop monitor. Centimeters, front = -Y.
(
local root=(getFilenamePath (getSourceFileName()))+@"..\..\..\"
local out=root+@"formspace\outputs\monitor-native\"
makeDir out all:true
local report=createFile (out+"build-status.txt") encoding:#utf8
try (
resetMaxFile #noPrompt
units.SystemType=#centimeters
units.SystemScale=1.0
units.DisplayType=#metric
units.MetricType=#centimeters
global HouseParts=#()
global HouseOut=out
local panel="01_Panel";local wall="02_Wallpaper";local io="03_IO";local stand="04_Stand";local studio="90_Studio"
fn monLayer s=(local l=LayerManager.getLayerFromName s;if l==undefined do l=LayerManager.newLayerFromName s;l)
fn monMaterial s c shine gloss illum:0=(
 local m=standardMaterial name:s diffuse:c ambient:c specularLevel:shine glossiness:gloss
 m.selfIllumAmount=illum
 m
)
local frame=monMaterial "Graphite_Bezel" (color 35 41 48) 42 45
local back=monMaterial "Graphite_Molded_Shell" (color 54 61 70) 28 39
local seam=monMaterial "Polymer_Seams" (color 21 26 32) 10 30
local metal=monMaterial "Satin_Graphite_Aluminum" (color 71 80 89) 65 49
local lower=monMaterial "Base_Accent_Edge" (color 50 59 68) 47 53
local rubber=monMaterial "Rubber_Feet" (color 27 31 35) 4 18
local socket=monMaterial "Recess_Dark" (color 9 12 18) 5 25
local steel=monMaterial "Connector_Brushed_Steel" (color 145 153 158) 76 58
local copper=monMaterial "Connector_Contacts" (color 184 140 73) 57 50
local absBlue=monMaterial "USB_Blue_Insert" (color 38 89 157) 24 41
local legend=monMaterial "Subtle_Grey_Marking" (color 135 147 155) 8 27
local led=monMaterial "Power_LED" (color 103 214 214) 10 60 illum:100
local screen=monMaterial "Display_Deep_Navy" (color 12 26 53) 11 65 illum:100
local head=point name:"Monitor_Head_Tilt" pos:[0,4.7,29.8] size:3 box:false cross:true
(monLayer panel).addNode head
fn monPart n m ln h:undefined=(
 n.material=m;n.wirecolor=m.diffuse
 convertToPoly n
 if h!=undefined do n.parent=h
 setUserProp n "Assembly" "Monitor"
 (monLayer ln).addNode n
 append HouseParts n
 n
)
fn monBoxPart nm d p r m ln h:undefined ang:0=(
 local n=chamferBox name:nm width:d.x length:d.y height:d.z fillet:r Fillet_Segments:3
 centerPivot n
 n.rotation=eulerAngles ang 0 0
 n.pos=p
 monPart n m ln h:h
)
fn monBarrel nm p r len m ln h:undefined=(
 local n=cylinder name:nm radius:r height:len sides:32 heightsegs:1 capsegs:1 smooth:true
 n.dir=[0,1,0];n.pos=p
 monPart n m ln h:h
)
-- Closed tapered back: concentric rounded XZ loops from front to back.
fn monShell nm sections m ln h:undefined=(
 local v=#();local f=#();local seg=6;local cnt=4*(seg+1)
 for s in sections do (
  local w=s[1];local ht=s[2];local r=s[3];local y=s[4];local z=s[5]
  for q=0 to 3 do (
   local x0=if q==0 or q==3 then w/2-r else -w/2+r
   local z0=if q<2 then ht/2-r else -ht/2+r
   for i=0 to seg do (
    local a=q*90.0+i*90.0/seg
    append v [x0+r*cos(a),y,z+z0+r*sin(a)]
   )
  )
 )
 for i=2 to cnt-1 do append f [1,i,i+1]
 local last=(sections.count-1)*cnt
 for i=2 to cnt-1 do append f [last+1,last+i+1,last+i]
 for j=0 to sections.count-2 do for i=1 to cnt do (
  local k=if i==cnt then 1 else i+1
  local a=j*cnt+i;local b=j*cnt+k
  append f [a,b+cnt,b];append f [a,a+cnt,b+cnt]
 )
 local n=mesh name:nm vertices:v faces:f
 for i=1 to f.count do setFaceSmoothGroup n i (if i<=2*(cnt-2) then 0 else 1)
 update n
 centerPivot n
 monPart n m ln h:h
)
monBoxPart "Front_Bezel" [61.25,.82,35.35] [0,0,29.8] .19 frame panel h:head
monBoxPart "Panel_Perimeter_Seam" [61.11,.30,35.23] [0,.51,29.8] .11 seam panel h:head
monShell "Back_Shell" #(#(61.00,35.06,.52,.62,29.8),#(61.00,35.06,.52,.85,29.8),#(60.35,34.55,.78,1.39,29.72),#(58.82,33.28,1.0,2.33,29.66),#(57.95,32.53,1.12,2.55,29.63)) back panel h:head
monBoxPart "Screen_Active" [59.77,.105,33.62] [0,-.439,30.09] .035 screen panel h:head
monBoxPart "Power_LED_Lens" [.37,.05,.095] [27.95,-.429,12.77] .018 led panel h:head
monBoxPart "Power_Button" [.67,.38,.21] [27.9,.54,12.1] .07 frame panel h:head
for i=0 to 2 do monBoxPart ("OSD_Button_"+(i as string)) [.46,.32,.16] [26.86-i*.79,.54,12.13] .06 seam panel h:head
-- Inset back module and VESA fasteners.
monShell "VESA_Back_Module" #(#(25.0,16.1,1.55,2.49,27.1),#(24.4,15.5,1.48,2.84,27.16),#(23.0,14.2,1.32,3.40,27.34),#(22.56,13.8,1.22,3.48,27.42)) back panel h:head
for x in #(-5.0,5.0) do for z in #(24.8,34.8) do (
 local id=(if x<0 then "L_" else "R_")+(if z<30 then "Lower" else "Upper")
 local y=if z<30 then 3.48 else 2.55
 monBarrel ("VESA_Rim_"+id) [x,y-.04,z] .29 .10 lower io h:head
 monBarrel ("VESA_Bore_"+id) [x,y+.066,z] .158 .026 socket io h:head
)
-- Slotted exhaust strip; dark slots separated from their surrounding panel.
monBoxPart "Rear_Vent_Recess" [25.1,.085,.88] [0,2.565,40.35] .036 lower io h:head
for i=0 to 23 do monBoxPart ("Vent_Slot_"+((i+1) as string)) [.25,.05,.57] [-11.35+i*.987,2.63,40.35] .023 socket io h:head
-- Each rectangular receptacle has an open lip, a recessed bed, and a separate insert.
monBoxPart "Rear_Port_Bay" [21.8,.20,2.16] [0,3.48,21.44] .083 seam io h:head
fn monPort nm x z w ht insert ln h=(
 local y=3.74;local t=.085
 monBoxPart (nm+"_Recess") [w,.105,ht] [x,3.61,z] .036 socket ln h:h
 for d in #(-1,1) do (
  local tag=if d<0 then "_A" else "_B"
  monBoxPart (nm+"_Long_Lip"+tag) [w,.33,t] [x,y,z+d*(ht-t)/2] .025 steel ln h:h
  monBoxPart (nm+"_Short_Lip"+tag) [t,.33,ht-2*t] [x+d*(w-t)/2,y,z] .023 steel ln h:h
 )
 monBoxPart (nm+"_Tongue") [w-.26,.16,.12] [x,3.72,z-.13] .028 insert ln h:h
 for i=1 to 4 do monBoxPart (nm+"_Contact_"+(i as string)) [.044,.12,.032] [x+(i-2.5)*(w-.40)/4,3.72,z-.058] .013 copper ln h:h
)
monPort "DisplayPort" -6.5 21.5 1.55 .66 seam io head
monPort "HDMI" -3.9 21.5 1.45 .58 seam io head
monPort "USB_A_1" -1.3 21.5 1.38 .58 absBlue io head
monPort "USB_A_2" 1.0 21.5 1.38 .58 absBlue io head
monBarrel "Audio_Socket_Rim" [3.5,3.60,21.5] .265 .27 steel io h:head
monBarrel "Audio_Socket_Recess" [3.5,3.864,21.5] .18 .025 socket io h:head
monBarrel "DC_Input_Rim" [6.12,3.6,21.5] .37 .27 steel io h:head
monBarrel "DC_Input_Recess" [6.12,3.862,21.5] .291 .018 socket io h:head
monBarrel "DC_Input_Center_Pin" [6.12,3.89,21.5] .057 .044 copper io h:head
for x in #(-6.5,-3.9,-1.3,1,3.5,6.12) do monBoxPart ("IO_Alignment_Mark_"+(x as string)) [.27,.035,.042] [x,3.60,20.85] .012 legend io h:head
-- Separate base, fixed upright, tilt connection and snap-on cable guide.
monBoxPart "Base_Foot" [26.7,21.4,1.22] [0,1.3,.83] .51 metal stand
monBoxPart "Base_Lower_Trim" [26.43,21.15,.36] [0,1.3,.40] .16 lower stand
for x in #(-9.8,9.8) do for y in #(-5.6,8.1) do monBoxPart ("Base_Rubber_"+(x as string)+"_"+(y as string)) [3.4,1.65,.235] [x,y,.1175] .105 rubber stand
monBoxPart "Stand_Base_Collar" [7.0,6.1,.82] [0,5.2,1.62] .34 lower stand
monBoxPart "Stand_Upright" [4.92,3.25,27.7] [0,6.98,15.5] .70 metal stand ang:-8
monBoxPart "Stand_Tilt_Hinge" [5.68,4.96,4.38] [0,5.57,29.38] .78 lower stand
monBoxPart "Head_Quick_Release" [6.94,1.25,6.05] [0,3.80,29.8] .47 frame panel h:head
monBoxPart "Hinge_Release_Tab" [1.85,.37,.23] [0,4.30,26.61] .09 seam panel h:head
for x in #(-2.36,2.36) do monBoxPart ("Cable_Guide_Arm_"+(x as string)) [.50,2.55,3.22] [x,9.13,9.65] .22 lower stand ang:-8
monBoxPart "Cable_Guide_Bridge" [5.11,.76,3.12] [0,10.26,9.87] .32 lower stand ang:-8
-- Abstract wallpaper made from independent color ribbons. Disable this layer for a clean screen.
local c=#([10,30,61],[14,43,83],[18,56,100],[20,67,113],[19,80,129],[22,95,143],[30,113,155],[43,132,166],[66,153,174],[95,172,181],[125,188,187],[150,200,189],[176,210,193],[192,220,198],[216,229,202])
fn monCurve x offset=(
 local u=(x+29.865)/59.73
 12.2+offset+(12.4*sin(14+u*146.0))-(6.0*cos(30+u*278.0))
)
fn monRibbon nm low high y m ln h=(
 local vs=#();local fs=#();local zmin=13.292;local zmax=46.888
 for i=0 to 72 do (
  local x=-29.864+59.728*i/72.0
  local z0=amin zmax (amax zmin (monCurve x low));local z1=amin zmax (amax zmin (monCurve x high))
  if z1-z0<.0001 do (if z1<zmax then z1=z0+.0001 else z0=z1-.0001)
  append vs [x,y,z0];append vs [x,y,z1]
  if i>0 do (
   local a=2*i-1
   append fs [a,a+2,a+3];append fs [a,a+3,a+1]
  )
 )
 local n=mesh name:nm vertices:vs faces:fs
 monPart n m ln h:h
)
for i=1 to c.count do (
 local rgb=c[i]
 local m=monMaterial ("Wallpaper_Palette_"+(i as string)) (color rgb.x rgb.y rgb.z) 0 60 illum:100
 local v=-13.0+(i-1)*2.12
 monRibbon ("Wallpaper_Ribbon_"+(i as string)) v (v+2.14) (-.503-.0005*i) m wall head
)
local edge=monMaterial "Wallpaper_Fold_Outline" (color 149 213 209) 0 60 illum:100
monRibbon "Wallpaper_Fold_Highlight" 7.12 7.22 -.522 edge wall head
local disk=monMaterial "Wallpaper_Moon" (color 205 225 218) 0 50 illum:100
monBarrel "Wallpaper_Moon" [20.05,-.530,41.3] 1.92 .009 disk wall h:head
-- Render studio is stored on one layer and excluded from the preview mesh.
local cyclorama=plane name:"Studio_Cyclorama" width:1800 length:1800 pos:[0,0,-.012]
cyclorama.material=monMaterial "Studio_Neutral_Warm" (color 177 171 163) 8 24
(monLayer studio).addNode cyclorama
renderers.current=Default_Scanline_Renderer()
backgroundColor=color 206 204 201
ambientColor=color 83 84 90
fn monCameraAt nm p aim f=(
 local t=targetObject name:(nm+"_Target") pos:aim
 local cam=targetCamera name:nm pos:p target:t
 cam.fov=f
 (monLayer "90_Studio").addNode t;(monLayer "90_Studio").addNode cam
 cam
)
fn monLum nm p mult col shadow:false=(
 local l=omniLight name:nm pos:p multiplier:mult color:col
 if shadow do (
  l.castShadows=true;l.shadowGenerator=ShadowMap();l.mapSize=4096
  try(l.mapSampleRange=11;l.mapBias=.055)catch()
 )
 (monLayer "90_Studio").addNode l
 l
)
local hero=monCameraAt "Camera_Front_Quarter" [77,-173,79] [0,0,24] 24
local rear=monCameraAt "Camera_Rear_Quarter" [-71,150,74] [0,0,24] 27
monLum "Key_Soft_Warm" [-76,-84,121] .78 (color 255 239 223) shadow:true
monLum "Fill_Front_Right" [78,-62,85] .56 (color 221 236 255)
monLum "Rear_Softbox" [14,96,92] .86 (color 240 246 255)
monLum "Low_Bounce" [-22,44,27] .18 (color 233 239 248)
viewport.setCamera hero
clearSelection()
renderWidth=1550;renderHeight=1160
local priorCompression=maxOps.getCompressSceneFileOnSave()
maxOps.setCompressSceneFileOnSave true writeInCfgFile:false
local saved=saveMaxFile (out+"Monitor_27_3dsMax2026.max") quiet:true
maxOps.setCompressSceneFileOnSave priorCompression writeInCfgFile:false
if not saved do throw "Native save failed"
format "MAX_SAVED parts=%\n" HouseParts.count to:report;flush report
fileIn (root+@"assets\house-cute\pipeline\export_native.ms")
format "MESH_EXPORTED\n" to:report;flush report
render camera:hero outputFile:(out+"Monitor_Front.png") width:1550 height:1160 vfb:false
render camera:rear outputFile:(out+"Monitor_Rear.png") width:1550 height:1160 vfb:false
format "BUILD_RENDER_OK\n" to:report
) catch (format "ERROR: %\n" (getCurrentException()) to:report; try(format "%\n" (getCurrentExceptionStackTrace()) to:report)catch())
close report
)
