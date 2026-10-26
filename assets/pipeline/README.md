# 离线资产资料

这里保留 2026-10-25 从四个原始 MAX 生成的 OBJ/FBX、中间材质、GLB、PNG 与验证记录。原件位于 `../source/`，网页实际资源位于 `../../formspace/public/`。

路径已改为相对脚本位置，便于在其他机器检查。离线转换需要原生 3ds Max / Blender，日常网站运行和构建无需这些软件。此轮只调整路径并检查脚本语法，没有重新导出或修改已验收的几何。

- `export_models.ms`：原生读取并导出几何/FBX；只读 MAX，派生文件写到本目录。
- `build_previews.py`：早期 OBJ 路径的预览生成过程。灯和沙发的最终版本经原生 FBX 修正，不要直接用早期整批 OBJ 结果覆盖最终资产。
- `fix_lamp.py`、`fix_sofa.py`：保留最终 FBX 修正过程。
- `verify_assets.py`、`assets.json`、`source-hashes.json`：资产尺寸、真实几何和原件哈希记录。

重新导出属于独立任务，应先备份派生文件并逐件原生/视觉验收；不能因移动目录而声称重新完成了原生模型验证。
