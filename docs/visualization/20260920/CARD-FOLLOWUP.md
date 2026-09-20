# 正式入口验收补充：CardBody 属性传递

PR #82 合并部署后，严格的 Tools → Visualization 检查发现根版 CardBody 未将 data/aria 属性传到实际 div。此前根验收脚本的 DOM 结构后备定位掩盖了这个问题；之前记录的可见高度及图表数据仍为真实测量，但不能据此宣称所有布局标记都已生效。

补丁 PR #83，应用代码提交 `e698a39151c28ab561f13cb83bdda9ffe96a1fd8`：保留 forwardRef 与原样式，传递标准 HTML 属性。独立版已具有同一能力，不需要重复改动。验收脚本现删除后备定位，缺少实际标记会直接失败。

验证：

- 新 public-render 回归在旧实现下缺少 data/aria 属性而失败，补丁后通过；见 `evidence/card-followup/vis-card-red.log` 与 `vis-card-green.log`。
- 根仓库 111 文件、635 测试通过；TypeScript、修改文件 lint、生产构建通过。
- 新生产构建从 Tools 进入，localhost/LAN × 1440/390 px 四种组合均通过；桌面参数收起498 px、展开278 px；无页面异常或横向溢出。
- 标准与需求审查均无阻断项。
- 合并、最终 CI 和正式服务版本以最终交付记录为准；真机操作及用户审美认可仍为未执行。
