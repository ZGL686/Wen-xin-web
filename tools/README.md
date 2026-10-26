# 会话结束同步工具

`project-sync.ps1` 由项目根目录 `AGENTS.md` 驱动，由 Agent 在每轮项目修改或对话结束时执行，纯讨论也记录摘要。它不是后台聊天监听器，不读取完整聊天，也不会创建定时任务。

需要 PowerShell 7、Git、Node.js、Python 3.10+，以及项目使用 LFS 时的 Git LFS。脚本依次探测 `python3`、`python`，不可用时再尝试本机 Codex 自带 Python；无效的 Windows 商店别名会跳过。`wiki_memory/` 必须为单层记忆目录，其中保留 `工具/memory_lint.py`；项目资料门禁由 `tools/verify-project.mjs` 提供。

## Agent 调用方式

在项目根目录执行：

```powershell
pwsh -NoProfile -File ./tools/project-sync.ps1 `
  -Summary '修复作品详情页在手机上的排版' `
  -Kind ui `
  -Details '变更：调整作品详情页间距与按钮。验证：类型检查与手机宽度预览通过。结果：页面内容可正常浏览。长期记忆候选：无。'
```

参数：

| 参数 | 含义 |
| --- | --- |
| `-Summary` | 必填，1–240 字符的一句话摘要，空白会压为单空格。不要传入整段对话。 |
| `-Kind` | 默认 `maintenance`，可选 `feature`、`ui`、`bug`、`discussion`、`test`、`maintenance`。讨论与计划也能用 `discussion` 留下摘要。 |
| `-Details` | 可选，最多 6000 字符。用简短结论记录变更、已完成的验证、结果与长期记忆候选；不要加入完整聊天、隐藏上下文、凭据或大段输出。 |
| `-SkipPush` | 仍然生成日志、体检、资料验证、`git add -A` 和本地提交；跳过网络推送与远端检查。它不是预览或只读模式。 |

脚本只把摘要写入新日志，不替 Agent 修改长期页面。用户已持续授权维护确认的要求与经源码/测试核实的事实；Agent 先更新受影响的 active 页面，未经确认的推测仍保持 proposed。每次调用使用北京时间与唯一后缀生成新文件：

```text
wiki_memory/日志/YYYY-MM-DD-HHmmss-fff-kind-唯一后缀.md
```

日志为 `type: log`、`status: archived`，含 `kind`、`importance: medium`、日期、唯一 `topic`、`source_logs: []`、`supersedes: null`。正文记录目标、变更与验证、结果、待确认长期记忆。脚本不改写旧日志；日志索引由 lint 工具更新。日志写明自动同步还需经过后续门禁，实际提交与推送结果以控制台最终输出和 Git 记录为准，不提前声称推送成功。

## 顺序与保护

1. 确认 Git 根目录就是脚本所属项目根目录、当前分支为 `main`，且 origin 的读取与推送地址均为 `https://github.com/ZGL686/Wen-xin-web.git`；拒绝多地址、冲突、其他分支和其他仓库。
2. 取得单进程文件锁，追加一篇独立日志。
3. 运行 `memory_lint.py index` 和 `memory_lint.py check`，再运行 `node tools/verify-project.mjs`。任一失败即停止。
4. 运行普通 `git add -A`，再检查暂存文件名、嵌套仓库和 blob 大小。`.gitignore` 是第一层过滤；脚本另外拒绝真实 `.env` / `.dev.vars`、常见私钥凭据、`keys`、运行环境和嵌套 `.git` 等目录，以及超过 100 MiB 的普通 Git blob。`.env.example` 等 `.example` 样例可提交，但里面仍不得放真实机密。大文件应先正确使用 LFS；脚本不自动迁移历史。
5. 创建本地提交；如根目录 `.gitattributes` 启用 LFS，再运行 `git lfs fsck --objects`，普通 push 继续执行 Git LFS 的正常钩子。
6. 未指定 `-SkipPush` 时，读取并 fetch 远端 main 到 `FETCH_HEAD`，检查远端是否含本地缺少的提交。若有则停止，等待人工整合；若远端为空则允许首次普通推送。
7. 运行普通 `git push origin main`。不 force、不 reset、不 clean，不自动 pull、merge 或 rebase。检查后远端发生竞争更新时，普通 push 仍会安全拒绝覆盖。

脚本会提交本项目中所有未被忽略的变更，Agent 应在执行前审阅本轮修改并归纳摘要。文件名保护不能代替内容审查，也不能识别放进普通源码中的所有密钥。

## 失败处理

检查、Git、LFS、认证或网络失败都会返回非零退出码。已生成日志、工作区变更、暂存区和已经创建的本地提交全部保留；脚本不做自动清理或回滚。先查看报错，再修正配置、忽略规则、认证、LFS 对象或手动整合远端。如果暂存了敏感文件，先明确取消对应文件的暂存并修正 `.gitignore`，不要强制提交。重新运行会生成新的追加日志，旧日志保留。

只检查 PowerShell 语法时，不执行同步脚本：

```powershell
$tokens = $null
$errors = $null
[System.Management.Automation.Language.Parser]::ParseFile(
  (Resolve-Path ./tools/project-sync.ps1), [ref]$tokens, [ref]$errors
) | Out-Null
if ($errors.Count) { $errors; throw 'PowerShell 语法检查失败' }
```
