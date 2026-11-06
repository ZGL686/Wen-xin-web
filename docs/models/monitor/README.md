# 27 英寸桌面显示器

- 原件：[Monitor_27_3dsMax2026.max](<../../../assets/3d source/Monitor_27_3dsMax2026.max>)，直接用 3ds Max 2026 打开。
- 预览：[Monitor_27.glb](../../../assets/pipeline/Monitor_27.glb)；[正面](../../../assets/renders/monitor/Monitor_Front.png)、[背面](../../../assets/renders/monitor/Monitor_Rear.png)。
- 厘米为场景单位。有效屏幕为约 59.77 × 33.62 cm，16:9；正面朝 −Y。

在图层管理器内展开 `01_Panel`、`03_IO` 和 `04_Stand`，可分别编辑面板、机身、接口和支架。选中 `Monitor_Head_Tilt` 并绕本地 X 轴旋转可调屏幕倾角；固定支架和底座不随之转动。隐藏 `02_Wallpaper` 可去掉几何壁纸，保留独立的 `Screen_Active` 屏幕，方便换材质。灯光、相机和背景地面在 `90_Studio`，制作其他场景时可整层隐藏。

外观为原创通用桌面显示器，接口是可编辑的外观细节。MAX 中没有外部贴图。GLB 从同一份原生模型的实际网格导出，保留材质基础色和面角法线，使用米和 Y-up，排除影棚与相机。

本地验收：[原生重开](native-verification.json)、[GLB 校验](glb-verification.json)。线上展示：[长序作品](https://formspace-sm-3d-studio.h2969351680.chatgpt.site/#/work/04e21be9-8843-4993-9d40-52d3754e0554)；[网站回执](../../verification/monitor-site-20261106.json)。

建模脚本在 `tools/modeling/monitor/`；3ds Max 2026.2 批处理执行 `build-monitor.ms`，随后运行 `export_monitor.py` 及独立的 `verify-monitor.ms`。生成物先写入忽略的 `formspace/outputs/monitor-native/`。未引入第三方网格、贴图或字体。制作前检查了 DCC-MCP [Core 生产复用规范](https://github.com/dcc-mcp/dcc-mcp-core/blob/main/crates/dcc-mcp-gateway/src/gateway/native_resources/agent_workflows.md#production-reuse-gate)及模板目录（仅有 Godot 候选）；没有已注册的 3ds Max 实例，DCC 市场查询受网络限制。Autodesk 插件商店与 Khronos 样例没有找到适合原生交付的部件模板，因此沿用仓库内已有的原生网格导出器和 GLB 打包器，使用本机 Autodesk 批处理制作。
