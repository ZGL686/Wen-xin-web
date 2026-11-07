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

# 2026-11-07｜长序国内部署 WorkBuddy 完整交接

## 目标与范围

用户要求打包现有网站交给 WorkBuddy 部署到国内。保持长序品牌、React/Vite/TypeScript、既有风格和免账号权限。本轮整理交接与验证，没有购买资源或改动生产站点。

## 变更

- 更新 tools/packaging/ 的旧版打包器，使用当前受跟踪应用、五件内置作品和三件补充资源；原站 project_id 在复制件中移除，原配置不改。
- docs/workbuddy/current/ 提供当前提示词、部署和数据迁移说明、Nginx/systemd/环境变量示例。现有旧同名交接目录与 ZIP 保留，本轮独立验收副本使用 Changxu_WorkBuddy_China_20261107_Full。
- 补充鼠标、茶壶、显示器真实 MAX/GLB/贴图/渲染及原生验收说明。没有导出远端会话、Cookie、作者资料或私密版本；补充文件不自动公开或冒充完整数据库迁移。
- 忽略本地 .server-data，防止 Node FS 运行数据入库。应用功能、原件和线上内容未修改。

## 验证

独立副本 npm ci 成功，Node 24.20.0；TypeScript、542 项 API、生产构建、9 项 Node 后端集成及派生模型无静态泄露检查通过。配置示例未在真实 Linux/Nginx/systemd 执行；没有真实 COS、国内网络或新浏览器界面验收。

逐文件清单、LFS 实体、四件基线哈希、五件内置资源、八个 MAX 和 ZIP CRC/哈希由打包工具检查，最终实际结果见 docs/verification/workbuddy-handoff-20261107.json，包内 06_本地打包验收.json 记录运行检查。同步状态以 project-sync 最终输出为准。

## 遗留

COS 仍需真实 SDK/权限/对象体/条件写/分页/Range/错误回滚验证；Node FS/COS 按单进程单机使用。国内云资源、域名、HTTPS、数据备份、R2 显式导出导入以及旧域 Cookie 的安全作者迁移未完成。通用 MAX 云转换保持暂缓。GitHub 推送不等于国内上线。

## 待确认长期记忆

无新选型确认；部署示例为接手模板，未视为已部署事实。
