# 离线资产资料

这里保存离线转换脚本、导出模型和转换记录。原生 MAX 位于 `../3d source/`，渲染图按作品放在 `../renders/`，网页实际资源位于 `../../formspace/public/`。

2026-11-05 用户明确授权将房子重建为「莓糖小屋」。`house.glb`、`../renders/house/House_Hero.png` 与 house 验证条目对应新版原生 Max 场景，制作配方在 `../house-cute/pipeline/`。旧房子的 MAX、OBJ/FBX/MTL、预览及旧验证资料在 `../../archive/house-before-cute-20261105/`。旧批量脚本用于追溯历史导出，重建房子使用新版制作配方。

路径已改为相对脚本位置，便于在其他机器检查。离线转换需要原生 3ds Max / Blender，日常网站运行和构建无需这些软件。此轮只调整路径并检查脚本语法，没有重新导出或修改已验收的几何。

- `export_models.ms`：原生读取并导出几何/FBX；只读 MAX，派生文件写到本目录。
- `build_previews.py`：早期 OBJ 路径的预览生成过程。灯和沙发的最终版本经原生 FBX 修正，不要直接用早期整批 OBJ 结果覆盖最终资产。
- `fix_lamp.py`、`fix_sofa.py`：保留最终 FBX 修正过程。
- `assets.json`、`source-hashes.json`：资产尺寸、真实几何和原件哈希记录。当前检查使用根目录的 `node tools/verify-project.mjs`，旧批量报表脚本已退役。

旧批量脚本按历史路径写输出，应在历史副本中运行。重新导出属于独立任务，须逐件核对原生场景与显示效果。
