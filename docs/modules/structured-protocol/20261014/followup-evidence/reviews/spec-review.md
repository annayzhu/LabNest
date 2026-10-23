## Spec review

固定点 `15faef6c7a3b63dbdf66f98f16aa7ee1885fb99a` → `0e4136ee`；使用 `git diff 15faef6c7a3b63dbdf66f98f16aa7ee1885fb99a...HEAD`。只读独立检查，未使用旧验收矩阵推断新代码。

1. **[P1] 旧 Protocol Run 离线完成被来源校验拒绝。** `src/components/ProtocolRunProgressForm.tsx:148` 在没有 systems 时发送 `sourceRef=stepId`，而 `src/app/api/mobile/step-completions/route.ts:42` 要求 `step.protocolStepRef ?? step.id`。复现：使用仍有 `protocolStepRef`、但无 systems 的旧规程实验，离线完成一步，再恢复网络；该请求永久进入“来源版本不同”冲突。违反需求 `REQUIREMENTS.md:435`“旧实验保留原执行语义和记录”及 `373–375` 本机记录恢复同步。应传递实际捕获的原来源引用。**主代理已反馈工作区修复；本评审针对上述提交，修复后的旧 Run 浏览器回归尚待补证据。**

2. **[P2] 暂时失败的前驱会把后继制造成永久冲突。** `src/components/MobileMutationSync.tsx:18–64` 仅拓扑排序，但前驱 500／网络异常后仍继续发送后继；`src/lib/queued-run-revision.server.ts:18` 找不到前驱回执时抛错，完成接口返回400，后继因此被标为 conflict。复现：离线排队 A=实际值、B=完成；首次恢复联网时令 A 一次返回500，B随即变成conflict；下次前台同步A成功，B仍被过滤，不会自动恢复。违反 `REQUIREMENTS.md:375`“网络恢复或重新进入前台时主动同步”。同轮前驱未成功时应把后继保持pending并暂停该依赖链；只有真正版本冲突才进入人工核对。

其余重点：多组独立采用、显式批量事务回滚、共同操作差异阻断、历史继续实例、Entry冻结复用、原始 DOCX 结构保留及手表复用执行校验均有对应实现；未发现另建计算系统或无关功能扩张。Apple Watch 真机安装／断连／通知未执行属于已披露验收限制，不作为代码缺陷。

结论：2项发现，最严重为旧 Run 离线兼容回归；修复后需分别验证旧规程离线链与一次性网络失败后的依赖恢复。
