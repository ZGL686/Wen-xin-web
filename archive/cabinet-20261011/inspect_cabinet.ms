(
local root = @"C:\Users\SM\Desktop\3d\work\"
local f = createFile (root + "original_scene.txt")
format "MAX_FILE=%\nFILE=%\nUNITS=% SCALE=% DISPLAY=%\nOBJECTS=% GEOMETRY=%\n" (isMaxFile @"C:\Users\SM\Desktop\3d\柜子(1).max") maxFileName units.SystemType units.SystemScale units.DisplayType objects.count geometry.count to:f
local meshFile = createFile (root + "original_mesh.obj")
local offset = 0
for n in objects do
(
local bb = nodeGetBoundingBox n (matrix3 1)
format "NODE|%|HANDLE=%|CLASS=%|BASE=%|POS=%|ROT=%|SCALE=%|BB=%;%|HIDDEN=%|FROZEN=%|WIRE=%|PARENT=%|MODS=%\n" n.name n.handle (classOf n) (classOf n.baseObject) n.pos n.rotation n.scale bb[1] bb[2] n.isHidden n.isFrozen n.wirecolor (if n.parent == undefined then "none" else n.parent.name) (for m in n.modifiers collect ((classOf m) as string)) to:f
if n.material != undefined do format "MATERIAL|%|%|%\n" n.name n.material.name (classOf n.material) to:f
if superclassOf n == GeometryClass do
(
local m = snapshotAsMesh n
format "MESH|%|VERTS=%|FACES=%\n" n.name m.numverts m.numfaces to:f
format "o %\n" n.name to:meshFile
for v = 1 to m.numverts do
(
local p = (getVert m v) * n.objectTransform
format "v % % %\n" p.x p.y p.z to:meshFile
)
for fi = 1 to m.numfaces do
(
local face = getFace m fi
format "f % % %\n" ((face.x as integer)+offset) ((face.y as integer)+offset) ((face.z as integer)+offset) to:meshFile
)
offset += m.numverts
delete m
)
)
close f
close meshFile
quitMax #noPrompt
)

