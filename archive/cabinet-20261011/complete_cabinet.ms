(
local logFile = createFile @"C:\Users\SM\Desktop\3d\work\completion.log"
try
(
local n = $Box001
if n == undefined or classOf n != Boolean3 do throw "Expected original Boolean3 cabinet"
local originalBB = nodeGetBoundingBox n (matrix3 1)
local originalCount = objects.count
local operandCount = n.BooleanObject2.GetNumOperands()
if operandCount != 7 do throw "Unexpected original operand count"
format "BEFORE: OBJECTS=% OPERANDS=% BOUNDS=%\n" originalCount operandCount originalBB to:logFile
local ok = n.BooleanObject2.SetDisable 2 true
if not ok do throw "Could not suppress the plinth cut"
format "RESTORED_BASE: disabled original bottom subtraction operand 2\n" to:logFile
for i=3 to 7 do
(
local cutter = n.objects[i]
local refDepth = 0
while classOf cutter != Box and refDepth < 6 do
(
format "UNWRAP: % CLASS=% REFS=%\n" i (classOf cutter) (refs.getNumRefs cutter) to:logFile
cutter = refs.getReference cutter 1
refDepth += 1
)
local cutterTM = n.operand_tm[i].value
format "CUTTER_BEFORE: % CLASS=% TM_CLASS=% TM=% LENGTH=%\n" i (classOf cutter) (classOf cutterTM) cutterTM cutter.length to:logFile
if classOf cutter != Box or classOf cutterTM != Matrix3 do throw "Unexpected cutter structure"
local innerY = cutterTM.row4.y + cutter.length/2.0
local outerY = -1040.0
local newLength = innerY - outerY
if newLength <= 0 or newLength >= cutter.length do throw "Invalid side repair dimensions"
cutter.length = newLength
local p = cutterTM.row4
p.y = (innerY+outerY)/2.0
cutterTM.row4 = p
n.operand_tm[i].value = cutterTM
format "CUTTER_AFTER: % TM=% LENGTH=% INNER_Y=% OUTER_Y=%\n" i cutterTM cutter.length innerY outerY to:logFile
)
completeRedraw()
local afterBB = nodeGetBoundingBox n (matrix3 1)
local afterMesh = snapshotAsMesh n
format "AFTER: OBJECTS=% OPERANDS=% BOUNDS=% VERTS=% FACES=%\n" objects.count (n.BooleanObject2.GetNumOperands()) afterBB afterMesh.numverts afterMesh.numfaces to:logFile
if objects.count != originalCount do throw "Unexpected extra scene objects"
if distance originalBB[1] afterBB[1] > 0.1 or distance originalBB[2] afterBB[2] > 0.1 do throw "Outside cabinet dimensions changed"
saveMaxFile @"C:\Users\SM\Desktop\3d\柜子_补齐完成.max" quiet:true
format "SAVED=%\n" (isMaxFile @"C:\Users\SM\Desktop\3d\柜子_补齐完成.max") to:logFile
)
catch (format "ERROR=%\n" (getCurrentException()) to:logFile)
close logFile
quitMax #noPrompt
)
