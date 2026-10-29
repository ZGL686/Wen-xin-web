-- Independent native reopen, editable structure and clean FBX import audit.
(
local dir=@"C:\Users\SM\Desktop\3d\deliverables\Keyboard_Rapoo_20261029\"
local report=createFile (dir+"verification.txt")
fn boundsOf nodes = (
 local lo=[1e9,1e9,1e9]; local hi=[-1e9,-1e9,-1e9]
 for n in nodes do (local b=nodeGetBoundingBox n (matrix3 1); for j=1 to 3 do (lo[j]=amin lo[j] b[1][j];hi[j]=amax hi[j] b[2][j]))
 hi-lo
)
fn dimsClose a b = (abs(a.x-b.x)<0.03 and abs(a.y-b.y)<0.03 and abs(a.z-b.z)<0.03)
try (
 local target=dir+"Keyboard_Rapoo_3dsMax2026.max"
 local valid=isMaxFile target
 resetMaxFile #noPrompt
 local loaded=loadMaxFile target quiet:true useFileUnits:true
 format "IS_MAX_FILE=%\nNATIVE_LOAD=%\nMAX_VERSION=%\nSYSTEM_UNITS=%\nSYSTEM_SCALE=%\n" valid loaded (maxVersion()) units.SystemType units.SystemScale to:report
 local parts=for n in objects where (getUserProp n "Assembly")!=undefined collect n
 local caps=for n in parts where matchPattern n.name pattern:"Cap_*" collect n
 local capEditable=0; local liveText=0;local weighted=0;local missing=0;local extruded=0
 for n in parts do (
  if classof n.baseObject==Text do liveText+=1
  if n.material==undefined do missing+=1
  for md in n.modifiers do (if classof md==Weighted_Normals do weighted+=1; if classof md==Extrude do extruded+=1)
 )
 for n in caps where classof n.baseObject==Editable_Poly do capEditable+=1
 local nativeDims=boundsOf parts
 local bitmaps=(getClassInstances Bitmaptexture).count
 local success=(valid and loaded and caps.count==104 and capEditable==104 and liveText>=115 and extruded==liveText and weighted==244 and missing==0 and bitmaps==0 and units.SystemType==#centimeters and units.SystemScale==1.0 and abs(nativeDims.x-38.8)<.03 and abs(nativeDims.y-12.38)<.03)
 format "NATIVE_PARTS=%\nKEYCAPS=%\nEDITABLE_POLY_KEYCAPS=%\nLIVE_TEXT_NODES=%\nEXTRUDED_TEXT=%\nWEIGHTED_NORMALS=%\nMISSING_MATERIALS=%\nEXTERNAL_BITMAPS=%\nDIMENSIONS_CM=%\nNATIVE_CHECK_PASS=%\n" parts.count caps.count capEditable liveText extruded weighted missing bitmaps nativeDims success to:report
 flush report
 local count=parts.count
 resetMaxFile #noPrompt
 units.SystemType=#centimeters;units.SystemScale=1.0
 pluginManager.loadClass FBXIMP
 local imported=importFile (dir+"Keyboard_Rapoo.fbx") #noPrompt using:FBXIMP
 local fbxparts=for n in geometry where ((snapshotAsMesh n).numfaces>0) collect n
 local fbxDims=boundsOf fbxparts
 local fbxPass=(imported and fbxparts.count==count and dimsClose fbxDims nativeDims)
 format "FBX_IMPORT=%\nFBX_GEOMETRY=%\nFBX_DIMENSIONS_CM=%\nFBX_CHECK_PASS=%\nALL_CHECKS_PASS=%\nVERIFICATION_FINISHED\n" imported fbxparts.count fbxDims fbxPass (success and fbxPass) to:report
) catch (format "ERROR=%\n" (getCurrentException()) to:report)
close report
)
