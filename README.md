# Wen-xin-web · 长序 / 树莓成熟时

数字媒体创作者的个人作品集与成长档案。保留原视觉风格，支持交互、影视、三维与其他方向、自定义标签、私密版本历史和作者选择公开。前端为 React + Vite + TypeScript，后端为 Cloudflare Worker + R2。

[打开长序网站](https://formspace-sm-3d-studio.h2969351680.chatgpt.site)。第 4 版于 2026-10-26 发布，保留免账号空间并开放不限后缀原件归档；40 MiB 新增文件合计上限仍在。自动 MAX 预览的独立云端服务尚未接入，部署方案见 [云端转换方案](docs/cloud-conversion-plan.md)。国内托管迁移仍待完成。

## 目录

| 路径 | 用途 |
| --- | --- |
| `formspace/` | 可运行的网站源码、前后端及网页资产 |
| `assets/3d source/` | 可直接打开的 MAX 原件及配套贴图 |
| `assets/pipeline/` | 离线导出脚本、FBX、OBJ、GLB 和转换记录 |
| `assets/renders/` | 按作品归类的原生渲染图 |
| `docs/models/` | 模型使用说明与本地验收记录 |
| `docs/workbuddy/` | 历史接手任务与国内迁移说明 |
| `docs/verification/` | 网站和历次交付的验收回执 |
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

无需注册登录，打开后按当前浏览器准备独立创作空间；文件与历史仍在服务端。清除 Cookie 或换浏览器无法自动恢复原空间。旧账号私密记录原样保留但不自动迁入新空间。新作品与新版本默认私密，公开展示版本与过程节点由作者选择；原件下载独立控制。每次新上传合计 40 MiB，单作品最多 500 个版本。国内迁移需适配 HTTPS 浏览器凭据校验与目标持久存储，详见 `docs/workbuddy/03_迁移说明.md`。

## 工程记忆与自动同步

先读 [项目概览](wiki_memory/当前状态/项目概览.md) 和 [Agent 约定](AGENTS.md)。用户已授权每次本项目内对话或修改后更新记忆并提交推送。

```powershell
pwsh -File tools/project-sync.ps1 -Summary "本轮任务" -Kind maintenance -Details "变更与验证"
```

同步工具由 Agent 每轮结束执行；遇到网络、权限或远端分歧会保留本地结果并报错，不强推。源码推送不会自动重新发布网站。

## 当前作品文件

2026-11-02 已发布多格式三维查看器：左键旋转、右键平移、平滑缩放、双击聚焦、居中/复位、全屏和触屏；支持 GLB/glTF/OBJ/STL/FBX/STEP/STP 与模型资源 ZIP。复位不重复请求模型，预览无需主动下载或安装软件。采用 Three.js、camera-controls 与 OCCT Worker，原界面与私密权限保留。507 项接口、45 项本地与 30 项线上浏览器检查通过；回执 `docs/verification/model-viewer-20261102.json`，工程说明见 `wiki_memory/知识/模块/浏览器三维查看器.md`。

- 莓糖小屋使用 [房子3d.max](<assets/3d source/房子3d.max>)，渲染图位于 [house](assets/renders/house/)。
- RAPOO 键盘使用 [Keyboard_Rapoo_3dsMax2026.max](<assets/3d source/Keyboard_Rapoo_3dsMax2026.max>)，FBX 和 GLB 位于 [转换目录](assets/pipeline/)，渲染图位于 [keyboard](assets/renders/keyboard/)。
- 青花瓷壶的 MAX 与牡丹贴图放在同一个 [茶壶源文件夹](<assets/3d source/Porcelain_Teapot_2026/>)，渲染图位于 [teapot](assets/renders/teapot/)。

模型按原格式直接交付。使用说明和原生检查见 [模型资料](docs/models/)。历史回执中的路径记录了验收当时的位置。

实现与验收见 `docs/verification/changxu-20261026.json`，接口合同见 `formspace/shared/portfolio.ts`。2026-10-25 的 WorkBuddy 快照已核对并展开留档于本机 `.local-history/workbuddy-20261025/`，原 ZIP 可从本机整理备份或 Git 历史追溯。接手新版使用当前 `main`。

浏览器空间与旧数据保留边界见 `wiki_memory/决策/ADR-006-免账号浏览器创作空间.md`。

