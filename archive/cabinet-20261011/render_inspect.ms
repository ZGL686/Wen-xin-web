(
local f = createFile @"C:\Users\SM\Desktop\3d\work\boolean_details.txt"
showInterface BooleanObjectManager to:f
try (showInterface Boolean2ObjectManager to:f) catch ()
local n = $Box001
showProperties n to:f
showInterfaces n to:f
format "\nBASE PROPERTIES\n" to:f
showProperties n.baseObject to:f
format "\nBASE INTERFACES\n" to:f
showInterfaces n.baseObject to:f
local bc = 0
BooleanObjectManager.GetNumBooleanObjects &bc
format "BOOLEAN_COUNT=%\n" bc to:f
for bi=1 to bc do
(
local oc = 0
BooleanObjectManager.GetNumberOfOperands bi &oc
format "BOOLEAN_INDEX=% OPERANDS=%\n" bi oc to:f
for oi=1 to oc do
(
local oname = ""
local op = #union
BooleanObjectManager.GetOperandName bi oi &oname
BooleanObjectManager.GetOperationType bi oi &op
format "OPERAND=% NAME=% OP=%\n" oi oname op to:f
)
)
format "\nBOUNDARY DETAILS\n" to:f
local m = snapshotAsMesh n
for i=1 to m.numverts do format "% %\n" i ((getVert m i)*n.objectTransform) to:f
close f
renderers.current = Default_Scanline_Renderer()
backgroundColor = color 230 230 230
ambientColor = color 65 65 65
renderWidth = 1400
renderHeight = 1200
local cam = Targetcamera pos:[4000,-3300,2850] target:(Targetobject pos:[0,0,870])
cam.fov = 40
local light1 = Omnilight pos:[3000,-2100,3200] multiplier:1.0
local light2 = Omnilight pos:[1000,2100,1800] multiplier:0.45
render camera:cam outputfile:@"C:\Users\SM\Desktop\3d\work\original_native.png" vfb:off
cam.pos = [4600,0,900]
cam.target.pos = [0,0,900]
cam.fov = 30
render camera:cam outputfile:@"C:\Users\SM\Desktop\3d\work\original_front.png" vfb:off
quitMax #noPrompt
)
