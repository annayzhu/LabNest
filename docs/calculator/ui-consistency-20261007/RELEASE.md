# 2026-10-07 正式发布与最终验收

PR [#91](https://github.com/annayzhu/LabNest/pull/91) 已合并并正式部署。电脑入口：http://localhost:3001/tools/calculator；手机局域网入口：http://172.17.69.197:3001/tools/calculator。手机须与这台Mac在同一可互通局域网，Mac及Docker需要运行；未将本机LAN验证记为真机验收。

## 准确版本

| 对象 | 版本 |
|---|---|
| 任务基线 | 91fc4b6e9159687f529215266654a096fc0c8053 |
| 最终PR HEAD／镜像源 | 3ff48da4880215ff62274ac5be21c5df2d50755b |
| CI实际检出测试合并提交 | 93086eb8910a00d4b2dad3f6450d1278d32bbf20 |
| main正式合并提交 | 96894e484de4fa50eead9debdd0cb626a73ff905 |
| 上述三者相同完整tree | a3ce17b209c16a23e10db9d6b9f2d4b3d0d7aa4a |
| 正式Next构建ID | GY13uDq0phY99qxMeUtUT |
| 正式镜像ID | sha256:89825674cf80f0338fe82ff98e4f470c12efe20fbc7fadf81b7ef71a803b3efc |

GitHub `actions/checkout` 在PR流程默认检出测试合并提交；报告中的93086eb8保留原值，未改写为PR HEAD。已实际fetch并比较其完整tree与main合并提交相同。随后本目录的交付证据提交仅更新文档、截图与日志，应用代码未变化，正式镜像不需要为文档再次构建。

## 已通过

- [最终CI状态](evidence/ci/final-status.json)：Calculator、Document editor、Protocol experiment consistency、Entry rich text四条工作流全部成功。[Calculator运行](https://github.com/annayzhu/LabNest/actions/runs/37607866601)包括双时区质量检查、生产构建和全部浏览器任务；[完整浏览器日志](evidence/ci/final-browser.log)。下载附件SHA256与GitHub公布的digest一致。
- 两时区各559项单元测试／114文件、TypeScript、lint通过（0错误／12条已有警告）。最终25组功能回归、132工具页面组合、80状态检查、38入口检查、4种选择器上下文、54合成模式及历史回读均通过，详见[逐项验收](ACCEPTANCE.md)，不以数量替代逐项结果。
- 基线与最终CI的120组实际渲染数字序列一致；11个科学计算/输出文件及附件16个SVG保持原字节。模式草稿恢复、无效结果禁止正常复制、历史写入保护、并行稀释来源等针对性回归保留。
- CSV/XLSX/JSON的完整冻结快照与独立数据库回读一致；最终CI生成的PDF两页在本机重新提取文字并逐页渲染查看，保留数值、单位、组分、来源及警告。[最终文件回读](evidence/ci/final/regression/formal-exports/pdf-readback.json)。CI原始PDF报告仍保留“待文件回读”，新增回读记录明确关闭该项。
- [正式页面八场景](evidence/production/browser.json)：实际LAN服务、Chromium/WebKit、1440/390 CSS像素、浅/深色；验证实际明暗模式、Tools→新版31工具目录→反应配液、手机More菜单中文切换、设置保留、514.8µL预混计算、复制输出文本、下载CSV并读回、无效输入清除结果与复制、无页面横向溢出。截图已实际查看。[可重复脚本](evidence/production/verify-release.mjs)：`FORMAL_BASE_URL=http://172.17.69.197:3001 node docs/calculator/ui-consistency-20261007/evidence/production/verify-release.mjs`，只操作浏览器本机状态，不写实验记录。
- [部署一致性](evidence/production/deployment.json)：1027个已跟踪应用文件与正式镜像逐字节一致；PostgreSQL容器、附件挂载不变；实验7／Protocol7／结果1／Entry4／Attachment37保持；附件49文件、19067435字节及聚合SHA256不变。切换前已保存私有数据库备份及回滚镜像，均未上传仓库。启动无待执行迁移、无新增历史回填，正式health确认数据库可达。

| 实际正式截图 | 浅色 | 深色 |
|---|---|---|
| 桌面 | [输入](evidence/production/chromium-1440-light-input.png) | [结果](evidence/production/webkit-1440-dark-result.png) |
| 窄屏模拟 | [输入](evidence/production/chromium-390-light-input.png) | [结果](evidence/production/webkit-390-dark-result.png) |

## 失败及处理

当前必需自动验收失败项：无。首轮57f1dcbd CI记录了WebKit辅助转染RSC预加载异常，已关闭配对链接的非必要预加载，新增真实导航、上下文及严格全程请求／pageerror断言；最终完整CI成功。底层引擎异常未稳定复现，不声称已证实其根因。正式巡检三次脚本定位失败分别为导出工具栏作用域、手机隐藏的桌面语言按钮、切中文后发生变化的英文dialog名称；实际用户路径独立核验并修正脚本，应用代码未改动。三份原失败日志仍在evidence/production。

## 未执行及影响

- 真实手机选择器、触控、软键盘/拼音候选确认、160%缩放及实验人员试用：未执行；自动化390px/WebKit不能关闭真机部分。
- 最终版本原生桌面200%缩放：Mac锁屏阻止复测；保留旧449ec041真实200%凭据，未改标为最终版本。最终320/768 CSS像素及字号配置压力检查通过。
- 原用户故障旧记录、真实打印机/OS打印对话框：未执行；兼容用例使用标记的合成记录，PDF渲染不等于纸面打印。
- 正式LAN为内网HTTP，尚无受信任HTTPS入口；复制降级已实际验证，不能将localhost安全上下文的离线安装/同步回归宣称为真机HTTP完整离线通过。

这些未执行项保留为真机/人工验收边界，不自动记为通过。可直接依照[验收记录的简短步骤](ACCEPTANCE.md#未执行及影响)操作。
