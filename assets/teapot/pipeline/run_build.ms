(
local log=createFile @"C:\Users\SM\Desktop\3d\assets\teapot\build-status.txt"
try (
 fileIn @"C:\Users\SM\Desktop\3d\assets\teapot\pipeline\build_teapot.ms"
 format "BUILD_RENDER_OK\n" to:log
) catch (format "ERROR: %\n" (getCurrentException()) to:log)
close log
)
