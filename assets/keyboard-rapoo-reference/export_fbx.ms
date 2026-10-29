-- Interchange export uses evaluated mesh copies. Native file stays editable.
(
local dir=@"C:\Users\SM\Desktop\3d\deliverables\Keyboard_Rapoo_20261029\"
local report=createFile @"C:\Users\SM\Desktop\3d\formspace\outputs\keyboard\fbx-export.log"
global keyboardWorldMesh
try (
 resetMaxFile #noPrompt
 loadMaxFile (dir+"Keyboard_Rapoo_3dsMax2026.max") quiet:true useFileUnits:true
 fileIn @"C:\Users\SM\Desktop\3d\assets\keyboard-rapoo-reference\world_mesh.ms"
 local parts=for n in objects where (getUserProp n "Assembly")!=undefined collect n
 local copies=#()
 for p in parts do (format "PREPARE=%\n" p.name to:report;flush report;local c=mesh mesh:(keyboardWorldMesh p) name:("FBX_"+p.name);c.material=p.material;append copies c)
 pluginManager.loadClass FBXEXP
 FBXExporterSetParam "ASCII" false
 FBXExporterSetParam "Animation" false
 FBXExporterSetParam "Cameras" false
 FBXExporterSetParam "Lights" false
 FBXExporterSetParam "SmoothingGroups" true
 FBXExporterSetParam "UpAxis" "Z"
 select copies
 exportFile (dir+"Keyboard_Rapoo.fbx") #noPrompt selectedOnly:true using:FBXEXP
 format "EXPORTED_MESHES=%\nSUCCESS\n" copies.count to:report
 local jf=createFile @"C:\Users\SM\Desktop\3d\formspace\outputs\keyboard\native-meshes.json"
 format "{\"objects\":[" to:jf;local first=true
 for n in copies do (
  local msh=snapshotAsMesh n
  if not first do format "," to:jf;first=false
  format "{\"name\":\"%\",\"material\":\"%\",\"color\":[%,%,%],\"vertices\":[" n.name n.material.name (n.material.diffuse.r/255.0) (n.material.diffuse.g/255.0) (n.material.diffuse.b/255.0) to:jf
  for i=1 to msh.numverts do (local v=getVert msh i;if i>1 do format "," to:jf;format "[%,%,%]" v.x v.y v.z to:jf)
  format "],\"faces\":[" to:jf
  for i=1 to msh.numfaces do (local f=getFace msh i;if i>1 do format "," to:jf;format "[%,%,%]" ((f.x as integer)-1) ((f.y as integer)-1) ((f.z as integer)-1) to:jf)
  format "]}" to:jf
 )
 format "]}" to:jf;close jf
 format "WEB_MESHES_EXPORTED\n" to:report
) catch (format "ERROR=%\n" (getCurrentException()) to:report)
close report
fileIn @"C:\Users\SM\Desktop\3d\assets\keyboard-rapoo-reference\verify_keyboard.ms"
)
