# 2026-09-09 逐项验收

基线及当前远端 main：`87a7610e09df32fa7b4a55fef69b3116d8c95974`。Issue [#74](https://github.com/annayzhu/LabNest/issues/74)。代码验证版本见 [VERSION.json](evidence/VERSION.json)。本分支未合并、未正式部署。

所有写入均为本机隔离数据库合成记录。没有访问用户原故障记录，也没有使用真实科研数据。表内“通过”仅覆盖写明的检查；混合项尚有未覆盖条件时标记“未执行”。失败日志保留红灯及调试过程，不代表最终仍失败。

修改位置：耗材 `src/components/RunMaterials.tsx`、`src/lib/run-materials.ts`、`src/lib/run-consumption.ts`、耗材API及`request-origin.ts`；执行文档 `experiment-document.ts`、`run-evidence.server.ts`、详情/编辑/structured-export；方法与简介 `ExperimentForm.tsx`、`ExperimentProtocolPicker.tsx`、`ExperimentBrief.tsx`、`experiment-provenance.ts`；图片 `DocumentMediaNode.tsx`；配色与动效 `system-theme.ts`、`ContextProperties.tsx`、`globals.css`。四工具与已有图片保存/A4路径以复用回归为主。

| 编号 | 用例 | 状态 | 实际结果与范围 | 证据 |
|---|---|---|---|---|
| T01 | 用户部署与main核对 | 通过 | 最新 main 87a7610；正式部署检出同版本、容器健康。本分支未部署。 | [证据](evidence/environment.json) |
| T02 | 属性顺序 | 通过 | 研究方案 → 方法来源 → 版本 → 状态；关联规程优先，已去除方法卡片嵌套。 | [证据](evidence/method-priority.json) |
| T03 | 状态按钮字号 | 通过 | 三档系统字号逐档测量，状态按钮与同级输入框字体和字号一致，未受正文影响。 | [证据](evidence/brief-status.json) |
| T04 | 规程提示精简 | 通过 | 移除长说明与已选项重复元信息，保持版本冲突及操作按钮。 | [证据](evidence/method-priority.png) |
| T05 | 多规程与改研究方案 | 通过 | 关联规程排第一，可添加其他规程；切换研究方案保留版本ID，顺序调整正确。 | [证据](evidence/method-priority.json) |
| T06 | 简介字段 | 通过 | 简介仅ID、方案名称、方法名称版本；自行记录空状态沿用。 | [证据](evidence/run-document-browser.json) |
| T07 | 简介长名称与手机 | 通过 | 390px、三档系统字号简介保持单行，展开可读三个完整方法；PDF保留全部长名称，无整页溢出。 | [证据](evidence/brief-status.json) |
| T08 | 简介正式保存／输出 | 通过 | 固定来源进入只读文档、PDF及CSV/XLSX/JSON/Markdown；逐文件回读步骤状态、异常处理、参数与原方法名称。 | [证据](evidence/experiment-exports.json) |
| T09 | Protocol新版本发布 | 通过 | 合成数据新增reviewed版本并改名后，旧实验仍保留原名称与版本；新版发布界面本身未操作。 | [证据](evidence/run-history.json) |
| T10 | 正常步骤完成 | 通过 | 仅completed步骤显示勾；未完成保留文字，正常步骤不展开原始说明。 | [证据](evidence/run-document-browser.json) |
| T11 | 步骤偏差 | 通过 | 偏差具体文字、关联步骤、手写内容在刷新及PDF保留。 | [证据](evidence/run-document.pdf) |
| T12 | 异常／跳过／未完成 | 通过 | 手机尺寸Run表单保存正常、偏差、异常及处理文字，DB回读与编辑/只读/PDF一致；第4步保持未完成。现有模型无独立跳过状态，不新增绕过规则。 | [证据](evidence/run-history.json) |
| T13 | 执行记录打印 | 通过 | 步骤顺序、具体偏差、完整方法来源进入PDF；不依赖红色表达。 | [证据](evidence/run-document.pdf) |
| T14 | 更正／历史执行 | 未执行 | 派生内容幂等、不覆盖手写正文已通过；未访问用户原故障记录，不声称所有历史记录恢复。 | [证据](evidence/focused-after-review.log) |
| T15 | 物料空状态 | 通过 | 无常驻新增表单，空列表隐藏表头，仅保留添加入口。 | [证据](evidence/material-ui-green.log) |
| T16 | 手动逐条添加 | 通过 | 名称保存、连续录入、关闭重开、编辑与新增隔离；保存期间阻止切换以保护草稿。 | [证据](evidence/material-sessions.json) |
| T17 | 仅记录无库存 | 通过 | 仅名称保存、HTTP回读及真实页面刷新通过；不创建库存。 | [证据](evidence/material-delete-green.log) |
| T18 | Protocol规则带入 | 通过 | 锁定版本规则2×3µL=6µL；缺参数阻断，预计6、实际空，依据可回读。 | [证据](evidence/consumption-browser.json) |
| T19 | 损耗与重复带入 | 通过 | 沿用原公式不附加损耗；并发同规则只保留一项，按来源ID而非名称去重。 | [证据](evidence/rule-idempotence.json) |
| T20 | 数量单位 | 通过 | 预计和实际共用紧凑数量控件；5/2mL↔5000/2000µL，空值不转0。 | [证据](evidence/material-units.json) |
| T21 | 待扣条目编辑／删除 | 通过 | 未扣条目编辑保留身份；删除后GET不存在，已扣条目拒绝删除。 | [证据](evidence/material-delete-green.log) |
| T22 | 已扣条目更正／撤销 | 通过 | 更正保留原交易，唯一更正约束防竞争；重复确认幂等，界面展示账面差额并说明不是实物退库。 | [证据](evidence/correction-regression.log) |
| T23 | 扣减确认 | 通过 | 只确认选中条目；仅保存不扣减，实际量与库存来源独立校验。 | [证据](evidence/material-boundaries.json) |
| T24 | 不足与换算缺参数 | 通过 | 库存不足及质量/体积不兼容均保留记录并待处理，不报告成功。 | [证据](evidence/material-boundaries.json) |
| T25 | 重复请求／离线重试 | 通过 | 离线保存进入原队列，重连只生成一条；刷新保留实际量，确认重试不重复交易。 | [证据](evidence/offline-material.json) |
| T26 | 已领培养基使用 | 通过 | 已领瓶关联Run，显示持有人并链接余量观察；确认不再扣一瓶。 | [证据](evidence/inventory/containers.json) |
| T27 | 估计250→180mL | 通过 | 250→180mL保留两次估计观察，无-70mL库存交易。 | [证据](evidence/inventory/containers.json) |
| T28 | Origin合法访问 | 通过 | 实际内网HTTP浏览器表单保存并刷新回读；使用当前地址及隔离3232端口。未改正式服务。 | [证据](evidence/lan-browser.json) |
| T29 | Origin不可信访问 | 通过 | 恶意Origin、null、伪造转发头仍拒绝；未扩大信任边界。 | [证据](evidence/origin-http.json) |
| T30 | 保存失败反馈 | 通过 | 合成503在弹窗内中文提示、保留输入；保存中关闭/Esc不能切换清掉另一草稿。 | [最终版本证据](evidence/final-save-race.json) |
| T31 | 四工具默认站内页 | 通过 | 四工具既有站内入口保留；桌面/手机与明暗布局回归。 | [证据](evidence/tools/tools-inventory.json) |
| T32 | 工具工作流 | 通过 | 四工具导入、保存往返、下载及逐文件回读通过，算法未重写。 | [证据](evidence/tools/file-checks.json) |
| T33 | 整卡进入／独立按钮 | 未执行 | 鼠标整卡、键盘及独立按钮已通过；真实触控仍待真机验收。 | [证据](evidence/tools/tools-inventory.json) |
| T34 | 删除图片空白 | 通过 | 六入口×四位置×两删除键，48组合包含撤销重做及继续输入；独立合成夹具保留其他空段落；结果模板另验删除、撤销、继续输入及保存刷新。 | [正文证据](evidence/image-matrix.json) · [模板证据](evidence/template-delete.json) |
| T35 | 图片保存／打印回归 | 通过 | 六正文与模板保存、刷新、重编、只读检查图片decode；14份PDF逐页非空。 | [证据](evidence/editor/) |
| T36 | 全文／表格字号 | 通过 | 全文、单元格、行、表格、多单元格范围及保存重编；六入口字号/图注/打印回归。 | [证据](evidence/fonts/text.json) |
| T37 | 主题配色 | 通过 | 五组参考配色覆盖17张来源色卡映射，区分标注与近似取样，保留原配色ID/深色语义。 | [证据](evidence/../VISUAL-SOURCES.md) |
| T38 | 主题页面覆盖 | 通过 | 首页、编辑、库存、属性、工具 × 桌面/手机 × 明暗20组；实图检查与无横向溢出断言。 | [证据](evidence/visual.json) |
| T39 | 主题持久化／图表含义 | 通过 | 偏好持久化和旧ID兼容、状态色对比度通过；未改科研图表/样本分组配色系统。 | [证据](evidence/theme-contrast.log) |
| T40 | 动效 | 通过 | 桌面/手机录屏，快速开合3轮草稿保留、手机背景滚动锁恢复；非真机性能结论。 | [证据](evidence/motion.json) |
| T41 | 减少动态效果 | 通过 | 减少动态效果下transition为0s，开关操作及草稿保留。 | [证据](evidence/motion.json) |
| T42 | 全站紧凑与侧栏 | 通过 | 目标表单和侧栏已验；8规程摘要3项，搜索/筛选/批量增减保存7关联，8原规程均保留，未保存标题不丢失；全站未逐路由穷举。 | [证据](evidence/shared-relations.json) |
| T43 | 真机输入与160%缩放 | 未执行 | 真机IME完整选词、软键盘、160%系统缩放、实验人员试用未执行；模拟不替代。 | [证据](evidence/../MANUAL-ACCEPTANCE.md) |
| T44 | 采购／库存独立性 | 通过 | 沿用既有库存/采购账本；无库存及不足待扣的Run均能完成且无自动交易，数据库回读通过。 | [证据](evidence/inventory-independent.json) |
| T45 | Calculator受影响回归 | 通过 | 本轮22阶段Calculator全套通过，含正确性、历史、离线往返、导出与转染回读；验证SHA单列。 | [证据](evidence/calculator/acceptance-run.json) |
| T46 | 默认A4打印与PDF尺寸 | 通过 | 全部31份PDF共48页均为A4且非空；其中14份正文PDF16页逐页含图片。系统/驱动覆盖与真实打印未执行。 | [全部PDF](evidence/all-pdfs.json) · [正文尺寸](evidence/pdf-page-dimensions.json) |

最终应用代码 `5c1215d` 已通过 Lint、TypeScript、生产构建、上海与温哥华双时区各604项测试；弹窗会话、单位与延迟保存竞态在新构建真实页面复验。先前页面证据代码版本为 `0a4c57d`，差异仅弹窗会话标识改由React状态驱动及未使用导入清理，未改算法。最终分支远端CI待PR检查。

CI首次运行 `34330363243` 的 visual-v11 对比度失败，其他21阶段通过。定位为新增颜色交叉渐变产生低对比中间帧，应用修复 `3429d4e` 改为前景/背景原子切换并保留位移/边框动效；新生产构建的24个主题/模式组合通过原对比度断言，见 [最终配色](evidence/final-theme/visual-report.json)、[红灯](evidence/theme-transition-red.log)、[绿灯](evidence/theme-transition-green.log)。远端最终运行状态以PR实时检查及说明为准。
