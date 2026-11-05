# 交付包工具

项目默认提供原格式文件。仅在明确要求另行制作 WorkBuddy 接手包时使用以下工具。新包名称默认为北京时间当日日期，也可为每条命令传入相同的新名称。

```sh
node tools/packaging/package-workbuddy.mjs prepare FormSpace_WorkBuddy_China_20261026
# 在新包的 源码/ 目录独立 npm ci、typecheck、test、build 并保存实际回执
node tools/packaging/package-workbuddy.mjs finalize FormSpace_WorkBuddy_China_20261026
python tools/packaging/zip-workbuddy.py FormSpace_WorkBuddy_China_20261026
```

prepare 从 Git 跟踪的 `formspace/` 复制应用，去掉旧站发布身份并加入接手说明；需先提交本轮应用变更。finalize 校验原件哈希并生成文件清单，不代替独立运行检查。ZIP 工具逐项校验 CRC 和内容哈希，并验证四个 MAX、GLB 与封面齐全；已有输出会拒绝覆盖。

手工交接产物统一放在本机忽略目录 `formspace/outputs/handovers/`。2026-10-25 的历史快照按原清单展开留档于 `.local-history/workbuddy-20261025/`。原 ZIP 可从本机整理备份或 Git 历史追溯。远端后来新增的投稿和用户记录需另行授权导出。
