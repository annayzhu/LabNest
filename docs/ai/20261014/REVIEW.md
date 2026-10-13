# 双轴审查

基线 main：c79a5fc21a56a9c156cd2356f19fbd79789c18ae。首次审查实现：41338852；修复版本：c9566b4b1f59bc143e135fa10c0061ad9164cf11。

## Standards

- 发现 provider 变更与建议发布之间的事务竞态。真实隔离 PostgreSQL / HTTP 回归：先阻塞来源图锁，再停用连接；旧代码返回 403 但已写入 1 条建议。修复为先取得来源图和 Entry 锁，再按 AISettings → AIProvider 顺序取得共享行锁并检查版本，持锁到提交。修复后返回 403、新增建议为 0。未发现现有路径的反向锁顺序。
- 同页 provider 变更可能不刷新状态的疑点未复现：实际 Chromium 页面停用→启用即更新状态，无需刷新或切换焦点；撤回此疑点，没有增加重复同步系统。
- 复审未发现未关闭的确认问题。详见 `evidence/review-race-red.log`、`review-race-green.log`、`review-regressions.json`。

## Spec

- 发现配置保存期间仍可编辑输入，旧响应会覆盖后来输入并错误显示“已保存”。延迟 PATCH 实测复现；两个配置输入现均在保存期间禁用，回归通过。
- 复审未发现未关闭的确认代码问题。真实外部 API、物理手机、发布与清理不会因为代码复审通过而自动记为通过。
- 证据：`evidence/review-ui-red.log`、`review-ui-green.log`。

首次确认问题：Standards 1 项（另 1 项疑点已排除）、Spec 1 项；复审两轴均无剩余确认问题。
