(
local out=@"C:\Users\SM\Desktop\3d\formspace\outputs\house-native\"
makeDir out all:true
local log=createFile (out+"build-status.txt")
try (
 fileIn @"C:\Users\SM\Desktop\3d\assets\house-cute\pipeline\build_house.ms"
 format "BUILD_RENDER_OK\n" to:log
 fileIn @"C:\Users\SM\Desktop\3d\assets\house-cute\pipeline\verify_native.ms"
) catch (format "ERROR: %\n" (getCurrentException()) to:log)
close log
)
