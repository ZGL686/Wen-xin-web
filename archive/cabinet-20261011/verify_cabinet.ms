(
local root = @"C:\Users\SM\Desktop\3d\work\"
local logFile = createFile (root+"verification.txt")
local outputPath = @"C:\Users\SM\Desktop\3d\柜子_补齐完成.max"
format "NATIVE_MAX=% LOADED=%\n" (isMaxFile outputPath) maxFileName to:logFile
format "OBJECTS=% GEOMETRY=% CAMERAS=% LIGHTS=% VISIBLE=%\n" objects.count geometry.count cameras.count lights.count (for n in objects where not n.isHidden collect n.name) to:logFile
format "UNITS=% SYSTEM_SCALE=% DISPLAY=%\n" units.SystemType units.SystemScale units.DisplayType to:logFile
local n = $Box001
format "CABINET_CLASS=% MODIFIERS=% WIRE_COLOR=% MATERIAL=% BOUNDS=%\n" (classOf n) (for m in n.modifiers collect (classOf m)) n.wirecolor n.material (nodeGetBoundingBox n (matrix3 1)) to:logFile
format "OPERANDS=%\n" (n.BooleanObject2.GetNumOperands()) to:logFile
for i=1 to n.BooleanObject2.GetNumOperands() do
(
local oname = ""
local disabled = false
local op = #union
n.BooleanObject2.GetOperandName i &oname
n.BooleanObject2.GetDisable i &disabled
n.BooleanObject2.GetOperationType i &op
format "OPERAND|%|%|CLASS=%|DISABLED=%|OP=%|TM=%\n" i oname (classOf n.objects[i]) disabled op n.operand_tm[i].value to:logFile
if i > 1 do
(
local cut = n.objects[i]
local rd = 0
while classOf cut != Box and rd < 6 do (cut = refs.getReference cut 1; rd += 1)
format "CUTTER_DIMENSIONS|%|WIDTH=%|LENGTH=%|HEIGHT=%\n" i cut.width cut.length cut.height to:logFile
)
)
local meshFile = createFile (root+"completed_mesh.obj")
local offset = 0
for obj in geometry do
(
local bb = nodeGetBoundingBox obj (matrix3 1)
local m = snapshotAsMesh obj
format "NODE|%|HANDLE=%|CLASS=%|POS=%|ROT=%|SCALE=%|BB=%;%|HIDDEN=%|FROZEN=%|WIRE=%|VERTS=%|FACES=%\n" obj.name obj.handle (classOf obj) obj.pos obj.rotation obj.scale bb[1] bb[2] obj.isHidden obj.isFrozen obj.wirecolor m.numverts m.numfaces to:logFile
format "o %\n" obj.name to:meshFile
for vi=1 to m.numverts do
(
local p = (getVert m vi)*obj.objectTransform
format "v % % %\n" p.x p.y p.z to:meshFile
)
for fi=1 to m.numfaces do
(
local face = getFace m fi
format "f % % %\n" ((face.x as integer)+offset) ((face.y as integer)+offset) ((face.z as integer)+offset) to:meshFile
)
offset += m.numverts
delete m
)
close meshFile
close logFile
renderers.current = Default_Scanline_Renderer()
backgroundColor = color 230 230 230
ambientColor = color 65 65 65
renderWidth = 1400
renderHeight = 1200
local cam = Targetcamera pos:[4000,-3300,2850] target:(Targetobject pos:[0,0,870])
cam.fov = 40
local light1 = Omnilight pos:[3000,-2100,3200] multiplier:1.0
local light2 = Omnilight pos:[1000,2100,1800] multiplier:0.45
render camera:cam outputfile:@"C:\Users\SM\Desktop\3d\柜子_补齐预览.png" vfb:off
cam.pos = [4600,0,900]
cam.target.pos = [0,0,900]
cam.fov = 30
render camera:cam outputfile:(root+"completed_front.png") vfb:off
quitMax #noPrompt
)
