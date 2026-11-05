(
local log=createFile @"C:\Users\SM\Desktop\3d\assets\house-cute\build-status.txt"
try (
 fileIn @"C:\Users\SM\Desktop\3d\assets\house-cute\pipeline\build_house.ms"
 format "BUILD_RENDER_OK\n" to:log
 fileIn @"C:\Users\SM\Desktop\3d\assets\house-cute\pipeline\verify_native.ms"
) catch (format "ERROR: %\n" (getCurrentException()) to:log)
close log
)
