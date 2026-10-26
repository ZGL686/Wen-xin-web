# 交付包工具

历史 2026-10-25 ZIP 已保留在 `deliverables/`，不要覆盖。新包名称默认为北京时间当日日期，也可在两条命令中传入相同的新名称。

```sh
node tools/packaging/package-workbuddy.mjs prepare FormSpace_WorkBuddy_China_20261026
# 在新包的 源码/ 目录独立 npm ci、typecheck、test、build 并保存实际回执
node tools/packaging/package-workbuddy.mjs finalize FormSpace_WorkBuddy_China_20261026
python tools/packaging/zip-workbuddy.py FormSpace_WorkBuddy_China_20261026
```

prepare 从 Git 跟踪的 `formspace/` 复制应用，去掉旧站发布身份并加入接手说明；需先提交本轮应用变更。finalize 校验原件哈希并生成文件清单，不代替独立运行检查。ZIP 工具逐项校验 CRC 和内容哈希，并验证四个 MAX、GLB 与封面齐全；已有输出会拒绝覆盖。

展开快照、依赖和构建输出仅本地保留，Git 跟踪最终 ZIP、SHA 与可读说明。远端后来新增的投稿和用户记录需另行授权导出。
