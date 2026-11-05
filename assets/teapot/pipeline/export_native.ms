(
local jf=createFile @"C:\Users\SM\Desktop\3d\assets\teapot\native-meshes.json"
format "{\"objects\":[" to:jf
local first=true
for n in TeaParts do (
 local msh=snapshotAsMesh n
 if not first do format "," to:jf
 first=false
 format "{\"name\":\"%\",\"material\":\"%\",\"color\":[%,%,%],\"vertices\":[" n.name n.material.name (n.material.diffuse.r/255.0) (n.material.diffuse.g/255.0) (n.material.diffuse.b/255.0) to:jf
 for i=1 to msh.numverts do (local v=getVert msh i;if i>1 do format "," to:jf;format "[%,%,%]" v.x v.y v.z to:jf)
 format "],\"faces\":[" to:jf
 for i=1 to msh.numfaces do (local f=getFace msh i;if i>1 do format "," to:jf;format "[%,%,%]" ((f.x as integer)-1) ((f.y as integer)-1) ((f.z as integer)-1) to:jf)
 format "],\"uv\":[" to:jf
 for i=1 to (getNumTVerts msh) do (local v=getTVert msh i;if i>1 do format "," to:jf;format "[%,%]" v.x v.y to:jf)
 format "],\"uvFaces\":[" to:jf
 for i=1 to msh.numfaces do (local f=getTVFace msh i;if i>1 do format "," to:jf;format "[%,%,%]" ((f.x as integer)-1) ((f.y as integer)-1) ((f.z as integer)-1) to:jf)
 format "]}" to:jf
)
format "]}" to:jf;close jf
)
