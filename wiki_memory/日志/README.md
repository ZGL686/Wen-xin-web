---
type: knowledge
status: active
kind: process
importance: medium
updated: 2026-10-26
topic: work-log-guide
source_logs:
  - "[[日志/2026-10-26-工程整理与记忆初始化]]"
supersedes: null
---

# 工作日志规则

本项目每轮修改或对话结束后自动追加摘要日志。纯讨论使用 discussion；功能、界面、修复、测试、维护分别使用 feature、ui、bug、test、maintenance。一篇日志只设一个主要 kind。

记录目标、工程结论、变更、已完成的验证、结果与待办；不复制完整聊天、私人资料、令牌或内部推理。已封存历史不改写，更正用新日志链接旧条目。

Agent 先更新本轮影响的当前状态和知识，再调用根目录 `tools/project-sync.ps1`。脚本生成唯一日志、刷新 [[日志/MOC_工作日志|工作日志 MOC]]、检查并提交推送；实际 Git 回执确认结果。

来源和持续授权见 [[决策/ADR-002-每轮记忆与版本同步]]、[[当前状态/当前约束]]。
