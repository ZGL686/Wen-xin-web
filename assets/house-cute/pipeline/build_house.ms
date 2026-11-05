-- Berry Cottage. Native editable clay-style scene, centimetres.
(
resetMaxFile #noPrompt
units.SystemType=#centimeters
units.SystemScale=1.0
global HouseParts=#()
global HouseRoot=@"C:\Users\SM\Desktop\3d\"
global HouseOut=HouseRoot+@"formspace\outputs\house-native\"
makeDir HouseOut all:true
fn houseLayer s=(local l=LayerManager.getLayerFromName s;if l==undefined do l=LayerManager.newLayerFromName s;l)
fn clay s c=(standardMaterial name:s diffuse:c ambient:c specularLevel:18 glossiness:28)
local cream=clay "01_Vanilla_Plaster" (color 244 221 177)
local ivory=clay "02_Whipped_Cream_Trim" (color 255 240 211)
local coral=clay "03_Strawberry_Roof" (color 208 100 94)
local pink=clay "04_Rose_Tile" (color 224 129 116)
local peach=clay "05_Peach_Tile" (color 232 148 123)
local roofDark=clay "06_Roof_Shadow" (color 151 73 75)
local mint=clay "07_Sage_Joinery" (color 121 166 139)
local mintLight=clay "08_Pistachio" (color 158 190 142)
local glass=clay "09_Blue_Glass" (color 93 148 159)
local wood=clay "10_Honey_Wood" (color 164 116 80)
local lilac=clay "11_Lavender_Door" (color 164 143 184)
global gold=clay "12_Brass" (color 218 169 85)
local grass=clay "13_Meadow" (color 155 184 124)
local soil=clay "14_Biscuit_Base" (color 207 165 115)
global leaf=clay "15_Garden_Leaf" (color 92 143 111)
local leaf2=clay "16_Apple_Leaf" (color 126 165 116)
local flower=clay "17_Raspberry_Petal" (color 225 137 162)
local flower2=clay "18_Daisy_Petal" (color 252 231 193)
local ink=clay "19_Deep_Teal" (color 61 102 99)
fn part n m lay=(
 n.material=m;n.wirecolor=m.diffuse
 convertToPoly n
 setUserProp n "Assembly" "Berry_Cottage"
 setUserProp n "EditablePart" true
 (houseLayer lay).addNode n;append HouseParts n;n
)
fn softBox nm dims p r m lay ang:[0,0,0]=(
 local n=chamferBox name:nm width:dims.x length:dims.y height:dims.z fillet:r Fillet_Segments:4 pos:[0,0,0]
 centerPivot n;n.rotation=eulerAngles (-ang.x) (-ang.y) (-ang.z);n.pos=p
 part n m lay
)
fn ball nm p dims m lay=(
 local n=sphere name:nm radius:1 segments:20 smooth:true
 n.scale=dims;n.pos=p
 part n m lay
)
fn rod nm a b r m lay=(
 local v=b-a
 local n=cylinder name:nm radius:r height:(length v) sides:16 heightsegs:1 capsegs:1 smooth:true
 n.dir=normalize v;n.pos=a
 part n m lay
)
fn disc nm p r depth m lay=(
 local n=cylinder name:nm radius:r height:depth sides:64 heightsegs:1 capsegs:1 smooth:true
 n.rotation=eulerAngles -90 0 0;n.pos=p
 part n m lay
)
fn arch nm cx cy bottom w h depth m lay=(
 local points=#([-w/2,0,0],[w/2,0,0])
 local r=w/2
 for i=0 to 24 do (local a=i*180.0/24;append points [r*cos(a),0,h-r+r*sin(a)])
 local vs=#();local fs=#();local cnt=points.count
 for p in points do append vs [cx+p.x,cy,bottom+p.z]
 for p in points do append vs [cx+p.x,cy+depth,bottom+p.z]
 for i=2 to cnt-1 do (append fs [1,i,i+1];append fs [cnt+1,cnt+i+1,cnt+i])
 for i=1 to cnt do (local j=if i==cnt then 1 else i+1;append fs [i,cnt+j,j];append fs [i,cnt+i,cnt+j])
 local n=mesh name:nm vertices:vs faces:fs
 for i=1 to fs.count do setFaceSmoothGroup n i 0
 update n;part n m lay
)
fn gable nm xs cy z w d rise m lay=(
 local vs=#([xs-w/2,cy-d/2,z],[xs+w/2,cy-d/2,z],[xs,cy-d/2,z+rise],[xs-w/2,cy+d/2,z],[xs+w/2,cy+d/2,z],[xs,cy+d/2,z+rise])
 local fs=#([1,2,3],[4,6,5],[1,5,2],[1,4,5],[2,6,3],[2,5,6],[3,4,1],[3,6,4])
 local n=mesh name:nm vertices:vs faces:fs;part n m lay
)
fn flowerAt prefix p col=(
 rod (prefix+"_Stem") p (p+[0,0,3.2]) .14 leaf "05_GARDEN"
 for i=0 to 4 do (local a=i*72;ball (prefix+"_Petal_"+i as string) (p+[.7*cos(a),-.05,3.2+.7*sin(a)]) [.57,.27,.57] col "05_GARDEN")
 ball (prefix+"_Pollen") (p+[0,-.3,3.2]) [.36,.25,.36] gold "05_GARDEN"
)
-- Floating, softly rounded collectible base.
local n=cylinder name:"Biscuit_Platform" radius:50 height:3 sides:96 capsegs:1 pos:[0,-6,0]
n.scale=[1,1.15,1];n.pos=[0,-6,0];part n soil "04_BASE_PATH"
n=cylinder name:"Meadow_Inset" radius:49.3 height:1.3 sides:96 capsegs:1 pos:[0,-6,2.8]
n.scale=[1,1.15,1];n.pos=[0,-6,2.8];part n grass "04_BASE_PATH"
softBox "Main_Foundation" [53,41,3] [0,4,5] 1.2 ivory "01_ARCHITECTURE"
softBox "Main_Cream_Walls" [50,38,30] [0,4,21] 1.4 cream "01_ARCHITECTURE"
softBox "Porch_Foundation" [29,24,3] [-7,-23,5.2] 1.1 ivory "01_ARCHITECTURE"
softBox "Front_Cream_Walls" [27,23,27] [-7,-23,19.5] 1.2 cream "01_ARCHITECTURE"
gable "Front_Gable_Plaster" -7 -23 32.5 27 23 13.5 cream "01_ARCHITECTURE"
-- Main ridge runs across X, preserving the original crossed roof silhouette.
n=gable "Main_Gable_Plaster" 0 0 35.5 38 50 17 cream "01_ARCHITECTURE"
n.rotation=eulerAngles 0 0 90;n.pos=[0,4,0]
-- Roof substrate and individual marshmallow shingles.
local slope=atan(18.0/24.0)
softBox "Main_Front_Roof_Core" [56,30,1.8] [0,-8,45] .55 roofDark "02_ROOF" ang:[slope,0,0]
softBox "Main_Back_Roof_Core" [56,30,1.8] [0,16,45] .55 roofDark "02_ROOF" ang:[-slope,0,0]
local roofMats=#(coral,pink,peach)
for side=1 to 2 do for row=0 to 4 do for col=0 to 8 do (
 local x=-25+col*6.25
 local yy=if side==1 then -18.4+row*5.0 else 26.4-row*5.0
 local zz=36.8+(row*5.0+1.6)*.75
 local wingZ=47.8-abs(x+7)*.82
 if not (side==1 and x> -24 and x<10 and yy< -3 and zz<wingZ) do (
  local mat=roofMats[1+mod (row+col*2) 3]
  softBox ("Main_Tile_"+side as string+"_"+row as string+"_"+col as string) [6.3,7.0,1.65] [x,yy,zz] .67 mat "02_ROOF" ang:[(if side==1 then slope else -slope),0,0]
 )
)
local wslope=atan(14.0/17.0)
softBox "Wing_Left_Roof_Core" [22,42,1.7] [-15.5,-17,40] .6 roofDark "02_ROOF" ang:[0,-wslope,0]
softBox "Wing_Right_Roof_Core" [22,42,1.7] [1.5,-17,40] .6 roofDark "02_ROOF" ang:[0,wslope,0]
for side=1 to 2 do for row=0 to 3 do for col=0 to 6 do (
 local xx=if side==1 then -23.1+row*4.5 else 9.1-row*4.5
 local yy=-35.2+col*6
 local zz=34.6+(row*4.5+1)*.8235
 local mz=if yy<4 then 36.8+(yy+20)*.75 else 54-(yy-4)*.75
 if yy< -16 or zz>mz do (
  softBox ("Wing_Tile_"+side as string+"_"+row as string+"_"+col as string) [6.9,6.1,1.6] [xx,yy,zz] .65 roofMats[1+mod (row+col) 3] "02_ROOF" ang:[0,(if side==1 then -wslope else wslope),0]
 )
)
for i=0 to 8 do softBox ("Main_Ridge_Cap_"+i as string) [6.6,3.5,2.1] [-25+i*6.25,4,55.1] .9 coral "02_ROOF"
for i=0 to 5 do softBox ("Wing_Ridge_Cap_"+i as string) [3.5,6.5,2.1] [-7,-35+i*6,48.2] .9 pink "02_ROOF"
for x in #(-28,28) do (
 rod "Main_Gable_Fascia_Front" [x,-21,36.2] [x,4,55] .75 ivory "02_ROOF"
 rod "Main_Gable_Fascia_Back" [x,4,55] [x,29,36.2] .75 ivory "02_ROOF"
)
rod "Front_Gable_Fascia_Left" [-25,-38,33.7] [-7,-38,48.5] .85 ivory "02_ROOF"
rod "Front_Gable_Fascia_Right" [-7,-38,48.5] [11,-38,33.7] .85 ivory "02_ROOF"
rod "Main_Front_Eave" [-28,-21,36] [28,-21,36] .8 coral "02_ROOF"
rod "Main_Back_Eave" [-28,29,36] [28,29,36] .8 coral "02_ROOF"
-- Soft chimney with dark inset and cream cap.
softBox "Chimney_Cream_Stack" [6,6,14] [16,14,51] .65 cream "01_ARCHITECTURE"
softBox "Chimney_Coral_Cap" [8,8,2.5] [16,14,58.8] .85 coral "01_ARCHITECTURE"
softBox "Chimney_Dark_Inset" [4.8,4.8,.35] [16,14,60.2] .15 roofDark "01_ARCHITECTURE"
for k=0 to 2 do softBox ("Chimney_Brick_"+k as string) [3,.35,1.3] [16+(if mod k 2==0 then -.9 else .9),10.93,50+k*3] .12 pink "01_ARCHITECTURE"
-- Independent arched door, raised moulding, panels and brass hardware.
arch "Door_Outer_Sage_Arch" -7 -35.4 6 12.4 22 1.2 mint "03_DOORS_WINDOWS"
arch "Door_Recess_Shadow" -7 -35.6 6.3 10.5 20.7 .3 ink "03_DOORS_WINDOWS"
arch "Door_Lavender_Leaf" -7 -35.85 6.5 9.7 20 .35 lilac "03_DOORS_WINDOWS"
for i=0 to 4 do rod ("Door_Plank_Seam_"+i as string) [-10.7+i*1.85,-36.05,7] [-10.7+i*1.85,-36.05,19.7] .055 wood "03_DOORS_WINDOWS"
disc "Door_Round_Window_Frame" [-7,-36.14,21.2] 2.35 .35 ivory "03_DOORS_WINDOWS"
disc "Door_Round_Window_Glass" [-7,-36.55,21.2] 1.85 .2 glass "03_DOORS_WINDOWS"
rod "Door_Window_Mullion_V" [-7,-36.9,19.4] [-7,-36.9,23] .15 ivory "03_DOORS_WINDOWS"
rod "Door_Window_Mullion_H" [-8.7,-36.9,21.2] [-5.3,-36.9,21.2] .15 ivory "03_DOORS_WINDOWS"
ball "Door_Brass_Knob" [-3.9,-36.35,14.7] [.55,.55,.55] gold "03_DOORS_WINDOWS"
softBox "Front_Step_Lower" [16,6,1.3] [-7,-38.2,4.7] .55 ivory "04_BASE_PATH"
softBox "Front_Step_Upper" [13,3.4,1.3] [-7,-36.7,5.4] .5 soil "04_BASE_PATH"
disc "Attic_Round_Frame" [-7,-35.5,37] 4.2 .8 mint "03_DOORS_WINDOWS"
disc "Attic_Round_Glass" [-7,-36.4,37] 3.35 .4 glass "03_DOORS_WINDOWS"
rod "Attic_Cross_V" [-7,-36.9,33.8] [-7,-36.9,40.2] .28 ivory "03_DOORS_WINDOWS"
rod "Attic_Cross_H" [-10.2,-36.9,37] [-3.8,-36.9,37] .28 ivory "03_DOORS_WINDOWS"
-- Front window bay with individual shutters and flower box.
arch "Front_Window_Frame" 17 -15.7 18 10.5 12.7 1 mint "03_DOORS_WINDOWS"
arch "Front_Window_Blue" 17 -16.8 18.8 8.6 10.9 .3 glass "03_DOORS_WINDOWS"
rod "Front_Window_Cross_V" [17,-17.2,19] [17,-17.2,28.7] .22 ivory "03_DOORS_WINDOWS"
rod "Front_Window_Cross_H" [12.9,-17.2,24] [21.1,-17.2,24] .22 ivory "03_DOORS_WINDOWS"
for x in #(10.2,23.8) do (
 softBox "Front_Window_Shutter" [3,1,10] [x,-16.7,23] .35 mint "03_DOORS_WINDOWS"
 for i=0 to 4 do softBox "Shutter_Louvre" [2.5,.45,.7] [x,-17.35,19.5+i*1.6] .16 mintLight "03_DOORS_WINDOWS"
)
softBox "Window_Flower_Box" [12,3.7,3] [17,-18,16.8] .65 wood "05_GARDEN"
softBox "Window_Flower_Box_Rim" [12.5,4,1] [17,-18,18.2] .4 soil "05_GARDEN"
for i=0 to 3 do flowerAt ("Window_Flower_"+i as string) [13+i*2.7,-18.2,18.2] (if mod i 2==0 then flower else flower2)
-- Two side windows; all geometry independently selectable.
for yy in #(-5,13) do (
 local frame=softBox "Side_Window_Frame" [1.1,11.2,12.5] [25.6,yy,23] .5 mint "03_DOORS_WINDOWS"
 softBox "Side_Window_Glass" [.35,9.4,10.7] [26.25,yy,23] .15 glass "03_DOORS_WINDOWS"
 rod "Side_Window_Cross_H" [26.7,yy-4.6,23] [26.7,yy+4.6,23] .23 ivory "03_DOORS_WINDOWS"
 rod "Side_Window_Cross_V" [26.7,yy,17.8] [26.7,yy,28.2] .23 ivory "03_DOORS_WINDOWS"
 softBox "Side_Window_Sill" [3,13,1.5] [26.3,yy,16.3] .5 ivory "03_DOORS_WINDOWS"
)
-- Heart on the gable is geometry, not a decal.
ball "Heart_Left_Lobe" [-8.1,-37.4,45] [1.2,.45,1.2] flower "03_DOORS_WINDOWS"
ball "Heart_Right_Lobe" [-5.9,-37.4,45] [1.2,.45,1.2] flower "03_DOORS_WINDOWS"
local heart=cone name:"Heart_Point" radius1:0 radius2:1.7 height:2.5 sides:32 pos:[-7,-37.4,42.3]
heart.scale=[1,.28,1];heart.pos=[-7,-37.4,42.3];part heart flower "03_DOORS_WINDOWS"
-- Path, fences and mailbox keep the silhouette readable from all sides.
for i=0 to 3 do softBox ("Garden_Stepping_Stone_"+i as string) [8.5,4.9,1.2] [-7+i*1.2,-40-i*4.6,4.5] .55 ivory "04_BASE_PATH" ang:[0,0,(i-1)*6]
-- Fence across the back and short left return.
for i=0 to 9 do (
 local xx=-38+i*8.3
 softBox ("Fence_Back_Picket_"+i as string) [3.3,1.5,10] [xx,31,8.7] .65 ivory "05_GARDEN"
)
for z in #(7,11) do rod "Fence_Back_Rail" [-39,31.6,z] [38,31.6,z] .7 ivory "05_GARDEN"
for i=0 to 3 do softBox "Fence_Left_Picket" [1.5,3.3,10] [-38,24-i*8,8.7] .65 ivory "05_GARDEN"
for z in #(7,11) do rod "Fence_Left_Rail" [-38.6,-1,z] [-38.6,30,z] .7 ivory "05_GARDEN"
rod "Mailbox_Post" [28,-26,4] [28,-26,15] .85 wood "05_GARDEN"
softBox "Mailbox_Coral_Body" [5,7.3,4.7] [28,-26,16.3] 1.8 coral "05_GARDEN"
softBox "Mailbox_Cream_Front" [4,0.45,3.2] [28,-29.8,16.1] .8 ivory "05_GARDEN"
rod "Mailbox_Letter_Slot" [26.8,-30.12,16.7] [29.2,-30.12,16.7] .12 ink "05_GARDEN"
rod "Mailbox_Flag_Pole" [30.8,-26,16] [30.8,-26,20.7] .18 gold "05_GARDEN"
softBox "Mailbox_Flag" [.35,2.8,1.7] [30.8,-24.8,20.1] .12 flower "05_GARDEN"
-- Round apple tree and garden bushes.
rod "Tree_Trunk" [-32,12,4] [-32,12,22] 1.5 wood "05_GARDEN"
rod "Tree_Branch_Left" [-32,12,15] [-37,12,24] .8 wood "05_GARDEN"
rod "Tree_Branch_Right" [-32,12,17] [-26,12,25] .8 wood "05_GARDEN"
ball "Tree_Canopy_Center" [-32,12,28] [9,7.3,10] leaf2 "05_GARDEN"
ball "Tree_Canopy_Left" [-37.5,12,25] [6.7,6.2,6.7] mintLight "05_GARDEN"
ball "Tree_Canopy_Right" [-26.5,12,26] [6.5,6.5,7] leaf "05_GARDEN"
for p in #([-35,5.7,29],[-29,5,25],[-38.5,8.2,23],[-31,7.5,34]) do ball "Tree_Raspberry_Fruit" p [.8,.8,.8] coral "05_GARDEN"
for spec in #(#([32,18,7],[6,5,4]),#([-30,-23,6],[6,4,3]),#([21,28,6],[7,4,3])) do (
 ball "Garden_Bush_Center" spec[1] spec[2] mintLight "05_GARDEN"
 ball "Garden_Bush_Lobe" (spec[1]+[3,0,-1]) (spec[2]*.7) leaf2 "05_GARDEN"
)
for i=0 to 5 do flowerAt ("Garden_Daisy_"+i as string) [30+(mod i 3)*3,-8+(floor(i/3))*3.2,4] (if mod i 2==0 then flower else flower2)
-- A tiny bunny by the doorway, separate editable pieces.
ball "Bunny_Body" [-22,-30,7] [2.4,2,3.1] ivory "06_LITTLE_DETAILS"
ball "Bunny_Head" [-22,-31,10.1] [2,1.8,2] ivory "06_LITTLE_DETAILS"
ball "Bunny_Ear_Left" [-23,-31,13] [.6,.6,2] ivory "06_LITTLE_DETAILS"
ball "Bunny_Ear_Right" [-21,-31,13] [.6,.6,2] ivory "06_LITTLE_DETAILS"
ball "Bunny_Ear_Pink_Left" [-23,-31.5,13] [.28,.15,1.25] flower "06_LITTLE_DETAILS"
ball "Bunny_Ear_Pink_Right" [-21,-31.5,13] [.28,.15,1.25] flower "06_LITTLE_DETAILS"
for x in #(-22.7,-21.3) do ball "Bunny_Eye" [x,-32.63,10.3] [.14,.13,.17] ink "06_LITTLE_DETAILS"
ball "Bunny_Nose" [-22,-32.83,9.8] [.2,.12,.16] flower "06_LITTLE_DETAILS"
-- Studio stays on its own layer and is excluded from GLB.
local studio=houseLayer "90_STUDIO"
local ground=plane name:"Studio_Paper" width:2000 length:2000 pos:[0,0,-.25]
ground.material=clay "Studio_Warm_Paper" (color 234 222 202);studio.addNode ground
local ct=targetObject name:"Hero_Target" pos:[0,-2,26]
local cam=targetCamera name:"Camera_Hero" pos:[120,-172,115] target:ct
cam.fov=36;studio.addNode cam;studio.addNode ct
local ct2=targetObject name:"Alternate_Target" pos:[0,0,27]
local cam2=targetCamera name:"Camera_Alternate" pos:[-135,-155,100] target:ct2
cam2.fov=36;studio.addNode cam2;studio.addNode ct2
renderers.current=Default_Scanline_Renderer()
backgroundColor=color 234 222 202;ambientColor=color 65 62 59
local l=omniLight name:"Key_Softbox" pos:[-65,-95,155] multiplier:.9
l.castShadows=true;l.shadowGenerator=ShadowMap();l.mapSize=4096
try(l.mapSampleRange=8;l.mapBias=.2)catch()
studio.addNode l
l=omniLight name:"Fill_Softbox" pos:[110,-15,85] multiplier:.38;studio.addNode l
l=omniLight name:"Rim_Softbox" pos:[0,100,130] multiplier:.5;studio.addNode l
select HouseParts;viewport.setCamera cam;clearSelection()
renderWidth=1600;renderHeight=1400
saveMaxFile (HouseOut+"3d.max") quiet:true
fileIn (HouseRoot+@"assets\house-cute\pipeline\export_native.ms")
render camera:cam outputFile:(HouseOut+"House_Hero.png") width:1600 height:1400 vfb:false
render camera:cam2 outputFile:(HouseOut+"House_Alternate.png") width:1600 height:1400 vfb:false
)
