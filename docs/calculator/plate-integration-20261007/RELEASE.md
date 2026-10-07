# 孔板接入主 Calculator：正式发布记录

发布于 2026-10-08 01:46（Asia/Shanghai）。[PR #92](https://github.com/annayzhu/LabNest/pull/92) 已合并，正式容器 `labnest-app` 在端口3001运行；健康检查及实际页面验收通过。

## 准确版本

| 项目 | 版本 |
|---|---|
| 基线 main | `d91d8203c912f1733ce72e3dc1c7fad5ff73bb72` |
| 最终应用代码 | `c7b2ce8c14006dc33f4f758dd1d49ae8c5327045` |
| PR最终HEAD / 正式镜像源码标记 | `83c12793ebca78b4d8d331f84a5634f9a502fe61` |
| GitHub CI实际临时合并引用 | `8121ac89f4366fd42a2af007bc09899bcde2ae95` |
| main合并提交 | `4d2b61d9431d416e4b6f5d408e17dd160eae01f2` |
| 干净源码生产编译提交 | `406924c9fde9ae48854dbce5843291d70f9ffc33` |
| 镜像标签 | `labnest-app:plate-83c12793`，同时更新部署使用的 `labnest-app:latest` |
| 实际镜像ID | `sha256:4247296817853f84f215a6034b55a8cea4360e29643e7a87da0584ce72631919` |
| Next生产Build ID | `dizFVd16xf8WhLykvm0Ap` |

406之后只修改测试、CI和证据。最终镜像更新这些文件及revision标记，复用未改变的生产编译；没有声称在83又重编译一次。合并main与83的应用文件无差异，正式容器内关键文件SHA-256与本地合并源码逐项相符，见 [deployment.json](evidence/deployment.json)。此后证据文档提交不改变应用或镜像。

## 已交付

- Tools → 孔板 → 配液计算中的六个入口加载主Calculator。Master Mix使用现有完整编辑器，包括体积/浓度、行增删、预混/单独加入、水补足、分组、预设和警告；正确算法、单位和主题系统复用。
- “保存为当前板方案”写入统一方案与计算记录，保留完整输入、结果快照和结构化操作。每板一个当前方案；编辑回读原输入，旧多方案归档保留在JSON备份。
- 兼容预混跨板合并后只加一次余量；独立模板按真实孔数准备，保留板/孔来源。变更孔位或撤销/删板等动作使旧汇总失效。反应数、消息来源窗口、会话、重复提交及历史/无效结果有校验。
- 独立下载版继续使用现有离线表单与引擎，独立孔板仓库未修改。本轮没有新增数据库同步；孔板项目仍存于当前浏览器，跨设备通过JSON备份/恢复迁移。

## 验证结果

| 验证 | 结果及证据 |
|---|---|
| PR最终HEAD CI | 五条workflow成功；Calculator Shanghai/Vancouver质量job及browser job全部成功。[CI](https://github.com/annayzhu/LabNest/actions/runs/37659661164)、[精确状态与步骤](evidence/final-ci.json) |
| 双时区回归 | 本地Shanghai/UTC各115文件572项；最终CI Shanghai/Vancouver各115文件572项。[Shanghai日志摘录](evidence/ci-quality-Shanghai.log)、[Vancouver日志摘录](evidence/ci-quality-Vancouver.log)；完整日志在CI |
| 类型、Lint、生产构建 | 均通过；Lint零错误、12条既有未使用变量警告。CI browser生产构建完成，原分支生产日志保留在evidence/production-branch |
| 浏览器CI | v1.3完整回归、31工具界面、状态、入口、选择器、54种模式与新增孔板完整集成全部成功。[日志摘录](evidence/ci-browser-summary.log)，完整截图/导出在CI artifact |
| 正式地址实际页面 | 在localhost:3001，Chromium/WebKit各1440/390四组完整流程；另外五工具每个引擎逐一填写计算保存，共10流程。[report.json](evidence/production-release/report.json)、[test.log](evidence/production-release/test.log) |
| 结果/方案/汇总/导出一致 | 24孔+12孔同配方，10%统一余量：预混752.4 µL；独立模板36 µL。页面、存储方案、项目XLSX单元格回读一致；实际下载JSON并经恢复对话框重读。逐板XLSX证据另见production-branch/individual-board-xlsx-readback.json |
| 真实截图 | 正式地址生成12张，桌面/手机视口、浅色/深色。[桌面编辑](evidence/production-release/chromium-1440-editor-light.png)、[桌面汇总](evidence/production-release/chromium-1440-summary-light.png)、[手机编辑](evidence/production-release/chromium-390-editor-light.png)、[手机深色](evidence/production-release/webkit-390-editor-dark.png) |
| 保存/旧兼容/保护 | 刷新、原输入重开、唯一方案、撤销/重做、合成旧项目真实导入/归档、失效排除、过期/其他窗口/重复消息阻断通过；没有使用用户真实旧项目 |
| 离线边界 | 已打开页面断网保存本机参数、联网刷新读回通过。独立静态版真实缓存后断网刷新通过，[报告](evidence/standalone-compat/report.json)。未验证关闭后重新加载LabNest新版iframe |
| 正式数据保护 | 切换前、切换后、正式页面验收后，57张表和52个附件校验完全一致。保留现有数据卷，没有清空、播种或迁移结构；私有pg_dump备份经pg_restore目录校验，旧镜像可回退。[摘要](evidence/deployment.json) |

以上是逐功能证据，不把测试数量或页面存在作为所有功能通过的依据。深色截图验证主Calculator编辑器；外层孔板原有配色保留。全部项目见 [ACCEPTANCE.md](ACCEPTANCE.md)。

## 曾失败及处理

- `2650f30e` 的Calculator CI在旧独立版表单断言失败：新的LabNest路由已使用主工作台，旧测试仍寻找独立旧控件。
- `406924c9` 完整v1.3回归通过后，旧UI-entry脚本的独立六工具检查同样使用了错误的LabNest路由。最终改为共用独立静态origin，保留原六工具/单位/警告/图标/离线断言，LabNest新版另做完整集成验收。
- Chromium快操作曾触发测试输入焦点竞争：新增行下一动画帧自动聚焦，旧脚本立刻填体积会写错字段。测试现在等到名称获得焦点，并逐项回读名称/体积后继续；没有为测试改计算算法。
- 两轴审查发现的缓存、分组签名、内嵌导航、重复组分问题均修复并补针对性回归。最终CI与正式报告失败项为空。

## 当前入口

- 电脑：[孔板与主Calculator](http://localhost:3001/tools/free-plate-layout/index.html?v=20261008-main-calculator)
- 手机，同一Wi-Fi且电脑保持运行：[孔板与主Calculator](http://192.168.0.108:3001/tools/free-plate-layout/index.html?v=20261008-main-calculator)
- 入口路径：Tools → 孔板 → 选择孔位 → 配液计算 → Master Mix → 计算 → 保存为当前板方案。再次编辑直接读回参数。

手机内网地址在发布时由本机en0读取并检查健康HTTP 200；未声称用真机浏览器验证。IP变化后地址需要相应更新。

## 未执行与影响

真机软键盘、真实160%缩放、实验人员试用、用户真实旧孔板项目、file://下载版完整人工操作、断网关闭后重新加载主Calculator iframe均未执行。因此软件集成和自动验收完成，不能宣布这些使用场景全面通过。

真机简短验收：先备份项目JSON；同一Wi-Fi打开手机链接 → 选孔 → Master Mix中加入中文组分名和浓度/单位 → 计算保存 → 刷新重开 → 160%缩放确认名称、输入和保存按钮完整可操作 → 第二板生成跨板汇总并导出。将实际结果记录为通过或失败；新iframe需可访问LabNest服务，项目不自动跨设备同步。
