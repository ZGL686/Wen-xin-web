-- Read-only conversion of the existing native mouse. Never saves or overwrites MAX.
(
local project=@"C:\Users\SM\Desktop\3d\"
local report=createFile (project+@"formspace\outputs\mouse\native-export.txt")
global keyboardWorldMesh
try (
 local source=project+@"assets\3d source\ARC01_Mouse_3dsMax2026.max"
 format "IS_MAX_FILE=%\n" (isMaxFile source) to:report
 resetMaxFile #noPrompt
 local loaded=loadMaxFile source quiet:true useFileUnits:true
 format "NATIVE_LOAD=%\nUNITS=%\nSCALE=%\n" loaded units.SystemType units.SystemScale to:report
 if not loaded or units.SystemType!=#centimeters or units.SystemScale!=1.0 do throw "Expected original centimeter scene"
 fileIn (project+@"assets\keyboard-rapoo-reference\world_mesh.ms")
 local parts=for n in geometry where ((snapshotAsMesh n).numfaces>0) collect n
 local lo=[1e9,1e9,1e9];local hi=[-1e9,-1e9,-1e9];local triangles=0
 local jf=createFile (project+@"formspace\outputs\mouse\native-meshes.json")
 format "{\"objects\":[" to:jf;local first=true
 for n in parts do (
  local msh=keyboardWorldMesh n
  local colorValue=try(n.material.diffuse)catch(n.wirecolor)
  local materialName=try(n.material.name)catch("Default")
  local glow=try(n.material.selfIllumAmount/100.0)catch(0)
  local gloss=try(n.material.glossiness)catch(35)
  if not first do format "," to:jf;first=false
  format "{\"name\":\"%\",\"material\":\"%\",\"emission\":%,\"gloss\":%,\"color\":[%,%,%],\"vertices\":[" n.name materialName glow gloss (colorValue.r/255.0) (colorValue.g/255.0) (colorValue.b/255.0) to:jf
  for i=1 to msh.numverts do (
   local v=getVert msh i
   for j=1 to 3 do (lo[j]=amin lo[j] v[j];hi[j]=amax hi[j] v[j])
   if i>1 do format "," to:jf;format "[%,%,%]" v.x v.y v.z to:jf
  )
  triangles+=msh.numfaces
  format "],\"faces\":[" to:jf
  for i=1 to msh.numfaces do (local f=getFace msh i;if i>1 do format "," to:jf;format "[%,%,%]" ((f.x as integer)-1) ((f.y as integer)-1) ((f.z as integer)-1) to:jf)
  format "]}" to:jf
 )
 format "]}" to:jf;close jf
 format "GEOMETRY=%\nTRIANGLES=%\nDIMENSIONS_CM=%\nEXTERNAL_BITMAPS=%\nSUCCESS\n" parts.count triangles (hi-lo) (getClassInstances Bitmaptexture).count to:report
) catch(format "ERROR=%\n" (getCurrentException()) to:report)
close report
)
