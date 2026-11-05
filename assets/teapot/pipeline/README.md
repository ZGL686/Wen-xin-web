# 青花瓷壶原生制作流程

本目录为本次用户单视图参考的自定义比例重建，不使用标准 Utah Teapot 冒充参考造型。所有模型几何由本机 3ds Max 2026.2 真实执行 MAXScript 创建；渲染与重新打开验证也在 Max 里完成，没有使用 Blender 或把其他格式改名为 MAX。

从仓库根目录运行 `generate_scene.py`（本机 Max Python 3.11.12 可用）生成忽略的 `build_teapot.ms`，再由 `3dsmaxbatch.exe` 执行 `run_build.ms`。这是本项目路径绑定的制作配方，修改路径或参数后应重新渲染验证。`verify_native.ms` 从磁盘重新打开 `3d.max`，检查13个Editable Poly部件、材质、贴图、单位和尺寸，并整理交付贴图引用。

`export_native.ms` 在 Max 内对实际保存场景求值并导出顶点、三角形和UV；忽略的 `native-meshes.json` 只是中间数据。`export_glb.py` 使用Python标准库打包这些实际网格，进行厘米Z-up至米Y-up转换、法线和UV处理，嵌入牡丹PNG并输出自包含GLB及检查回执。网页PBR与Max标准材质不同，不保证像素级渲染一致。

## 生产复用调查（2026-11-05）

- 已读取官方 Core 工作流的 Production reuse gate，下载到任务中间文件并运行 `check_production_guide.py`，契约 `dcc-mcp-production-reuse/v1` 检查通过。来源：https://github.com/dcc-mcp/dcc-mcp-core/blob/main/crates/dcc-mcp-gateway/src/gateway/native_resources/agent_workflows.md 。
- 本机 CLI 0.20.53 可用。启动已安装Max后DCC-MCP注册仍为零；未安装/升级适配器、未伪称通过实时MCP调用。实际采用已验证过的原生Max批处理路径，最终真实宿主验证以交付的 `native-verification.txt` 为准。
- 本地模板目录只有Godot平台游戏模板，不适用于Max茶壶。Autodesk原生Teapot是Utah茶壶，与参考中的球腹、曲嘴、椭圆把手及葱头壶钮不同，故不直接复用该成品形状。官方说明：https://download.autodesk.com/us/3dsmax/2012help/files/GUID-72B0B5B6-8D56-4DD9-BB3E-7DB87D430C4-176.htm 。
- Marketplace查询 `teapot` 返回asset-source样例、MaterialX、Tripo、mesh-ops等通用候选，无经核实适配本参考的现成茶壶资产；样例路径不是生产模型，Tripo需要额外密钥/服务，MaterialX和通用配方不补足该几何。未安装或购买任何候选。Autodesk官方插件市场限定检索也未得到可核实适用的资产，不把未确认许可的搜索结果导入交付。
- 选择内置mesh、Editable Poly、标准材质、目标相机和Scanline渲染等成熟接口，补充参考特有的轮廓/管体与UV。旧键盘导出管线只含颜色，会丢失青花纹样，因此本次导出器明确增加UV与嵌入贴图。
- 花纹为image_gen新生成的白底青花牡丹贴图，实际1254×1254，不是参考图去水印。完整来源和提示词见上级目录。无下载或打包第三方现成模型、付费资产或不明授权纹理。

13个部件包括空心壶身、足圈、独立壶盖、壶钮、壶钮尖、空心壶嘴、把手及朱线。估计整体31.8×18.5×21.2厘米；单视图背面与尺寸为补全，不是工程测绘或制造/液体流动验证。
