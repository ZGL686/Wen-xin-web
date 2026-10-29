# 参考键盘原生建模管线

用户要求使用 **3ds Max 2026 - Simplified Chinese**。本资产在本机 3ds Max 2026.2 中原生创建、渲染、重新打开并验证。未执行 Blender。图片 `reference.png` 是用户提供的原参考，保留原始字节。

`layout.json` 记录按照片整理的 104 键位置。`build_native.py` 使用普通 Python 生成 `build_keyboard.ms`，由 3ds Max 执行；几何为独立 Editable Poly，150 个字符节点保留原生 Text + Extrude，244 个网格部件使用 Weighted Normals。生成器会根据仓库位置重新生成运行路径；执行会创建新场景，先保存自己的其他工作。

`world_mesh.ms` 对照原生世界包围盒，识别实际求值网格的坐标空间，避免文字/曲线和多边形节点在导出时重复应用变换。`export_fbx.ms` 在原生场景重新打开后对求值网格副本导出 FBX 和网页几何，原生文件的文字堆栈不受影响。`verify_keyboard.ms` 对 MAX 重新打开、104 键帽、150 个文字节点、395 部件、材质依赖、厘米单位和干净 FBX 导入做独立核对；两个脚本中的输出目录指向本仓库交付目录，换目录时相应调整。

`export_web.py` 依赖 NumPy，把 Max 实际求值网格打包为 GLB；不替换或重建原生场景。坐标从厘米 Z-up 转为米 Y-up，保留部件名、几何和基础颜色，网页材质为近似。`package_delivery.py` 在原生/FBX 验证成功后检查 GLB 尺寸、三个 MAX 副本、网页资产、ZIP CRC 和各文件 SHA-256，生成交付包与脱敏回执。

最终原生场景、FBX、GLB、原生渲染图、说明及回执位于 `deliverables/Keyboard_Rapoo_20261029/`；整包为 `deliverables/Keyboard_Rapoo_3dsMax2026_Package.zip`。单张正面照片不能确定实物尺寸与隐藏结构，模型尺寸和底部只作为视觉重建，不用于制造。
