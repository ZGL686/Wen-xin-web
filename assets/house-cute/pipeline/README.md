# 莓糖小屋原生制作与验证

用户于 2026-11-05 明确要求重新建模 `assets/3d source/房子3d.max`，采用卡通可爱风，替换对应旧文件及长序既有房子作品，并交付可继续修改的 MAX、上传到个人作品。本次替换是用户对该房子明确授权的特例，其余作品原件不改。旧版已单独保存在 `archive/house-before-cute-20261105/`。

设计延续原房子的交叉坡屋顶轮廓，采用奶油墙体、草莓色圆润瓦片、鼠尾草绿门窗、薰衣草色门及小庭院。场景按厘米制作，原生检查尺寸为 100 × 115 × 60.375 厘米的玩具式展示模型，不是工程施工模型。建筑、屋顶、门窗、地台路径、庭院及小摆件分六层，摄影棚辅助对象另层；330 个设计部件均为独立 Editable Poly，19 种纯色材质，无下载的第三方模型或外置贴图。

## 生产复用调查（2026-11-05）

- 已获取官方 Core 工作流的 `Production reuse gate`，任务本地副本经 `check_production_guide.py` 检查，契约为 `dcc-mcp-production-reuse/v1`。来源：https://github.com/dcc-mcp/dcc-mcp-core/blob/main/crates/dcc-mcp-gateway/src/gateway/native_resources/agent_workflows.md 。
- 已安装 CLI 运行版本为 0.20.53，当前 `live_instances=0`；没有可调用的实时 Max MCP 实例，未安装或升级适配器，也不将发现/安装计划称为场景验收。实际采用项目已使用的 3ds Max 2026 原生 `3dsmaxbatch.exe` 执行、渲染和重新打开验证。
- 本地模板目录仅有 Godot 候选，不匹配 Max 房子交付。项目现有房子是用户指定的起点，保留交叉坡屋顶的识别特征；复用项目既有原生求值与 GLB 打包方法。
- DCC marketplace 限定 `3dsmax`、查询 `house` 的候选包括 NASA、itch.io、Poly Pizza 等资源入口；需要额外 API 或没有核实匹配本房子的模型。mesh-ops 是通用能力且当前没有可调用实例。没有采用或下载这些资产，不将搜索命中视为可用性或许可证明。
- Autodesk 官方市场 FAST HOUSING 2.1.2 偏城市背景建筑，列出的支持截至 Max 2025；本次未证实 2026 兼容性及源资产再分发许可，不采用。官方来源：https://apps.autodesk.com/3DSMAX/en/Detail/HelpDoc?appId=8782235563539907953&appLang=en&os=Win64 。
- 内置 ChamferBox、Sphere、Cylinder、Editable Poly、目标相机和 Scanline 是适合本次圆润纯色风格的成熟接口，仅补充拱形和山墙等必要几何。ChamferBox API：https://help.autodesk.com/cloudhelp/2017/ENU/MAXScript-Help/files/GUID-62783832-81E3-4150-A977-7FC984411384.htm 。
- 没有购买、安装第三方插件或引入未知许可的模型、纹理、字体。最终视觉与文件验收以本轮真实 Max 渲染、重新打开检查及网站回执为准。

## 文件与运行

- `build_house.ms` 在 Max 内创建部件、材质、相机和灯光，保存房子场景并渲染两个角度。
- `export_native.ms`：从实际求值场景导出世界坐标顶点、三角面、颜色与每面三角法线，摄影棚不进入网页模型。
- `export_glb.py`：复用项目已有 GLB 格式布局，使用标准库打包为自包含 `House.glb`，保留原生法线并转换厘米 Z-up 到米 Y-up；`--self-test` 检查法线转换、硬边、退化面、边界、头和无效索引。
- `verify_native.ms` 独立从磁盘重新打开 MAX，统计可编辑部件、类别、材质、外置贴图、单位、顶点及边界，生成原生验证回执。

可编辑原件为 `assets/3d source/房子3d.max`，最终导出模型为 `assets/pipeline/house.glb`。两张完整渲染位于 `assets/renders/house/`，模型说明、原生检查和历史交付回执位于 `docs/models/house/`。

重新执行制作配方时，生成文件先写入忽略目录 `formspace/outputs/house-native/`，验收后再按授权更新正式文件。

中间网格 JSON、批处理输出、工作流副本属于制作中间件；不作为交付模型，不应误上传到个人作品或公开源码。场景重新打开与渲染验证通过后才替换网站资源、更新基线哈希。网页 GLB 与 Max 材质/渲染器不同，不承诺像素一致；单件离线转换不等于通用 MAX 云转换已部署。

原生验收重新打开了 330 个部件和 98,280 个三角面，材质和几何检查通过。GLB 含 330 个部件与原生面角法线，98,218 个三角面，导出时跳过了 62 个退化面。文件为 2,657,096 字节，自包含。两张最终 PNG 均为真实 Max 渲染的 1600×1400 图。历史交付包已通过 CRC 和逐文件 SHA 检查。线上发布与个人上传分别有验收回执。
