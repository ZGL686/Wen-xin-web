-- Run in a fresh Max batch. Reopens the project output MAX read-only.
(
local out=(getFilenamePath (getSourceFileName()))+@"..\..\..\formspace\outputs\monitor-native\"
local report=createFile (out+"native-verification.txt")
local jsonFile=createFile (out+"native-verification.json")
try (
 local candidates=getFiles (out+"*.max")
 if candidates.count!=1 do throw "Expected exactly one MAX in the monitor output directory"
 local file=candidates[1]
 local bytes=(getFileSize file) as integer
 local binary=fopen file "rb"
 local signature=#(208,207,17,224,161,177,26,225)
 local oleSignature=true
 for i=1 to 8 do (if (readByte binary #unsigned)!=signature[i] do oleSignature=false)
 fclose binary
 local valid=isMaxFile file
 if not valid do throw "File is not recognized as a 3ds Max scene"
 resetMaxFile #noPrompt
 local loaded=loadMaxFile file quiet:true useFileUnits:true
 if not loaded do throw "loadMaxFile failed"
 local parts=for n in geometry where getUserProp n "Assembly"=="Monitor" collect n
 local otherGeometry=for n in geometry where n.layer.name!="90_Studio" and getUserProp n "Assembly"!="Monitor" collect n
 local editable=0;local tris=0;local verts=0;local missing=0;local nonStandard=0;local empty=0;local invalid=0
 local materialNames=#();local partLayers=#()
 local lo=[1e9,1e9,1e9];local hi=[-1e9,-1e9,-1e9]
 for n in parts do (
  if (classof n.baseObject)==Editable_Poly do editable+=1
  if n.material==undefined then missing+=1 else (
   if (classof n.material)!=Standardmaterial do nonStandard+=1
   if (findItem materialNames n.material.name)==0 do append materialNames n.material.name
  )
  local layerName=n.layer.name
  if (findItem partLayers layerName)==0 do append partLayers layerName
  local msh=snapshotAsMesh n
  if msh.numverts==0 or msh.numfaces==0 do empty+=1
  tris+=msh.numfaces;verts+=msh.numverts
  for i=1 to msh.numverts do (
   local v=getVert msh i
   for j=1 to 3 do (if (abs(v[j])>1e8) or (v[j]!=v[j]) do invalid+=1)
  )
  local bounds=nodeGetBoundingBox n (matrix3 1)
  if msh.numverts>0 and msh.numfaces>0 do (
   for j=1 to 3 do (lo[j]=amin lo[j] bounds[1][j];hi[j]=amax hi[j] bounds[2][j])
  )
  format "PART=% LAYER=% VERTICES=% TRIANGLES=% BOUNDS_CM=%\n" n.name layerName msh.numverts msh.numfaces bounds to:report
 )
 local required=#("Screen_Active","Front_Bezel","Back_Shell","Stand_Upright","Base_Foot")
 local componentsOK=true
 for nm in required do (
  local matched=for n in parts where n.name==nm collect n
  format "REQUIRED_PART=% COUNT=%\n" nm matched.count to:report
  if matched.count!=1 do componentsOK=false
 )
 local panel=getNodeByName "Screen_Active"
 local panelDimensions=[0,0,0]
 if panel!=undefined do (
  local bb=nodeGetBoundingBox panel (matrix3 1)
  panelDimensions=bb[2]-bb[1]
 )
 local panelDiagonal=sqrt(panelDimensions.x^2+panelDimensions.z^2)
 local panelOK=(abs(panelDimensions.x-59.77)<.25 and abs(panelDimensions.z-33.62)<.25 and abs(panelDiagonal-68.58)<.25)
 local layersOK=(partLayers.count==4 and (findItem partLayers "01_Panel")>0 and (findItem partLayers "02_Wallpaper")>0 and (findItem partLayers "03_IO")>0 and (findItem partLayers "04_Stand")>0)
 local hinge=getNodeByName "Monitor_Head_Tilt"
 local foot=getNodeByName "Base_Foot"
 local hingeOK=false
 if hinge!=undefined and panel!=undefined and foot!=undefined do (
  local originalTM=hinge.transform
  local panelBefore=panel.pos;local footBefore=foot.pos
  rotate hinge (angleaxis 10 [1,0,0])
  hingeOK=(panel.parent==hinge and distance panelBefore panel.pos>.25 and distance footBefore foot.pos<.0001)
  hinge.transform=originalTM
 )
 format "HEAD_TILT_INDEPENDENT=%\n" hingeOK to:report
 local textures=getClassInstances Bitmaptexture
 local dimensions=hi-lo
 local unitsOK=(units.SystemType==#centimeters and abs(units.SystemScale-1.0)<.0001)
 local sizeTarget=4194304
 local sizeTargetMet=(bytes<=sizeTarget)
 local passed=(valid and loaded and componentsOK and panelOK and layersOK and hingeOK and otherGeometry.count==0 and parts.count>=5 and editable==parts.count and missing==0 and nonStandard==0 and empty==0 and invalid==0 and textures.count==0 and unitsOK and tris>0)
 format "MAX_BYTES=%\nSIZE_TARGET_BYTES=%\nSIZE_TARGET_MET=%\nOLE_SIGNATURE=%\nIS_MAX_FILE=%\nREOPENED=%\nMAX_VERSION=%\nPARTS=%\nEDITABLE_POLY_PARTS=%\nTRIANGLES=%\nVERTICES=%\nMATERIALS=%\nMISSING_MATERIALS=%\nNONSTANDARD_MATERIAL_PARTS=%\nEMPTY_OBJECTS=%\nINVALID_COORDINATES=%\nEXTERNAL_BITMAP_MAPS=%\nUNMARKED_MODEL_GEOMETRY=%\nMODEL_LAYERS=%\nUNITS=%\nSYSTEM_SCALE=%\nBOUNDS_MIN_CM=%\nBOUNDS_MAX_CM=%\nDIMENSIONS_CM=%\nSCREEN_DIMENSIONS_CM=%\nSCREEN_DIAGONAL_CM=%\nALL_CHECKS_PASS=%\n" bytes sizeTarget sizeTargetMet oleSignature valid loaded (maxVersion()) parts.count editable tris verts materialNames.count missing nonStandard empty invalid textures.count otherGeometry.count partLayers units.SystemType units.SystemScale lo hi dimensions panelDimensions panelDiagonal passed to:report
 format "{\"bytes\":%,\"uploadSizeTargetBytes\":%,\"uploadSizeTargetMet\":%,\"oleSignature\":%,\"isMaxFile\":%,\"reopened\":%,\"hostYear\":%,\"parts\":%,\"editablePolyParts\":%,\"triangles\":%,\"vertices\":%,\"materials\":%,\"missingMaterials\":%,\"nonStandardMaterialParts\":%,\"emptyObjects\":%,\"invalidCoordinates\":%,\"externalBitmapMaps\":%,\"unmarkedModelGeometry\":%,\"modelLayers\":%,\"unitsPass\":%,\"systemScale\":%,\"boundsCm\":{\"min\":[%,%,%],\"max\":[%,%,%],\"dimensions\":[%,%,%]},\"screenCm\":{\"width\":%,\"height\":%,\"diagonal\":%},\"componentsPass\":%,\"layersPass\":%,\"screenPass\":%,\"allChecksPass\":%}\n" bytes sizeTarget sizeTargetMet oleSignature valid loaded ((maxVersion())[8]) parts.count editable tris verts materialNames.count missing nonStandard empty invalid textures.count otherGeometry.count partLayers.count unitsOK units.SystemScale lo.x lo.y lo.z hi.x hi.y hi.z dimensions.x dimensions.y dimensions.z panelDimensions.x panelDimensions.z panelDiagonal componentsOK layersOK panelOK passed to:jsonFile
) catch (
 format "ERROR=%\nALL_CHECKS_PASS=false\n" (getCurrentException()) to:report
 format "{\"allChecksPass\":false,\"error\":\"Native monitor inspection failed; see text report\"}\n" to:jsonFile
)
close report;close jsonFile
)
