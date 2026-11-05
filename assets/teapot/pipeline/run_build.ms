(
local out=@"C:\Users\SM\Desktop\3d\formspace\outputs\teapot-native\"
makeDir out all:true
local log=createFile (out+"build-status.txt")
try (
 fileIn (out+"build_teapot.ms")
 format "BUILD_RENDER_OK\n" to:log
) catch (format "ERROR: %\n" (getCurrentException()) to:log)
close log
)
