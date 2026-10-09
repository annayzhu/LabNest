# PR #93 合并与正式部署记录

北京时间 2026-10-09。PR：[AI providers #93](https://github.com/annayzhu/LabNest/pull/93)。

- PR最终提交：`3df9c9b64ed3e2095f55a4b47b6dbda894c633a2`。
- main合并提交：`685e52b7b315161eda1f7469696bc84349f353ee`。
- 最终应用修补提交：`87259882`；随后只修改富文本CI下载镜像，应用/Prisma/公共资源源码完全相同。
- 正式镜像：`labnest-app:ai-3df9c9b6`，ID `sha256:979dcd9c0cc4b79dd0f0113761748281e70d454e8c0acd2b416f5d0591e074d2`。
- Next Build ID：`OCVVJizuBvNDYinTG44UB`；正式容器关键源码摘要与合并main一致。
- 本次发布通过独立worktree操作；另一项Protocol AI开发的未提交文件没有进入镜像，工作目录保持原状态。

## 已通过

| 项目 | 实际结果与证据 |
|---|---|
| 双时区、类型与静态检查 | Shanghai/UTC各117文件598用例通过；TypeScript通过；lint零错误、12条既有警告。[日志](evidence/logs) |
| 生产构建 | 已提交干净源码构建通过；正式镜像复用该构建。[构建日志](evidence/release/docker-build-approved.log) |
| AI实际页面与DB回读 | Chromium/WebKit共28检查通过：配置增删改启停、加密保存/空密钥编辑保留、连接测试、条目生成与收件箱、明确工作台文本、三种协议、手机HTTP UUID降级。[最终版本报告及截图](evidence/release/final-ai-browser/report.json) |
| 正确性与数据保护 | 并发同ID只调用一次/保存一次；重试与零结果重放；来源修改/删除409不写入；旧删除对话框不能删除有AI建议的条目；无Experiment自动创建。错误schema、超过50条、越出请求动作范围均422拒绝。JSON与纯文本密钥回显均脱敏，含截断边界。[报告](evidence/release/final-ai-browser/report.json) |
| 最终提交远端CI | AI、Calculator、Editor、Entry rich text、Protocol consistency五条全部success。[固定提交CI记录](evidence/release/ci.json) |
| 富文本本机补验 | 与远端同套脚本补跑通过；额外保存六类正文桌面/手机、图片实际加载和导出回读证据。首组24检查通过，12份PDF共13页；键盘事件是模拟。其余复杂内容/关系/冻结/草稿等脚本退出码0。[补验摘要](evidence/release/richtext-local-summary.json) |
| 正式服务页面 | Chromium/WebKit核对localhost与局域网Settings和Calculator，桌面1440/手机390布局；主页均200、DB健康，模型输入没有密钥回显。[运行报告](evidence/release/runtime/report.json)、[主页](evidence/release/runtime/home-report.json)、[桌面截图](evidence/release/runtime/providers-desktop.png)、[手机截图](evidence/release/runtime/providers-mobile.png) |
| 正式数据保护 | 切换前后57张表摘要全部相同，52个附件共27,721,255字节逐文件摘要相同。[数据报告](evidence/release/data-preservation.json) |
| 配置与迁移 | Dify迁移在切换前已应用，启动确认无待处理迁移；公开占位加密密钥替换为随机256-bit密钥，未输出/提交凭据。正式库模型服务数0，AI及附件外发开关仍false。 |

富文本CI旧轮超时原因是Azure镜像下载61MB Noto包耗时约19分钟；最终轮切换Ubuntu官方HTTPS镜像后整套通过，没有删减或跳过用例。

## 失败

最终版本没有未解决的验收失败。开发中发现的密钥截断泄漏回归、来源字段选择错误和测试标签定位问题均已修复并复核。旧CI超时与修复证据保留在PR记录中。

## 未执行与范围边界

- 真实OpenAI/兼容厂商、Anthropic、校园Dify及实际模型输出未验证；上述协议验证只使用本机模拟端点、假凭据和合成记录。
- 实体手机/软键盘/真实缩放、人员试用与真实打印机未执行；浏览器390px截图不等同真机验收。
- 现有收件箱仅展示pending建议；接受、编辑、拒绝和业务执行器尚未实现，本次没有自动创建实验或修改库存。
- 本次发布不包含Protocol AI抽取或Studio AI助手，其验收未执行。

## 查看地址与回滚资料

- 电脑：[LabNest](http://localhost:3001/)，[模型设置](http://localhost:3001/settings#providers)。
- 手机（与电脑同一Wi-Fi）：[LabNest](http://192.168.0.102:3001/)。局域网入口已在本机浏览器验证，实体手机尚未验证。
- 部署前数据库、附件和环境配置备份只保存在私有忽略目录`.local-runtime/deploy-ai-20261008`；没有提交数据库内容或密钥。
- 原正式镜像保留为`labnest-app:rollback-20261008-ai`；数据库和附件卷未删除。
