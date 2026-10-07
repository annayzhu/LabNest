# 双轴审查记录

固定基线：`91fc4b6e9159687f529215266654a096fc0c8053`。任务来源：[SPEC.md](SPEC.md)、GitHub Issue #90；规范：AGENTS.md、PRODUCT.md、DESIGN.md、实际 Next.js 16.2.10 文档。根据 code-review skill 分别运行 Spec 与 Standards 两名独立评审。

## Spec

- Run 桌面抽屉的触发图标与选择器未取得共享修复：449ec041 已修复；真实 Run 抽屉、iframe 入口在 Chromium/WebKit 桌面验证。
- 菌落图像原生上传输入的焦点不可见：449ec041 已修复；真实文件输入聚焦后检查标签 outline 并截图。
- 追加模式回归发现仅含嵌套转染方案的草稿无法恢复：e59933d0 已修复；恢复54个合成模式用例时实际检出，原主分支同样存在。
- 补充审查发现空当前模式会遮蔽 `__mixModeDrafts`/`__wbSampleDraft` 中保留的用户输入：56de519d 修复，81813d59 增加完整刷新、恢复、多组切换、读取保留组分的页面回归。补充 Spec 评审确认代码审查关闭，最终通过状态以实际浏览器报告为准。

## Standards

- 新控件写死12/13px，未跟随已有界面字号设置：449ec041 改用现有字号变量；compact/standard/comfortable 三种实际字号逐一验证。
- 根据英文标签正则猜测转染选择器类型为非阻断 heuristic：已改为调用方显式 segmented=false，保留原生单位/产品方案选择器。
- 补充审查同样指出备用模式草稿元数据被排除：与上述 Spec 结论分别记录；已明确只允许两个用户输入缓存字段，其他 __ 元数据继续忽略。3项单元回归经评审独立运行通过，未发现其他可执行问题。

发现均已处理；不以审查关闭替代最终构建中的功能验证。

## 精确HEAD CI 追加复核

57f1dcbd 首轮 CI 的34个入口动作通过，但最后捕获 WebKit 的辅助转染 RSC 请求错误。未稳定重现底层引擎异常；旧生产构建实际证实未点击转染时会预加载2个RSC请求。c40068dd 将四个配对工具 Link 明确设为 prefetch=false，路径和上下文不变。3ff48da4 测试实际点击转染再返回、检查 Run iframe 上下文以及全程零备用工具预加载；保留严格 pageerror 检测与 context/stack。Spec/Standards 独立复核未发现代码阻断项，要求的 Run 后及退出前请求断言均已补齐。新生产构建本地38项入口通过；是否关闭首轮 CI 故障以最终精确HEAD CI结果为准，不将此修复表述为已证实的 WebKit 引擎根因。

最终结果：PR HEAD3ff48da4关联的四条CI全部成功；CI检出93086eb8与main实际合并96894e48完整tree相同，已fetch并核对。正式镜像1027个已跟踪应用文件hash一致；正式八场景页面操作通过。精确版本和未执行边界见RELEASE.md。
