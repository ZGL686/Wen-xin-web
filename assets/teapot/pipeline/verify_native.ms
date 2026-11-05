(
local out=@"C:\Users\SM\Desktop\3d\formspace\outputs\teapot-native\"
local log=createFile (out+"native-verification.txt")
try (
 resetMaxFile #noPrompt
 local valid=isMaxFile (out+"3d.max")
 local loaded=loadMaxFile (out+"3d.max") quiet:true useFileUnits:true
 local parts=for n in geometry where getUserProp n "Assembly" == "Porcelain_Teapot" collect n
 local editable=0;local tris=0;local missing=0
 local lo=[1e9,1e9,1e9];local hi=[-1e9,-1e9,-1e9]
 for n in parts do (
  if classof n.baseObject==Editable_Poly do editable+=1
  if n.material==undefined do missing+=1
  tris+=(snapshotAsMesh n).numfaces
  local b=nodeGetBoundingBox n (matrix3 1)
  for j=1 to 3 do (lo[j]=amin lo[j] b[1][j];hi[j]=amax hi[j] b[2][j])
 )
 local tex=getClassInstances Bitmaptexture
 local texturesPresent=true
 for m in tex do (if not doesFileExist m.filename do texturesPresent=false)
 local dims=hi-lo
 local ok=(valid and loaded and parts.count==13 and editable==13 and missing==0 and texturesPresent and tex.count>=1 and units.SystemType==#centimeters and tris==106224 and abs(dims.x-31.8128)<.05 and abs(dims.z-21.1995)<.05)
 format "IS_MAX_FILE=%\nREOPENED=%\nMAX_VERSION=%\nEDITABLE_POLY_PARTS=%\nPARTS=%\nTRIANGLES=%\nMISSING_MATERIALS=%\nTEXTURES_PRESENT=%\nTEXTURE_MAPS=%\nUNITS=%\nDIMENSIONS_CM=%\nALL_CHECKS_PASS=%\n" valid loaded (maxVersion()) editable parts.count tris missing texturesPresent tex.count units.SystemType dims ok to:log
) catch (format "ERROR: %\n" (getCurrentException()) to:log)
close log
)
