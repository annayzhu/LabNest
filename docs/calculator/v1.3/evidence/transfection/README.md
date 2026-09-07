# 转染材料与配制方案验收

本轮基于用户在复制/最近使用改动后的追加要求。沿用 Calculator 引擎、单位转换、移液检查、历史快照和正式导出；没有创建第二套计算系统。旧请求继续采用 transfection-v2；新结构方案采用 transfection-v3。

## 验证版本与结果

- 应用版本：`d1849b654c6e34fc1b339333895c9d57e373f133`（转染代码 `f619e80`，已合并 main `3f90adb`）。
- 通过：上海/温哥华各576项测试、TypeScript、生产构建、定向lint；见相应日志。
- 通过：生产页面单/双管、siRNA、摩尔比、模式清理、产品限制、多组、草稿恢复；两组CSV/XLSX逐单元格回读一致，Control质粒每孔0.5µL、整批1.65µL。
- 浏览器使用 `localhost:3226`，最终入口连接既有合成验收库 `labnest_calculator_acceptance_20260906`；新转染方案已通过离线入队、恢复联网同步、重复提交及数据库独立回读，没有写入生产科研记录。
- 本次无未解决的本地验收失败；开发时的测试断言/辅助脚本问题已修正，最终结果见 `browser.json`。远端CI以PR的实际状态为准。

## 已实现（以下TF-01—TF-13均通过；边界见未执行）

| 编号 | 要求 | 修改位置 | 验收证据 |
| --- | --- | --- | --- |
| TF-01 | DNA、多DNA、siRNA、多siRNA、shRNA表达质粒、DNA＋siRNA；明确材料形式 | transfection.ts、TransfectionEditor.tsx | transfection.test.ts；browser.json |
| TF-02 | 质量比与摩尔比区分；摩尔比必须提供长度/MW | 同上 | 3kb/6kb、1:1摩尔比、总质量3µg → 1/2µg；缺长度拒绝；页面验证 |
| TF-03 | siRNA每种/混合物总浓度或pmol；以最终培养体积为分母 | transfection.ts | 10nM × 600µL → 6pmol；20µM母液取0.3µL；每种与总量测试 |
| TF-04 | 独立单/双管；体积定义切换清空旧值，隐藏字段不参与 | changeTransfectionMixing、TransfectionEditor | browser.json：切换后不可计算，补填后仅单表；负的隐藏A/B值不影响单管测试 |
| TF-05 | 加稀释液 vs 补足至总体积，计入所有组分 | transfection.ts | DNA2µL＋试剂6µL，各加50µL稀释液→108µL；各补足至50→100µL；超管容积/培养体积拒绝 |
| TF-06 | A/B显示全部组分、单管总量、混合量、最终培养体积 | TransfectionResult.tsx、ResultPanel.tsx | desktop-dna.png、phone-dna.png、phone-single.png |
| TF-07 | 试剂直接体积、按DNA、按siRNA、其他明确单位依据；辅助试剂独立 | Reagent编辑器、reagentVolume | 自定义单位缺失拒绝；P3000按DNA独立计量；纯siRNA不得加P3000 |
| TF-08 | 产品方案绑定说明；不默认不同材料/模式可互换 | transfectionProtocols | 不兼容组合拒绝；RNAiMAX DNA拒绝；反向方案注明孔内逐孔配制，批量数仅备料总计 |
| TF-09 | 处理组独立；余量仅增整批，不增每孔剂量 | transfection.ts | 多组页面/复制；0.3µL/孔在10%/50%余量下不变，整批1.98/2.7µL |
| TF-10 | 复制简化、正式导出和结构化操作一致 | result-presentation.ts、operations | browser.json剪贴板；two-groups.csv/xlsx；保留内部追溯内容 |
| TF-11 | 旧记录兼容与关联孔位保护 | calculator-engine.ts、transfectionPlateValues、free-plate-layout/app.js | 旧两管2/60.5/6/56.5回归；多组或孔数不匹配拒绝回写；单组只写每孔值 |
| TF-12 | 草稿恢复 | 既有saveDraft、浏览器恢复按钮 | browser.json：多组参数刷新后恢复 |

| TF-13 | 新转染方案离线入队、重连、幂等与DB回读 | 既有mobile队列/API、transfection-database脚本 | database.json：原始方案及operations完全一致，重放仅一条Result |

## 厂商依据与应用边界

- [Lipofectamine 3000，MAN0009872 Rev C.0](https://documents.thermofisher.com/TFS-Assets/LSG/manuals/lipofectamine3000_protocol.pdf)：DNA方案P3000为2µL/µg DNA；纯siRNA不加P3000。产品方案应用相应辅助试剂规则，主试剂用量仍由用户按具体规格填写。
- [共转染FAQ](https://www.thermofisher.com/order/catalog/product/L3000015/faqs)：3000允许DNA＋siRNA；RNAiMAX不适用于该组合。没有把产品名等同于所有材料都适用。
- [RNAiMAX正向方案](https://www.thermofisher.com/us/en/home/references/protocols/cell-culture/transfection-protocol/rnaimax-forward-transfections-lipofectamine.html)与[反向方案](https://www.thermofisher.com/us/en/home/references/protocols/cell-culture/transfection-protocol/rnaimax-reverse-transfections-lipofectamine.html)：分别稀释/混合与孔内依次配制分开处理。
- [siRNA终浓度定义](https://www.thermofisher.com/us/en/home/life-science/cell-culture/transfection/rnai-transfection/rnai-transfection-protocols.html)：分母为原培养液与加入混合液的总和。程序计入核酸、脂质和辅助试剂的体积；不把说明书中的名义近似总量冒充精确相加值。

产品选项提供具体方案和兼容限制，并非自动优化转染条件。自定义方案必须填写加样顺序及用量依据。DNA摩尔比可输入实际MW，也可明确使用dsDNA长度×660 g/mol/bp估算。

## 未执行

- 真机软键盘、真实最高160%缩放：模拟手机视口不等同真机验证。
- 实验人员试用及湿实验效果验证：本轮只验收配液算术与软件操作，不证明转染效率或毒性。
- 本轮未重新执行全部历史Run离线/数据库回读套件；保留既有证据，不将新增转染页面验收替代它们。

真机简短步骤：打开新版转染页 → 选siRNA，最终培养体积600µL、终浓度10nM、母液20µM → 检查取液0.3µL → 切换单管，确认A/B隐藏且要求重新填体积 → 输入完整方案 → 缩放至160%，检查名称、数值单位、表格及复制按钮可操作。
