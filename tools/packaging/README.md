# WorkBuddy 交付包工具

仅在用户明确要求打包时使用，保留历史输出，不覆盖已有目录或 ZIP。Node.js 24、Python 3.11+。

```sh
node tools/packaging/package-workbuddy.mjs prepare Changxu_WorkBuddy_China_20261107
# 在 formspace/outputs/handovers/同名目录/源码/ 独立安装、类型/API/构建/Node 验证
# 保存实际结果到包目录 validation.json
node tools/packaging/package-workbuddy.mjs finalize Changxu_WorkBuddy_China_20261107
python tools/packaging/zip-workbuddy.py Changxu_WorkBuddy_China_20261107
```

prepare 从 Git 跟踪的当前应用复制文件，要求应用目录无未提交变更；移除复制件的 Sites project_id，加入 docs/workbuddy/current、工程 Wiki 和三件补充作品。保持仓库原件、原站托管身份和旧包不变。

finalize 校验四件基线原件/GLB、所有五件内置资源和 LFS 实体，生成逐文件 SHA-256；它不代替运行检查。ZIP 工具验证清单与实际文件集、逐文件哈希、CRC、八个 MAX 及必要文件。安装产生的 node_modules/dist/运行数据不入包。

展开工作区放于忽略目录 formspace/outputs/handovers/，最终 ZIP 和 sha256 放于 deliverables/。远端 R2 私密记录、会话和 Cookie 不在包中，单独迁移不得混入公开仓库。COS 适配尚未真实云端验证，国内部署状态不能由打包成功推断。

validation.json 必须如实包含六项检查的 command 和 exitCode：npm ci、npm run typecheck、npm test、npm run build、npm run test:node、node scripts/test-derived-build.mjs。finalize 缺少任一通过回执就停止。
