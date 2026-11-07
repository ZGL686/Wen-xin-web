---
type: log
status: archived
kind: maintenance
importance: high
updated: 2026-11-07
topic: workbuddy-china-handoff-20261107
source_logs: []
supersedes: null
---

# WorkBuddy 国内部署交接包

## 目标与确认

用户要求打包当前项目，交给 WorkBuddy 制作为国内服务的网站。范围为完整源码、真实作品文件和国内迁移交接材料；本轮不购买云资源、不发布国内站点、不导出远端私密数据。

## 变更

- 更新 tools/packaging，使用当前品牌和浏览器空间权限；保留历史包，按当前五件系统作品校验，不再固定四件。独立检查回执作为 finalize 门禁，ZIP 校验清单完整性、CRC、字节和 LFS 实体。
- docs/workbuddy/current/ 提供接手任务、Node/FS/COS 状态、环境变量、数据/作者迁移边界、资源范围和未实机运行的 Nginx/systemd 示例。
- 交付 deliverables/Changxu_WorkBuddy_China_20261107.zip 与 SHA-256；包含完整应用、五件内置作品、鼠标/茶壶/显示器补充文件与工程摘要，共 206 文件、8 个 MAX。
- 根 .gitignore 排除 .server-data 运行数据，交付副本移除现站 project_id。线上 R2 会话、记录、版本、文件及 Cookie 不在包中。

## 验证

独立源码副本 npm ci、类型检查、542 API 检查、生产构建、9 Node 集成检查、衍生模型构建保护均通过。应用复制文件除 hosting 身份及补充忽略项外，逐字节与当前已跟踪源码一致。四件基线 MAX/GLB 与 verification.json 一致，所有五件资源均存在。ZIP 206 文件 CRC 和 205 项清单哈希通过。默认 Python 过旧，最终 ZIP 使用已安装 Python 3.12.14 生成和验收。详情 docs/verification/workbuddy-handoff-20261107.json。

## 结果与遗留

源码基线 71e248357550b01b4fa741499bde1c873e0a6401。真实 COS、国内服务器、正式 HTTPS 代理、改域名作者授权及线上数据迁移未完成；本轮未重复浏览器 UI 验收或发布原站。已有 Node 适配为本地已测候选，进程内条件锁不保证跨实例原子性。同步提交/推送由 project-sync.ps1 另行验证，不将压缩成功称为国内上线。

## 待确认长期记忆

无新选型；用户交接要求与实测事实已更新相关当前状态和迁移知识页。
