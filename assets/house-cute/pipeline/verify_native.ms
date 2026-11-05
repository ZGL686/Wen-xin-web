-- Independent native reopen of the delivered house; never repairs the scene.
(
local out=@"C:\Users\SM\Desktop\3d\deliverables\Cute_House_2026\"
local report=createFile (out+"native-verification.txt")
local jsonFile=createFile (out+"native-verification.json")
try (
 local file=out+"3d.max"
 local binary=fopen file "rb"
 local signature=#(208,207,17,224,161,177,26,225)
 local signatureOK=true
 for i=1 to 8 do (if (readByte binary #unsigned)!=signature[i] do signatureOK=false)
 fclose binary
 local valid=isMaxFile file
 resetMaxFile #noPrompt
 local loaded=loadMaxFile file quiet:true useFileUnits:true
 local parts=for n in geometry where getUserProp n "Assembly"=="Berry_Cottage" collect n
 local editable=0;local tris=0;local verts=0;local missing=0;local empty=0;local invalid=0
 local roof=0;local joinery=0;local garden=0
 local materialNames=#();local partLayers=#()
 local lo=[1e9,1e9,1e9];local hi=[-1e9,-1e9,-1e9]
 for n in parts do (
  if (classof n.baseObject)==Editable_Poly do editable+=1
  if n.material==undefined then missing+=1 else (
   if (findItem materialNames n.material.name)==0 do append materialNames n.material.name
  )
  local layerName=n.layer.name
  if (findItem partLayers layerName)==0 do append partLayers layerName
  if layerName=="02_ROOF" do roof+=1
  if layerName=="03_DOORS_WINDOWS" do joinery+=1
  if layerName=="05_GARDEN" do garden+=1
  local msh=snapshotAsMesh n
  if msh.numverts==0 or msh.numfaces==0 do empty+=1
  tris+=msh.numfaces;verts+=msh.numverts
  for i=1 to msh.numverts do (
   local v=getVert msh i
   for j=1 to 3 do (if (abs(v[j])>1e8) or (v[j]!=v[j]) do invalid+=1)
  )
  if msh.numverts>0 and msh.numfaces>0 do (
   local bounds=nodeGetBoundingBox n (matrix3 1)
   for j=1 to 3 do (lo[j]=amin lo[j] bounds[1][j];hi[j]=amax hi[j] bounds[2][j])
  )
  format "PART=% LAYER=% VERTICES=% TRIANGLES=% BOUNDS=%\n" n.name layerName msh.numverts msh.numfaces (nodeGetBoundingBox n (matrix3 1)) to:report
 )
 local textures=getClassInstances Bitmaptexture
 local dimensions=hi-lo
 local unitsOK=(units.SystemType==#centimeters and abs(units.SystemScale-1.0)<.0001)
 local boundsOK=(abs(dimensions.x-100)<.3 and abs(dimensions.y-115)<.3 and abs(dimensions.z-60.4)<.3)
 local categoriesOK=(roof>50 and joinery>20 and garden>30 and partLayers.count>=6)
 local passed=(signatureOK and valid and loaded and parts.count>250 and editable==parts.count and missing==0 and empty==0 and invalid==0 and textures.count==0 and unitsOK and boundsOK and categoriesOK and tris>10000)
 format "OLE_SIGNATURE=%\nIS_MAX_FILE=%\nREOPENED=%\nMAX_VERSION=%\nPARTS=%\nEDITABLE_POLY_PARTS=%\nTRIANGLES=%\nVERTICES=%\nMATERIALS=%\nMISSING_MATERIALS=%\nEMPTY_OBJECTS=%\nINVALID_COORDINATES=%\nEXTERNAL_BITMAP_MAPS=%\nPART_LAYERS=%\nROOF_PARTS=%\nDOOR_WINDOW_PARTS=%\nGARDEN_PARTS=%\nUNITS=%\nSYSTEM_SCALE=%\nBOUNDS_MIN_CM=%\nBOUNDS_MAX_CM=%\nDIMENSIONS_CM=%\nALL_CHECKS_PASS=%\n" signatureOK valid loaded (maxVersion()) parts.count editable tris verts materialNames.count missing empty invalid textures.count partLayers.count roof joinery garden units.SystemType units.SystemScale lo hi dimensions passed to:report
 format "{\"oleSignature\":%,\"isMaxFile\":%,\"reopened\":%,\"hostYear\":%,\"parts\":%,\"editablePolyParts\":%,\"triangles\":%,\"vertices\":%,\"materials\":%,\"missingMaterials\":%,\"emptyObjects\":%,\"invalidCoordinates\":%,\"externalBitmapMaps\":%,\"partLayers\":%,\"roofParts\":%,\"doorWindowParts\":%,\"gardenParts\":%,\"units\":\"centimeters\",\"systemScale\":%,\"bounds\":{\"min\":[%,%,%],\"max\":[%,%,%],\"dimensions\":[%,%,%]},\"unitsPass\":%,\"boundsPass\":%,\"categoriesPass\":%,\"allChecksPass\":%}\n" signatureOK valid loaded ((maxVersion())[8]) parts.count editable tris verts materialNames.count missing empty invalid textures.count partLayers.count roof joinery garden units.SystemScale lo.x lo.y lo.z hi.x hi.y hi.z dimensions.x dimensions.y dimensions.z unitsOK boundsOK categoriesOK passed to:jsonFile
) catch (
 format "ERROR=%\nALL_CHECKS_PASS=false\n" (getCurrentException()) to:report
 format "{\"allChecksPass\":false,\"error\":\"Native inspection failed; see text report\"}\n" to:jsonFile
)
close report;close jsonFile
)
