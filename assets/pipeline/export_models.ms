(
local outdir = getFilenamePath (getSourceFileName())
local sourceDir = pathConfig.convertPathToAbsolute (outdir + @"..\source\")
local log = createFile (outdir + "export.log")
local specs = #(#("house", (sourceDir + @"房子3d.max")), #("cabinet", (sourceDir + @"柜子_补齐完成.max")), #("lamp", (sourceDir + @"AURELIA_Jade_Lamp.max")), #("sofa", (sourceDir + @"Sofa_3dsMax2026.max")))
for spec in specs do
(
try
(
resetMaxFile #noPrompt
loadMaxFile spec[2] useFileUnits:true quiet:true
local obj = createFile (outdir + spec[1] + ".obj")
local mtl = createFile (outdir + spec[1] + ".mtl")
format "mtllib %.mtl\n" spec[1] to:obj
local indexOffset = 0
local nodeCount = 0
local faceCount = 0
local vertCount = 0
for n in geometry where not n.isHidden do
(
try
(
local mesh = snapshotAsMesh n
if mesh.numfaces > 0 do
(
nodeCount += 1
local c = color 192 181 158
if spec[1] == "lamp" do c = color 92 143 123
if spec[1] == "sofa" do c = color 205 176 143
if n.material != undefined do
(
try (c = n.material.base_color) catch (try (c = n.material.diffuse) catch ())
)
if classof c != Color do c = color 192 181 158
format "newmtl m%\nKd % % %\nKs 0.1 0.1 0.1\nNs 30\n\n" nodeCount (c.r/255.0) (c.g/255.0) (c.b/255.0) to:mtl
format "o object_%\nusemtl m%\n" nodeCount nodeCount to:obj
for i=1 to mesh.numverts do
(
local p = (getVert mesh i) * n.objectTransform
format "v % % %\n" p.x p.y p.z to:obj
)
for i=1 to mesh.numfaces do
(
local f = getFace mesh i
format "f % % %\n" ((f.x as integer)+indexOffset) ((f.y as integer)+indexOffset) ((f.z as integer)+indexOffset) to:obj
)
format "NODE|%|%|%|%\n" spec[1] n.name mesh.numverts mesh.numfaces to:log
indexOffset += mesh.numverts
vertCount += mesh.numverts
faceCount += mesh.numfaces
)
) catch (format "NODE_ERROR|%|%|%\n" spec[1] n.name (getCurrentException()) to:log)
)
close obj
close mtl
format "RESULT|%|%|%|%|%|%\n" spec[1] nodeCount vertCount faceCount units.SystemType units.SystemScale to:log
try
(
pluginManager.loadClass FBXEXP
FBXExporterSetParam "Animation" false
FBXExporterSetParam "Cameras" false
FBXExporterSetParam "Lights" false
FBXExporterSetParam "EmbedTextures" true
exportFile (outdir + spec[1] + ".fbx") #noPrompt selectedOnly:false using:FBXEXP
format "FBX_OK|%\n" spec[1] to:log
) catch (format "FBX_ERROR|%|%\n" spec[1] (getCurrentException()) to:log)
flush log
) catch (format "SCENE_ERROR|%|%\n" spec[1] (getCurrentException()) to:log)
)
close log
quitMax #noPrompt
)
