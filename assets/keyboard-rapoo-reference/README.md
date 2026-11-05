# 参考键盘原生建模管线

用户要求使用 **3ds Max 2026 - Simplified Chinese**。本资产在本机 3ds Max 2026.2 中原生创建、渲染、重新打开并验证。未执行 Blender。图片 `reference.png` 是用户提供的原参考，保留原始字节。

`layout.json` 记录按照片整理的 104 键位置。`build_native.py` 使用普通 Python 生成 `build_keyboard.ms`，由 3ds Max 执行；几何为独立 Editable Poly，150 个字符节点保留原生 Text + Extrude，244 个网格部件使用 Weighted Normals。生成器会根据仓库位置重新生成运行路径；执行会创建新场景，先保存自己的其他工作。

`world_mesh.ms` 对照原生世界包围盒，识别实际求值网格的坐标空间，避免文字和多边形节点在导出时重复应用变换。`export_fbx.ms` 重新打开原生场景，对求值网格副本导出 FBX 和网页几何。`verify_keyboard.ms` 独立核对 MAX 重开、104 个键帽、150 个文字节点、395 个部件、材质依赖、厘米单位和干净 FBX 导入。

`export_web.py` 依赖 NumPy，把 Max 实际求值网格转换为 GLB。坐标从厘米 Z-up 转为米 Y-up，保留部件名、几何和基础颜色，网页材质为近似。历史模型回执记载原生和 FBX 检查、GLB 尺寸、网站资源及当时的交付校验。

可编辑原件为 `assets/3d source/Keyboard_Rapoo_3dsMax2026.max`。FBX 和 GLB 位于 `assets/pipeline/`，渲染图位于 `assets/renders/keyboard/`，说明和本地验收位于 `docs/models/keyboard/`。模型尺寸和隐藏底部按单张正面照片估计，用于视觉重建。

重新执行制作配方时，生成文件先写入忽略目录 `formspace/outputs/keyboard/`，验收后再按授权更新正式文件。
