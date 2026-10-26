# Wen-xin-web · 形间 FORM / SPACE

三维作品展示与上传网站，以及配套的资产、交付物和工程 Wiki。前端为 React + Vite + TypeScript，Three.js 预览真实模型；现有后端为 Cloudflare Worker + R2。

原站参考：[打开形间展厅](https://formspace-sm-3d-studio.h2969351680.chatgpt.site)。线上页面与下载于 2026-10-25 验证；此处不将旧验收当作实时监控结果。国内部署迁移仍待完成。

## 目录

| 路径 | 用途 |
| --- | --- |
| `formspace/` | 可运行的网站源码、前后端及网页资产 |
| `assets/source/` | 四个原始 MAX 工程，保留原文件名和内容 |
| `assets/pipeline/` | 离线导出脚本、FBX/OBJ 中间文件、GLB、PNG、资产验证资料 |
| `deliverables/` | WorkBuddy 接手 ZIP 与 SHA-256；展开副本仅在本地保留 |
| `docs/workbuddy/` | 接手任务与国内迁移说明 |
| `docs/verification/` | 历史验收与本次整理基线 |
| `archive/cabinet-20261011/` | 柜子补齐过程中的来源、脚本、图片和验证资料；原始运行日志不入库 |
| `wiki_memory/` | 当前状态、决策、知识、追加式工作日志 |
| `tools/` | 项目校验、每轮同步、打包工具 |

## 克隆与运行

需要 Git LFS 和 Node.js 22.13+。完整取得二进制资产后再运行：

```sh
git clone https://github.com/ZGL686/Wen-xin-web.git
cd Wen-xin-web
git lfs pull
cd formspace
npm ci
npm run dev
```

```sh
npm run typecheck
npm test
npm run build
```

模型/图片上传的原版开发环境使用本机模拟登录，线上依赖平台身份。国内迁移需替换为服务端验证的登录和持久存储，详见 `docs/workbuddy/03_迁移说明.md`。

## 工程记忆与自动同步

先读 [项目概览](wiki_memory/当前状态/项目概览.md) 和 [Agent 约定](AGENTS.md)。用户已授权每次本项目内对话或修改后更新记忆并提交推送。

```powershell
pwsh -File tools/project-sync.ps1 -Summary "本轮任务" -Kind maintenance -Details "变更与验证"
```

同步工具由 Agent 每轮结束执行；遇到网络、权限或远端分歧会保留本地结果并报错，不强推。源码推送不会自动重新发布网站。
