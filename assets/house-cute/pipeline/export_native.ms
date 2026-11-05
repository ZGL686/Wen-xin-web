(
local jf=createFile (HouseOut+"native-meshes.json")
format "{\"objects\":[" to:jf
local first=true
for n in HouseParts do (
 local msh=snapshotAsMesh n
 -- Bake the actual evaluated world-space snapshot; select the matching bounds.
 local bb=nodeGetBoundingBox n (matrix3 1)
 local aLo=[1e9,1e9,1e9];local aHi=[-1e9,-1e9,-1e9]
 local bLo=copy aLo;local bHi=copy aHi
 for i=1 to msh.numverts do (
  local a=getVert msh i;local b=a*n.objectTransform
  for j=1 to 3 do (aLo[j]=amin aLo[j] a[j];aHi[j]=amax aHi[j] a[j];bLo[j]=amin bLo[j] b[j];bHi[j]=amax bHi[j] b[j])
 )
 if distance bLo bb[1]+distance bHi bb[2]<distance aLo bb[1]+distance aHi bb[2] do (
  for i=1 to msh.numverts do setVert msh i ((getVert msh i)*n.objectTransform)
  update msh
 )
 if not first do format "," to:jf
 first=false
 format "{\"name\":\"%\",\"material\":\"%\",\"color\":[%,%,%],\"vertices\":[" n.name n.material.name (n.material.diffuse.r/255.0) (n.material.diffuse.g/255.0) (n.material.diffuse.b/255.0) to:jf
 for i=1 to msh.numverts do (local v=getVert msh i;if i>1 do format "," to:jf;format "[%,%,%]" v.x v.y v.z to:jf)
 format "],\"faces\":[" to:jf
 for i=1 to msh.numfaces do (local f=getFace msh i;if i>1 do format "," to:jf;format "[%,%,%]" ((f.x as integer)-1) ((f.y as integer)-1) ((f.z as integer)-1) to:jf)
 format "],\"cornerNormals\":[" to:jf
 for i=1 to msh.numfaces do (
  local ns=meshop.getFaceRNormals msh i
  if i>1 do format "," to:jf
  format "[[%,%,%],[%,%,%],[%,%,%]]" ns[1].x ns[1].y ns[1].z ns[2].x ns[2].y ns[2].z ns[3].x ns[3].y ns[3].z to:jf
 )
 format "]}" to:jf
)
format "]}" to:jf;close jf
)
