(
local log=createFile @"C:\Users\SM\Desktop\3d\assets\house-cute\original-inspection.txt"
try (
 local src=@"C:\Users\SM\Desktop\3d\assets\3d source\房子3d.max"
 local ok=loadMaxFile src quiet:true useFileUnits:true
 format "REOPENED=%\nMAX_VERSION=%\nUNITS=%\nGEOMETRY=%\n" ok (maxVersion()) units.SystemType geometry.count to:log
 for n in geometry do format "PART=% CLASS=% BOUNDS=%\n" n.name (classof n.baseObject) (nodeGetBoundingBox n (matrix3 1)) to:log
) catch (format "ERROR=%\n" (getCurrentException()) to:log)
close log
)
