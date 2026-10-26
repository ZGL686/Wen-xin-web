# Wen-xin-web · 文心 / 树莓成熟时

数字媒体创作者的个人作品集与成长档案。保留原视觉风格，支持交互、影视、三维与其他方向、自定义标签、私密版本历史和作者选择公开。前端为 React + Vite + TypeScript，后端为 Cloudflare Worker + R2。

[打开文心网站](https://formspace-sm-3d-studio.h2969351680.chatgpt.site)。第 2 版于 2026-10-26 发布并完成线上匿名页面、三维与原件哈希验收。国内托管和登录迁移仍待完成。

## 目录

| 路径 | 用途 |
| --- | --- |
| `formspace/` | 可运行的网站源码、前后端及网页资产 |
| `assets/3d source/` | 原始 MAX 工程，保留原文件名和内容；网页四作基线由验证清单单独核对 |
| `assets/pipeline/` | 离线导出脚本、FBX/OBJ 中间文件、GLB、PNG、资产验证资料 |
| `deliverables/` | WorkBuddy 接手 ZIP 与 SHA-256；展开副本仅在本地保留 |
| `docs/workbuddy/` | 接手任务与国内迁移说明 |
| `docs/verification/` | 历史验收与本次整理基线 |
| `archive/cabinet-20261011/` | 柜子补齐过程中的来源、脚本、图片和验证资料；原始运行日志不入库 |
| `wiki_memory/` | 当前状态、决策、知识、追加式工作日志 |
| `tools/` | 项目校验、每轮同步、打包工具 |

## 克隆与运行

需要 Git LFS；推荐 Node.js 24，使用 Node 22 跑接口测试需 22.18+。完整取得二进制资产后再运行：

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

本地使用模拟登录，线上依赖平台身份。新作品与新版本默认私密，公开展示版本与过程节点由作者选择；原件下载独立控制。每次新上传合计 40 MiB，单作品最多 500 个版本。国内迁移需替换为服务端验证的登录和持久存储，详见 `docs/workbuddy/03_迁移说明.md`。

## 工程记忆与自动同步

先读 [项目概览](wiki_memory/当前状态/项目概览.md) 和 [Agent 约定](AGENTS.md)。用户已授权每次本项目内对话或修改后更新记忆并提交推送。

```powershell
pwsh -File tools/project-sync.ps1 -Summary "本轮任务" -Kind maintenance -Details "变更与验证"
```

同步工具由 Agent 每轮结束执行；遇到网络、权限或远端分歧会保留本地结果并报错，不强推。源码推送不会自动重新发布网站。

## 当前交付与历史包

本轮实现与验收见 `docs/verification/wenxin-20261026.json`，接口合同见 `formspace/shared/portfolio.ts`。历史 WorkBuddy ZIP 保持为 2026-10-25 旧版快照，不含本轮文心功能；接手新版以当前 `main` 为准。源码仓库不含远端用户作品数据库。
