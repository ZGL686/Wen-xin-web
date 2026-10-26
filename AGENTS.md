# Wen-xin-web 项目工作约定

## 项目入口

- 当前仓库根是本文件所在目录，远端固定为 `https://github.com/ZGL686/Wen-xin-web.git`，日常分支为 `main`。
- 应用源码位于 `formspace/`。根目录是源码、三维资产、交付物和工程 Wiki 的统一仓库。
- 每轮先读本文件、`wiki_memory/AGENTS.md`，再按其中顺序读取当前状态和相关决策，不默认遍历所有历史。

## 用户持续授权：每轮结束同步

用户于 2026-10-26 明确要求：每次项目修改或本项目内对话结束后，自动更新 Wiki 工程记忆、提交并推送到本仓库，无需重复询问。

1. 执行用户本轮任务；普通讨论也记录为 `discussion`，摘要记录，不复制完整聊天或私人资料。
2. 更新受影响的当前状态、知识和决策。用户已确认的要求及从源码/测试验证的事实可直接沉淀；推测和新提议标为 `proposed`。
3. 对代码运行相应检查。仅文档变化执行 Wiki 检查和资产完整性检查即可，不重复无关构建。
4. 在根目录运行：

   ```powershell
   pwsh -File tools/project-sync.ps1 -Summary "本轮任务摘要" -Kind maintenance -Details "变更、验证、遗留事项"
   ```

   纯对话使用 `-Kind discussion`，功能、界面、修复、验收分别使用 `feature`、`ui`、`bug`、`test`。
5. 工具生成追加式日志、刷新索引、检查、提交并普通推送。结束前确认本地 `HEAD` 与 `origin/main` 一致，工作树无未解释变更。
6. 网络、凭据、冲突或远端新提交阻塞时保留本地结果并说明具体原因；禁止强推、自动 reset/clean、覆盖他人历史或假称推送成功。

这是项目内 Agent 每轮的执行约定和同步工具，不是对其他软件全部聊天的后台监听。别的 Agent 接手时也应读取本文件并执行流程。

## 工程边界

- 保持 React + Vite + TypeScript 架构、现有设计、交互与四个真实作品。
- `assets/3d source/` 是原始 MAX；`formspace/public/originals/` 是网页下载副本。原件不能改写，哈希以 `formspace/public/portfolio/verification.json` 为准。
- MAX、BLEND、FBX、GLB、ZIP 使用 Git LFS。不要把 LFS 指针误当作有效作品；克隆后运行 `git lfs pull`。
- `node tools/verify-project.mjs` 检查原件、网页资产、交付包、嵌套 Git 和提交边界。
- 站点仍使用 Cloudflare Worker/R2 和 Sites 登录；国内迁移是待办，不能把只复制前端称为迁移完成。
- GitHub 推送与发布网站是两项操作；同步源码不会自动重新发布现站。
- 不上传凭据、环境文件、缓存、运行数据库、原始完整聊天或本机 Git 备份。公开仓库只保存项目资料与脱敏任务摘要。
- 原应用 Git 历史已迁到根；`.local-history/` 保存本机备份，永不入库。未来使用 Sites 发布时准备独立的应用 checkout，不把包含资产与 Wiki 的根仓库当作单一应用目录交给 Sites helper。
