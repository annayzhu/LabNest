# Calculator v1.0–v1.3 统一总清单
基线：446bb9bf6ea5dd4f672bc5acd365dc8e4e3808b8。用户本轮反馈优先于历史通过记录。版本与最终执行结果以 ACCEPTANCE.md 及 evidence/acceptance-run.json 为准。通过项注明是单元断言、浏览器操作还是文件/数据库回读；不把自动化视口当作真机。
分类：A=已完成且有历史证据，保留并回归；B=已实现但缺本轮验证；C=未实现或用户反馈失败。
| 来源 / ID | 要求 | 核对分类 | 本轮状态 | 修改/验证与证据 |
|---|---|---|---|---|
| v1.0 / BASE-01 | 首页按类别展开 31 个模块，选择负担大 / 重做常用区、最近使用与可折叠的全部工具 | A | 通过 | 保留已有模式、数量和结构化输入；spec-acceptance.test.ts、refactor/legacy/ux-v13 浏览器日志。BASE-01 按 v1.3 更新为默认展开的六类 Bento。 |
| v1.0 / BASE-02 | 试剂加药、常规稀释、倍数稀释分散 / 合并为统一稀释能力下的模式 | A | 通过 | 保留已有模式、数量和结构化输入；spec-acceptance.test.ts、refactor/legacy/ux-v13 浏览器日志。BASE-01 按 v1.3 更新为默认展开的六类 Bento。 |
| v1.0 / BASE-03 | 多数单位为固定文字；加药暴露单位倍率 / 统一数量输入与单位转换，取消人工倍率字段 | A | 通过 | 保留已有模式、数量和结构化输入；spec-acceptance.test.ts、refactor/legacy/ux-v13 浏览器日志。BASE-01 按 v1.3 更新为默认展开的六类 Bento。 |
| v1.0 / BASE-04 | 按定义将所有字段一次性渲染 / 增加模式依赖、条件显示及对应校验 | A | 通过 | 保留已有模式、数量和结构化输入；spec-acceptance.test.ts、refactor/legacy/ux-v13 浏览器日志。BASE-01 按 v1.3 更新为默认展开的六类 Bento。 |
| v1.0 / BASE-05 | 摩尔浓度计算预先校验全部量，求质量也要求质量 / 只校验求解所需的已知量 | A | 通过 | 保留已有模式、数量和结构化输入；spec-acceptance.test.ts、refactor/legacy/ux-v13 浏览器日志。BASE-01 按 v1.3 更新为默认展开的六类 Bento。 |
| v1.0 / BASE-06 | 最近使用来自手动保存历史；收藏存在时不显示最近项 / 拆分工具访问状态、草稿和正式历史 | A | 通过 | 保留已有模式、数量和结构化输入；spec-acceptance.test.ts、refactor/legacy/ux-v13 浏览器日志。BASE-01 按 v1.3 更新为默认展开的六类 Bento。 |
| v1.0 / BASE-07 | 配方和反应组分要求输入逗号文本 / 使用结构化表格，保留粘贴/导入能力 | A | 通过 | 保留已有模式、数量和结构化输入；spec-acceptance.test.ts、refactor/legacy/ux-v13 浏览器日志。BASE-01 按 v1.3 更新为默认展开的六类 Bento。 |
| v1.0 / BASE-08 | 转染体积没有纳入核酸原液体积 / 核酸质量先由浓度转体积，再做总体积平衡 | A | 通过 | 保留已有模式、数量和结构化输入；spec-acceptance.test.ts、refactor/legacy/ux-v13 浏览器日志。BASE-01 按 v1.3 更新为默认展开的六类 Bento。 |
| v1.0 / BASE-09 | 连续稀释未明确起始管制备和转移后剩余体积 / 输出明确起点、来源、流出量和保留量 | A | 通过 | 保留已有模式、数量和结构化输入；spec-acceptance.test.ts、refactor/legacy/ux-v13 浏览器日志。BASE-01 按 v1.3 更新为默认展开的六类 Bento。 |
| v1.0 / BASE-10 | 部分负补液量以零截断后继续返回结果 / 返回不可行状态，不得作为有效配方写入 | A | 通过 | 保留已有模式、数量和结构化输入；spec-acceptance.test.ts、refactor/legacy/ux-v13 浏览器日志。BASE-01 按 v1.3 更新为默认展开的六类 Bento。 |
| v1.0 / NUM-01 | 1 mL切到μL再切回 / 1000 μL，再回到1 mL；量不变 | A | 通过 | 保留数量/计算引擎；src/lib/calculators/spec-acceptance.test.ts 对应编号断言；双时区日志。 |
| v1.0 / NUM-02 | 1 ng/μL转μg/mL / 1 μg/mL | A | 通过 | 保留数量/计算引擎；src/lib/calculators/spec-acceptance.test.ts 对应编号断言；双时区日志。 |
| v1.0 / NUM-03 | 10 mM母液→10 μM，最终2 mL / 母液2 μL；稀释液1998 μL | A | 通过 | 保留数量/计算引擎；src/lib/calculators/spec-acceptance.test.ts 对应编号断言；双时区日志。 |
| v1.0 / NUM-04 | NUM-03母液改显示为10000 μM / 结果与NUM-03一致 | A | 通过 | 保留数量/计算引擎；src/lib/calculators/spec-acceptance.test.ts 对应编号断言；双时区日志。 |
| v1.0 / NUM-05 | 100 mM母液→10 mM，最终1 mL / 母液100 μL，稀释液900 μL | A | 通过 | 保留数量/计算引擎；src/lib/calculators/spec-acceptance.test.ts 对应编号断言；双时区日志。 |
| v1.0 / NUM-06 | 已有不含该溶质液体1 mL，100 mM母液加至10 mM / 加111.111111… μL；最终1.111111… mL | A | 通过 | 保留数量/计算引擎；src/lib/calculators/spec-acceptance.test.ts 对应编号断言；双时区日志。 |
| v1.0 / NUM-07 | 10×→2×，最终100 mL / 母液20 mL，稀释液80 mL | A | 通过 | 保留数量/计算引擎；src/lib/calculators/spec-acceptance.test.ts 对应编号断言；双时区日志。 |
| v1.0 / NUM-08 | 1:1000稀释，最终10 mL / 母液10 μL，稀释液9990 μL | A | 通过 | 保留数量/计算引擎；src/lib/calculators/spec-acceptance.test.ts 对应编号断言；双时区日志。 |
| v1.0 / NUM-09 | 母液:稀释液=1:10，最终11 mL / 母液1 mL，稀释液10 mL；不得与十倍稀释混同 | A | 通过 | 保留数量/计算引擎；src/lib/calculators/spec-acceptance.test.ts 对应编号断言；双时区日志。 |
| v1.0 / NUM-10 | MW=58.44 g/mol，0.1 M，100 mL，求质量 / 0.5844 g；不要求质量输入 | A | 通过 | 保留数量/计算引擎；src/lib/calculators/spec-acceptance.test.ts 对应编号断言；双时区日志。 |
| v1.0 / NUM-11 | 2% w/v，最终50 mL / 称1 g，溶解后定容至50 mL | A | 通过 | 保留数量/计算引擎；src/lib/calculators/spec-acceptance.test.ts 对应编号断言；双时区日志。 |
| v1.0 / NUM-12 | 10% w/w，最终100 g / 溶质10 g，其他组分合计90 g；不得直接称为100 mL | A | 通过 | 保留数量/计算引擎；src/lib/calculators/spec-acceptance.test.ts 对应编号断言；双时区日志。 |
| v1.0 / NUM-13 | 引物25 nmol，目标100 μM / 最终体积250 μL | A | 通过 | 保留数量/计算引擎；src/lib/calculators/spec-acceptance.test.ts 对应编号断言；双时区日志。 |
| v1.0 / NUM-14 | 1000 bp dsDNA，66 ng/μL；长度模型明确采用660 g/mol/bp / 100 nM；标记估算模型 | A | 通过 | 保留数量/计算引擎；src/lib/calculators/spec-acceptance.test.ts 对应编号断言；双时区日志。 |
| v1.0 / NUM-15 | 四个大方格总细胞计数10,20,30,40；标准区；稀释2倍；活率80% / 总浓度500000 cells/mL；活浓度400000 cells/mL | A | 通过 | 保留数量/计算引擎；src/lib/calculators/spec-acceptance.test.ts 对应编号断言；双时区日志。 |
| v1.0 / NUM-16 | 直接录入活浓度400000 cells/mL / 不再乘一次活率 | A | 通过 | 保留数量/计算引擎；src/lib/calculators/spec-acceptance.test.ts 对应编号断言；双时区日志。 |
| v1.0 / NUM-17 | 活浓度2e6 cells/mL，24孔，每孔5e4细胞/500 μL，余量10% / 1.32e6细胞；原液0.66 mL；培养基12.54 mL；总13.2 mL | A | 通过 | 保留数量/计算引擎；src/lib/calculators/spec-acceptance.test.ts 对应编号断言；双时区日志。 |
| v1.0 / NUM-18 | 同上每孔5e4细胞/500 μL，但原浓度5e4 cells/mL / 原液需求超过总体积，返回不可行 | A | 通过 | 保留数量/计算引擎；src/lib/calculators/spec-acceptance.test.ts 对应编号断言；双时区日志。 |
| v1.0 / NUM-19 | 8样本×3重复＋2个对照反应，10%余量 / 实际26反应；预混配制28.6反应当量；不向上静默取整 | A | 通过 | 保留数量/计算引擎；src/lib/calculators/spec-acceptance.test.ts 对应编号断言；双时区日志。 |
| v1.0 / NUM-20 | 单反应20 μL：2×Mix 10、F 0.5、R 0.5、样本模板2、水7；26反应、预混余量10% / 预混514.8 μL：Mix286、F14.3、R14.3、水200.2；每反应分装18 μL预混＋2 μL独立模板；模板不汇成池 | A | 通过 | 保留数量/计算引擎；src/lib/calculators/spec-acceptance.test.ts 对应编号断言；双时区日志。 |
| v1.0 / NUM-21 | 转染单孔DNA2 μg，母液1 μg/μL；试剂3 μL/μg；总体积125 μL / DNA液2 μL，试剂6 μL，稀释液117 μL | A | 通过 | 保留数量/计算引擎；src/lib/calculators/spec-acceptance.test.ts 对应编号断言；双时区日志。 |
| v1.0 / NUM-22 | WB：2 μg/μL，目标20 μg，最终20 μL，4×Buffer，无其他组分 / 样品10 μL，Buffer5 μL，水5 μL | A | 通过 | 保留数量/计算引擎；src/lib/calculators/spec-acceptance.test.ts 对应编号断言；双时区日志。 |
| v1.0 / NUM-23 | WB：0.5 μg/μL，其余同NUM-22 / 需要样品40 μL，无法配成20 μL；不显示补水0为有效结果 | A | 通过 | 保留数量/计算引擎；src/lib/calculators/spec-acceptance.test.ts 对应编号断言；双时区日志。 |
| v1.0 / NUM-24 | 批量稀释：原浓度50和5 ng/μL；目标10 ng/μL；最终20 μL / 第一行4 μL样品＋16 μL稀释液；第二行浓度不足 | A | 通过 | 保留数量/计算引擎；src/lib/calculators/spec-acceptance.test.ts 对应编号断言；双时区日志。 |
| v1.0 / NUM-25 | 起始100 μM，2倍梯度，4点含起始点 / 100、50、25、12.5 μM；对照不计入四点 | A | 通过 | 保留数量/计算引擎；src/lib/calculators/spec-acceptance.test.ts 对应编号断言；双时区日志。 |
| v1.0 / NUM-26 | NUM-25每管混匀100 μL，逐级转移50 μL；第一管已备100 μL起始液 / 前三管最终各剩50 μL，末管100 μL；不得显示各剩100 μL | A | 通过 | 保留数量/计算引擎；src/lib/calculators/spec-acceptance.test.ts 对应编号断言；双时区日志。 |
| v1.0 / NUM-27 | NUM-25每管转移后均需保留100 μL，采用反向体积规划 / 各管混匀187.5、175、150、100 μL；逐次转移87.5、75、50 μL；后3管稀释液87.5、75、50 μL；各剩100 μL | A | 通过 | 保留数量/计算引擎；src/lib/calculators/spec-acceptance.test.ts 对应编号断言；双时区日志。 |
| v1.0 / NUM-28 | 半径10 cm，1000 rpm / 111.8 ×g；反向恢复1000 rpm | A | 通过 | 保留数量/计算引擎；src/lib/calculators/spec-acceptance.test.ts 对应编号断言；双时区日志。 |
| v1.0 / NUM-29 | 25 °C转换 / 77 °F；298.15 K | A | 通过 | 保留数量/计算引擎；src/lib/calculators/spec-acceptance.test.ts 对应编号断言；双时区日志。 |
| v1.0 / NUM-30 | 连接：载体5000 bp/50 ng，插入1000 bp，插入:载体3:1 / 插入片段30 ng | A | 通过 | 保留数量/计算引擎；src/lib/calculators/spec-acceptance.test.ts 对应编号断言；双时区日志。 |
| v1.0 / NUM-31 | 120菌落，稀释度1e−6，涂布100 μL / 1.2e9 CFU/mL | A | 通过 | 保留数量/计算引擎；src/lib/calculators/spec-acceptance.test.ts 对应编号断言；双时区日志。 |
| v1.0 / NUM-32 | 1e5细胞，目标MOI=2，功能性滴度1e8 TU/mL / 2 μL；只有模型适用时理论至少一次事件概率约86.4665% | A | 通过 | 保留数量/计算引擎；src/lib/calculators/spec-acceptance.test.ts 对应编号断言；双时区日志。 |
| v1.0 / NUM-33 | 所需纯溶质1 g，明确质量纯度80% / 称量1.25 g；保留纯度修正说明 | A | 通过 | 保留数量/计算引擎；src/lib/calculators/spec-acceptance.test.ts 对应编号断言；双时区日志。 |
| v1.0 / UX-01 | 新用户从Today找六个默认任务 / 每项最多两次点击进入输入，任务名含义清楚 | A | 通过 | navigation-icons：Today 实际两次点击进入六项表单 |
| v1.0 / UX-02 | 搜索抗体/铺板/ng每μL转nM / 命中适合的任务，旧名称也可命中 | A | 通过 | legacy：中文别名搜索；navigation-icons：英文搜索及清空恢复 |
| v1.0 / UX-03 | 收藏后继续使用其他工具 / 收藏顺序稳定，最近使用仍独立显示 | A | 通过 | appearance：收藏数量/顺序；navigation-icons：最近去重 |
| v1.0 / UX-04 | 求质量模式 / 不要求填写质量；切模式后仅校验已知量 | A | 通过 | spec-acceptance NUM-10；ux-v13 molarity 页面计算 |
| v1.0 / UX-05 | 算出结果后清空必需字段 / 有效结果立即失效，不可复制旧配方为新结果 | A | 通过 | ux-v13：必需输入失效后复制入口消失 |
| v1.0 / UX-06 | 输入值切单位 / 数值换算与结果一致，焦点不丢失 | A | 通过 | refactor 与 appearance：输入换算、20轮输出单位及历史字节比较 |
| v1.0 / UX-07 | 12孔上下文进入铺板 / 计为12孔；可查看关联；不重复乘板规格 | A | 通过 | plate：12个所选孔位上下文实测 |
| v1.0 / UX-08 | 计算后返回实验步骤 / 回到原步骤和位置，输入草稿保留 | A | 通过 | run-v12：原步骤、备注、参数草稿及计时恢复 |
| v1.0 / UX-09 | 从Excel粘贴批量样本，含无效行 / 保留顺序/ID并逐行指出错误，导出不伪造0用量 | A | 通过 | pipetting-v12：含无效行的样本/分组；导出实际解析 |
| v1.0 / UX-10 | 保存带表格结果后重载 / 恢复原表格、单位、警告和方法版本 | A | 通过 | refactor、legacy、integration：原快照与历史恢复 |
| v1.0 / UX-11 | 旧31个ID和预设打开 / 全部可达或有明确兼容入口；旧数据不丢失 | A | 通过 | legacy：31旧ID和旧倍数链接；原字节备份 |
| v1.0 / UX-12 | 缓存完成后断网重载基础计算页 / 页面与必要计算依赖可用；无法承诺时明确未通过 | A | 通过 | ux-v13：关闭标签后断网新开主页/工具；run-v12：缓存Run及图片 |
| v1.0 / UX-13 | 离线记入实验后重连，重复重放 / 最终只创建一条记录；权限/上下文失效有可处理反馈 | A | 通过 | integration、database：离线意图、重连、重复提交同一Result |
| v1.0 / UX-14 | 360px及390px手机宽度，键盘弹出 / 页面无横向溢出，当前输入可见，结果与动作可达 | B | 未执行 | 已通过360/390自动化视口；真机软键盘未执行，见MANUAL.md |
| v1.0 / UX-15 | 桌面侧栏、键盘导航、英文界面 / 焦点和返回正常，单位与翻译正确 | A | 通过 | appearance：键盘/焦点/帮助；navigation-icons：系统返回 |
| v1.0 / UX-16 | 加载示例后保存 / 明确示例状态，不能悄悄变成正式实验数据 | A | 通过 | refactor：示例不能保存正式记录；API拒绝伪造/失效上下文 |
| v1.1 / SAFE-01 | P0 / 旧数据备份失败后仍可能覆盖原历史 / 此前已复现；本轮静态核对历史基线 / 失败即保护写入，原字节可恢复，恢复流程可验证 | A | 通过 | v11-safety.test.ts、storage-appearance：读/备份/写失败、未来版本、跨标签冲突，原历史字节不变并可重试。 |
| v1.1 / WB-01 | P0 / 批量 WB 表和导出遗漏独立还原剂 / 此前已复现；本轮静态核对历史基线 / 所有组分完整，逐样本体积守恒 | A | 通过 | v11-safety、pipetting-v12 数值与边界断言；appearance、pipetting-v12、database、formal-exports 的UI、逐文件和数据库比较。 |
| v1.1 / PIP-01 | P0 / 移液下限提示漏检 mL 输出 / 此前已复现；本轮静态核对历史基线 / 按数量与操作语义检测，不按显示字符串或字段后缀猜测 | A | 通过 | v11-safety、pipetting-v12 数值与边界断言；appearance、pipetting-v12、database、formal-exports 的UI、逐文件和数据库比较。 |
| v1.1 / UNIT-01 | P1 / 结果单位不能直接切换 / 此前仅静态检查，仍需操作复核 / 结果显示可转换，物理量与历史不变 | A | 通过 | v11-safety、pipetting-v12 数值与边界断言；appearance、pipetting-v12、database、formal-exports 的UI、逐文件和数据库比较。 |
| v1.1 / COPY-01 | P1 / 复制结果不包含警告 / 此前仅静态检查，仍需操作复核 / 复制、导出、写入实验保留警告和关键假设 | A | 通过 | v11-safety、pipetting-v12 数值与边界断言；appearance、pipetting-v12、database、formal-exports 的UI、逐文件和数据库比较。 |
| v1.1 / HOME-01 | P1 / 六个常用入口紧凑、手机半屏可见 / 用户新增 / 3列×2行；图标＋短名称；测量与截图验收 | A | 通过 | appearance、visual-v11、navigation-icons：明暗/七配色、两种字体、独立密度、收藏迁移、帮助/焦点和真实图标故障。 |
| v1.1 / HELP-01 | P1 / 桌面 icon 悬停显示说明及建议 / 用户新增 / 鼠标、键盘、触屏均有可用帮助路径 | A | 通过 | appearance、visual-v11、navigation-icons：明暗/七配色、两种字体、独立密度、收藏迁移、帮助/焦点和真实图标故障。 |
| v1.1 / ICON-01 | P1 / Image Gen 生成代表性 icon，可切换套件 / 用户新增；本轮已生成参考稿 / 独立资源、稳定语义ID、套件清单与回退 | A | 通过 | integration、database、rejection、standalone-v11：真实隔离API/数据库/独立包，离线队列保留及重复提交检查。 |
| v1.1 / APP-01 | P1 / Settings 新增 Appearance / 用户新增；现有配色和字号模块可复用 / 配色／字体／图标套件三组统一设置 | A | 通过 | appearance、visual-v11、navigation-icons：明暗/七配色、两种字体、独立密度、收藏迁移、帮助/焦点和真实图标故障。 |
| v1.1 / VERIFY-01 | 发布验收门槛 / 构建、UI、离线、数据库及 CI 证据不足 / 上一轮未独立验证 / 对准确提交提供可重复证据；缺项明确标记 | B | 通过 | ACCEPTANCE.md、acceptance-run.json、生产构建与双时区日志；正式文件/数据库回读和实际CI均附准确版本，真机缺项在U04另列。 |
| v1.1 / S01 | 有旧历史；备份 `setItem` 抛出配额不足，随后普通写入恢复 / save仍拒绝覆盖；原始历史字节不变 | A | 通过 | v11-safety.test.ts、storage-appearance：读/备份/写失败、未来版本、跨标签冲突，原历史字节不变并可重试。 |
| v1.1 / S02 | 首次 `getItem` 抛错，随后保存被调用 / 不能将空状态写入原key | A | 通过 | v11-safety.test.ts、storage-appearance：读/备份/写失败、未来版本、跨标签冲突，原历史字节不变并可重试。 |
| v1.1 / S03 | 非法JSON或未知高版本 / 保护写入；不降级覆盖；可恢复原文 | A | 通过 | v11-safety.test.ts、storage-appearance：读/备份/写失败、未来版本、跨标签冲突，原历史字节不变并可重试。 |
| v1.1 / S04 | 迁移中途失败 / 原始历史与已有备份保留 | A | 通过 | v11-safety.test.ts、storage-appearance：读/备份/写失败、未来版本、跨标签冲突，原历史字节不变并可重试。 |
| v1.1 / S05 | 存储正常、原key确实不存在 / 正常首次保存，不误锁新用户 | A | 通过 | v11-safety.test.ts、storage-appearance：读/备份/写失败、未来版本、跨标签冲突，原历史字节不变并可重试。 |
| v1.1 / S06 | 用户重试，全部保护前置条件成功 / 旧历史完整恢复，后续新记录正常追加 | A | 通过 | v11-safety.test.ts、storage-appearance：读/备份/写失败、未来版本、跨标签冲突，原历史字节不变并可重试。 |
| v1.1 / S07 | 保护状态下切换图标／字体、工具或触发防抖保存 / 原历史不变 | A | 通过 | v11-safety.test.ts、storage-appearance：读/备份/写失败、未来版本、跨标签冲突，原历史字节不变并可重试。 |
| v1.1 / S08 | 另一个标签页修改了同一历史，当前页仍持有旧状态 / 检测变化并保留新数据，不静默回滚 | A | 通过 | v11-safety.test.ts、storage-appearance：读/备份/写失败、未来版本、跨标签冲突，原历史字节不变并可重试。 |
| v1.1 / V01 | S01–S08存储故障矩阵 / 原字节、恢复结果、保存返回值符合§2 | A | 通过 | v11-safety.test.ts、storage-appearance：读/备份/写失败、未来版本、跨标签冲突，原历史字节不变并可重试。 |
| v1.1 / V02 | §3合成WB条件 / 四项组分10/5/1/4 μL，总量20 μL | A | 通过 | v11-safety、pipetting-v12 数值与边界断言；appearance、pipetting-v12、database、formal-exports 的UI、逐文件和数据库比较。 |
| v1.1 / V03 | Buffer含还原剂／独立量0／无效行 / 无重复加入；无效值不伪装成0 | A | 通过 | v11-safety、pipetting-v12 数值与边界断言；appearance、pipetting-v12、database、formal-exports 的UI、逐文件和数据库比较。 |
| v1.1 / V04 | §4铺板例题，切换mL/μL/nL / 同一实际操作始终提示低于1 μL | A | 通过 | v11-safety、pipetting-v12 数值与边界断言；appearance、pipetting-v12、database、formal-exports 的UI、逐文件和数据库比较。 |
| v1.1 / V05 | 下限等值、0、负值、舍入为0、汇总量 / 警告与错误边界正确 | A | 通过 | v11-safety、pipetting-v12 数值与边界断言；appearance、pipetting-v12、database、formal-exports 的UI、逐文件和数据库比较。 |
| v1.1 / V06 | 2 μL↔0.002 mL↔2000 nL，20次往返 / 规范值不变，无累计舍入，警告稳定 | A | 通过 | v11-safety、pipetting-v12 数值与边界断言；appearance、pipetting-v12、database、formal-exports 的UI、逐文件和数据库比较。 |
| v1.1 / V07 | 从有警告结果复制、CSV、XLSX及保存实验 / 组分、单位、警告及必要假设完整 | A | 通过 | v11-safety、pipetting-v12 数值与边界断言；appearance、pipetting-v12、database、formal-exports 的UI、逐文件和数据库比较。 |
| v1.1 / V08 | 修改输入成无效值再点击复制／保存 / 不允许把旧结果作为新有效结果 | A | 通过 | v11-safety、pipetting-v12 数值与边界断言；appearance、pipetting-v12、database、formal-exports 的UI、逐文件和数据库比较。 |
| v1.1 / V09 | 查看旧快照后换主题、字体、单位 / 原快照字节／数据库内容不变；重算另建记录 | A | 通过 | v11-safety、pipetting-v12 数值与边界断言；appearance、pipetting-v12、database、formal-exports 的UI、逐文件和数据库比较。 |
| v1.1 / V10 | v1.0例题与31项旧入口回归 / 无功能消失，旧ID与收藏可解析 | A | 通过 | v11-safety、pipetting-v12 数值与边界断言；appearance、pipetting-v12、database、formal-exports 的UI、逐文件和数据库比较。 |
| v1.1 / U01 | 320×568、360×640、390×844首屏 / 六项3×2，无滚动／遮挡，底界满足半屏公式 | A | 通过 | appearance、visual-v11、navigation-icons：明暗/七配色、两种字体、独立密度、收藏迁移、帮助/焦点和真实图标故障。 |
| v1.1 / U02 | 桌面1440×900及中等内容宽度 / 6×1或3×2，无大说明卡；功能可直达 | A | 通过 | appearance、visual-v11、navigation-icons：明暗/七配色、两种字体、独立密度、收藏迁移、帮助/焦点和真实图标故障。 |
| v1.1 / U03 | 中文／英文，默认字体 / 短名称可识别；半屏预算均满足 | A | 通过 | appearance、visual-v11、navigation-icons：明暗/七配色、两种字体、独立密度、收藏迁移、帮助/焦点和真实图标故障。 |
| v1.1 / U04 | 最高160%缩放（替代旧200%）、大字号、横屏、真实手机键盘 / 允许滚动但无隐藏入口、重叠、输入遮挡 | B | 未执行 | 已完成工程与浏览器部分；原200%改为最高160%。桌面原生100→150%已检查；真机键盘/160%及人员试用未执行。见MANUAL.md。 |
| v1.1 / U05 | 鼠标hover、移入帮助、Escape / 说明与建议可读；关闭稳定 | A | 通过 | appearance、visual-v11、navigation-icons：明暗/七配色、两种字体、独立密度、收藏迁移、帮助/焦点和真实图标故障。 |
| v1.1 / U06 | Tab聚焦全部任务，Enter打开 / 帮助等价；焦点明显；不陷在tooltip | A | 通过 | appearance、visual-v11、navigation-icons：明暗/七配色、两种字体、独立密度、收藏迁移、帮助/焦点和真实图标故障。 |
| v1.1 / U07 | 手机使用说明面板 / 可打开关闭、焦点循环、返回触发项 | A | 通过 | appearance、visual-v11、navigation-icons：明暗/七配色、两种字体、独立密度、收藏迁移、帮助/焦点和真实图标故障。 |
| v1.1 / U08 | 两套icon切换并访问Today／工具标题 / 语义一致、位置尺寸不跳动、任务行为不变 | A | 通过 | appearance、visual-v11、navigation-icons：明暗/七配色、两种字体、独立密度、收藏迁移、帮助/焦点和真实图标故障。 |
| v1.1 / U09 | 缺图／损坏图／新任务无专用图 / 立即回退，名称和点击可用 | A | 通过 | appearance、visual-v11、navigation-icons：明暗/七配色、两种字体、独立密度、收藏迁移、帮助/焦点和真实图标故障。 |
| v1.1 / U10 | 8个历史收藏、少于6个、主动清空 / 不丢收藏，不擅自恢复默认；入口数量正确 | A | 通过 | appearance、visual-v11、navigation-icons：明暗/七配色、两种字体、独立密度、收藏迁移、帮助/焦点和真实图标故障。 |
| v1.1 / U11 | 改配色、模式、字体、字号，刷新／换页／新标签 / 页面与预览一致，偏好按作用域恢复 | A | 通过 | appearance、visual-v11、navigation-icons：明暗/七配色、两种字体、独立密度、收藏迁移、帮助/焦点和真实图标故障。 |
| v1.1 / U12 | 跟随系统变化及用户显式模式 / system跟随；explicit不被覆盖 | A | 通过 | appearance、visual-v11、navigation-icons：明暗/七配色、两种字体、独立密度、收藏迁移、帮助/焦点和真实图标故障。 |
| v1.1 / U13 | 旧theme/scale迁移，未知ID，存储抛错 / 兼容与回退；不误报已保存；不改历史 | A | 通过 | v11-safety.test.ts、storage-appearance：读/备份/写失败、未来版本、跨标签冲突，原历史字节不变并可重试。 |
| v1.1 / U14 | 恢复默认外观 / 仅外观重置；历史、收藏、文档和图表不变 | A | 通过 | appearance、visual-v11、navigation-icons：明暗/七配色、两种字体、独立密度、收藏迁移、帮助/焦点和真实图标故障。 |
| v1.1 / U15 | 加载前主题、字体回退、离线icon / 无阻断白屏；无明显反复闪烁；资源失败可用 | A | 通过 | appearance、visual-v11、navigation-icons：明暗/七配色、两种字体、独立密度、收藏迁移、帮助/焦点和真实图标故障。 |
| v1.1 / U16 | 每个方案×light/dark的关键预览组件 / 正文对比≥4.5:1，大字≥3:1，必要控件／焦点≥3:1；颜色不是唯一信号 | A | 通过 | appearance.test.ts 对七配色×明暗计算正文≥4.5与控件≥3对比；appearance、visual-v11、navigation-icons：明暗/七配色、两种字体、独立密度、收藏迁移、帮助/焦点和真实图标故障。 |
| v1.1 / I01 | 在线加载→计算与改单位→刷新恢复草稿 / UI及存储断言 | A | 通过 | integration、database、rejection、standalone-v11：真实隔离API/数据库/独立包，离线队列保留及重复提交检查。 |
| v1.1 / I02 | 首次在线并完成缓存→断网→刷新Calculator / 页面／资源能加载；可计算；说明只覆盖已缓存情况 | A | 通过 | integration、database、rejection、standalone-v11：真实隔离API/数据库/独立包，离线队列保留及重复提交检查。 |
| v1.1 / I03 | 离线记入指定实验与步骤→重连 / 队列状态；服务器记录完整；单位和警告存在 | A | 通过 | integration、database、rejection、standalone-v11：真实隔离API/数据库/独立包，离线队列保留及重复提交检查。 |
| v1.1 / I04 | 同一mutation重复发送／重载重放 / 数据库仅一条目标记录，关联ID正确 | A | 通过 | integration、database、rejection、standalone-v11：真实隔离API/数据库/独立包，离线队列保留及重复提交检查。 |
| v1.1 / I05 | 保存权限变化／步骤不存在／服务器拒绝 / 保留本地意图，显示原因，不假报同步成功 | A | 通过 | integration、database、rejection、standalone-v11：真实隔离API/数据库/独立包，离线队列保留及重复提交检查。 |
| v1.1 / I06 | WB从页面→复制／导出→实验记录 / 浏览器结果、下载文件解析和数据库回读一致 | A | 通过 | integration、database、rejection、standalone-v11：真实隔离API/数据库/独立包，离线队列保留及重复提交检查。 |
| v1.1 / I07 | standalone Calculator打开、单位切换、资源失败 / 与主应用计算与警告一致；偏好作用域明确 | A | 通过 | integration、database、rejection、standalone-v11：真实隔离API/数据库/独立包，离线队列保留及重复提交检查。 |
| v1.2 / PIP-12-01 | P0 / 结构化、可追踪的实际液体操作；不依赖展示文本判断步骤 | A | 通过 | operations-v12.test.ts、pipetting-v12/appearance 实际操作、CSV/XLSX警告与来源、database 回读；既有算法保留。 |
| v1.2 / PIP-12-02 | P0 / 百分浓度 v/v 的液体溶质检查；定容与加液语义区分 | A | 通过 | operations-v12.test.ts、pipetting-v12/appearance 实际操作、CSV/XLSX警告与来源、database 回读；既有算法保留。 |
| v1.2 / PIP-12-03 | P0 / Master Mix 批量加入、独立加样、预混分装、分组操作正确 | A | 通过 | operations-v12.test.ts、pipetting-v12/appearance 实际操作、CSV/XLSX警告与来源、database 回读；既有算法保留。 |
| v1.2 / PIP-12-04 | P0 / 所有液体工具覆盖清单、边界条件及舍入方案一致性 | A | 通过 | operations-v12.test.ts、pipetting-v12/appearance 实际操作、CSV/XLSX警告与来源、database 回读；既有算法保留。 |
| v1.2 / OUT-12-01 | P1 / 警告与假设贯穿页面、复制、导出、历史和实验记录 | A | 通过 | operations-v12.test.ts、pipetting-v12/appearance 实际操作、CSV/XLSX警告与来源、database 回读；既有算法保留。 |
| v1.2 / RUN-12-01 | P0（内容完整性） / 手机执行步骤完整显示富内容及表格；源内容、快照、步骤映射可追溯 | A | 通过 | run-step-content.test.ts；run-v12 实际富文本/表格/附件图片/工具栏；run-compat UI参数编辑及合成旧快照；run-offline 完整往返。 |
| v1.2 / RUN-12-02 | P1 / 计算器、计时器同排紧凑工具栏；触控和计时能力保持可用 | A | 通过 | run-step-content.test.ts；run-v12 实际富文本/表格/附件图片/工具栏；run-compat UI参数编辑及合成旧快照；run-offline 完整往返。 |
| v1.2 / RUN-12-03 | P1 / 通用计算器入口打开工具主页，返回恢复当前Run上下文 | A | 通过 | run-step-content.test.ts；run-v12 实际富文本/表格/附件图片/工具栏；run-compat UI参数编辑及合成旧快照；run-offline 完整往返。 |
| v1.2 / CI-12-01 | 工程验收门槛 / 双时区质量检查、生产构建和浏览器作业有真实运行结果 | A | 通过 | acceptance-run.json 与 logs：生产构建、双时区、独立数据库及浏览器执行，版本见 ACCEPTANCE.md。 |
| v1.2 / VERIFY-12-01 | 工程验收门槛 / 真实生产应用页面及独立工具入口验证 | A | 通过 | acceptance-run.json 与 logs：生产构建、双时区、独立数据库及浏览器执行，版本见 ACCEPTANCE.md。 |
| v1.2 / VERIFY-12-02 | 工程验收门槛 / 离线恢复、同步失败／重试、数据库回读 | A | 通过 | acceptance-run.json 与 logs：生产构建、双时区、独立数据库及浏览器执行，版本见 ACCEPTANCE.md。 |
| v1.2 / VERIFY-12-03 | 完整范围验收门槛 / 手机、最高160%缩放（替代旧200%）、帮助、Appearance及用户试用证据 | B | 未执行 | 桌面及移动视口回归已通过；原200%被160%替代；真机键盘/最高160%/人员试用未执行，见MANUAL.md。 |
| v1.2 / REG-12-01 | P1 / 已修复数据保护、WB、单位换算及外观行为无回归 | A | 通过 | operations-v12.test.ts、pipetting-v12/appearance 实际操作、CSV/XLSX警告与来源、database 回读；既有算法保留。 |
| v1.2 / T01 | 0.1% v/v，100 μL / 取溶质0.1 μL且报警；定容至100 μL不算一次固定加液 | A | 通过 | operations-v12.test.ts、pipetting-v12/appearance 实际操作、CSV/XLSX警告与来源、database 回读；既有算法保留。 |
| v1.2 / T02 | T01最终体积改用0.1 mL / 与T01物理量、操作及警告一致 | A | 通过 | operations-v12.test.ts、pipetting-v12/appearance 实际操作、CSV/XLSX警告与来源、database 回读；既有算法保留。 |
| v1.2 / T03 | 1% v/v，100 μL / 溶质1 μL，无低于下限警告 | A | 通过 | operations-v12.test.ts、pipetting-v12/appearance 实际操作、CSV/XLSX警告与来源、database 回读；既有算法保留。 |
| v1.2 / T04 | 0% v/v，100 μL / 溶质0，无低量警告 | A | 通过 | operations-v12.test.ts、pipetting-v12/appearance 实际操作、CSV/XLSX警告与来源、database 回读；既有算法保留。 |
| v1.2 / T05 | 1% w/v，100 μL / 称取0.001 g = 1 mg；不生成“溶质1 μL” | A | 通过 | operations-v12.test.ts、pipetting-v12/appearance 实际操作、CSV/XLSX警告与来源、database 回读；既有算法保留。 |
| v1.2 / T06 | 1% w/w，目标质量100 g / 溶质1 g、其他组分99 g；不推断移液体积 | A | 通过 | operations-v12.test.ts、pipetting-v12/appearance 实际操作、CSV/XLSX警告与来源、database 回读；既有算法保留。 |
| v1.2 / T07 | 第4.1节输入A / 酶10 μL批量加入，18 μL预混分装，模板2 μL独立加入；不误报0.1 μL | A | 通过 | operations-v12.test.ts、pipetting-v12/appearance 实际操作、CSV/XLSX警告与来源、database 回读；既有算法保留。 |
| v1.2 / T08 | A的反应数改为5 / 酶整批0.5 μL，必须报警；预混分装仍18 μL | A | 通过 | operations-v12.test.ts、pipetting-v12/appearance 实际操作、CSV/XLSX警告与来源、database 回读；既有算法保留。 |
| v1.2 / T09 | A的反应数改为10 / 酶整批1 μL，不低于下限 | A | 通过 | operations-v12.test.ts、pipetting-v12/appearance 实际操作、CSV/XLSX警告与来源、database 回读；既有算法保留。 |
| v1.2 / T10 | 第4.2节输入B / 酶11 μL；总预混1980 μL；分装100×18 μL；余180 μL | A | 通过 | operations-v12.test.ts、pipetting-v12/appearance 实际操作、CSV/XLSX警告与来源、database 回读；既有算法保留。 |
| v1.2 / T11 | A中模板改0.1 μL、水改9.8 μL / 独立模板0.1 μL报警；预混每孔19.9 μL，不以模板累计10 μL豁免 | A | 通过 | operations-v12.test.ts、pipetting-v12/appearance 实际操作、CSV/XLSX警告与来源、database 回读；既有算法保留。 |
| v1.2 / T12 | 100个20 μL反应：酶0.1、水0.4均预混；模板19.5独立 / 预混酶10 μL、水40 μL不报警；每孔预混分装0.5 μL必须报警 | A | 通过 | operations-v12.test.ts、pipetting-v12/appearance 实际操作、CSV/XLSX警告与来源、database 回读；既有算法保留。 |
| v1.2 / T13 | A配方分成A组100反应、B组5反应 / A组酶10 μL不报；B组0.5 μL报警；每组都有18 μL分装操作 | A | 通过 | operations-v12.test.ts、pipetting-v12/appearance 实际操作、CSV/XLSX警告与来源、database 回读；既有算法保留。 |
| v1.2 / T14 | 所有组分均独立加样，其中一项0.1 μL / 无空预混分装操作；0.1 μL独立加入报警 | A | 通过 | operations-v12.test.ts、pipetting-v12/appearance 实际操作、CSV/XLSX警告与来源、database 回读；既有算法保留。 |
| v1.2 / T15 | 实际体积分别为0.0001 mL／0.1 μL／100 nL / 判断相同；警告不因输出单位切换消失 | A | 通过 | operations-v12.test.ts、pipetting-v12/appearance 实际操作、CSV/XLSX警告与来源、database 回读；既有算法保留。 |
| v1.2 / T16 | 操作量0、1、1.1 μL / 均不报“低于1 μL”；0不表示已执行加样 | A | 通过 | operations-v12.test.ts、pipetting-v12/appearance 实际操作、CSV/XLSX警告与来源、database 回读；既有算法保留。 |
| v1.2 / T17 | 操作量0.9999 μL，展示可能显示1.00 / 仍按未舍入量报警；提示保留足够精度避免误导 | A | 通过 | operations-v12.test.ts、pipetting-v12/appearance 实际操作、CSV/XLSX警告与来源、database 回读；既有算法保留。 |
| v1.2 / T18 | 下限空、0、负数、非有限值 / 空为未设置；其余非法值报错，不静默采用默认值 | A | 通过 | operations-v12.test.ts、pipetting-v12/appearance 实际操作、CSV/XLSX警告与来源、database 回读；既有算法保留。 |
| v1.2 / T19 | 连续重算、切换中英及单位各20次 / 当前有效操作的警告数量和归属稳定，无累计重复 | A | 通过 | operations-v12.test.ts、pipetting-v12/appearance 实际操作、CSV/XLSX警告与来源、database 回读；既有算法保留。 |
| v1.2 / T20 | 10 mM母液配100 μM、最终90 μL；步进1 μL / 理论母液0.9 μL；采用1 μL母液＋89 μL稀释液后，当前操作不低于1 μL；实际111.111… μM，偏差+11.111…%，明确保留 | A | 通过 | operations-v12.test.ts、pipetting-v12/appearance 实际操作、CSV/XLSX警告与来源、database 回读；既有算法保留。 |
| v1.2 / T21 | 10 mM母液配10 μM、最终100 μL；步进1 μL / 理论母液0.1 μL舍入成0；阻止采用该方案 | A | 通过 | operations-v12.test.ts、pipetting-v12/appearance 实际操作、CSV/XLSX警告与来源、database 回读；既有算法保留。 |
| v1.2 / T22 | T01复制、CSV、保存历史、记入实验 / 均保留0.1 μL、1 μL下限、具体警告及定容语义 | A | 通过 | operations-v12.test.ts、pipetting-v12/appearance 实际操作、CSV/XLSX警告与来源、database 回读；既有算法保留。 |
| v1.2 / T23 | WB：浓度2 μg/μL，上样20 μg，总体积20 μL，4×Buffer，独立还原剂占最终体积5% / 样品10＋Buffer5＋还原剂1＋水4＝20 μL；操作及导出不缺项 | A | 通过 | operations-v12.test.ts、pipetting-v12/appearance 实际操作、CSV/XLSX警告与来源、database 回读；既有算法保留。 |
| v1.2 / T24 | 活细胞2×10⁶ cells/mL；24孔，每孔5×10⁴ cells及500 μL，余量10% / 细胞悬液660 μL＋培养基12540 μL＝13200 μL；实际24次500 μL分装，余1200 μL | A | 通过 | operations-v12.test.ts、pipetting-v12/appearance 实际操作、CSV/XLSX警告与来源、database 回读；既有算法保留。 |
| v1.2 / T25 | 梯度任务包含小于1 μL的“剩余量”，实际取液均≥1 μL / 不因剩余量报警；实际转移量若低于下限仍报警 | A | 通过 | operations-v12.test.ts、pipetting-v12/appearance 实际操作、CSV/XLSX警告与来源、database 回读；既有算法保留。 |
| v1.2 / T26 | 读取v1.1历史，随后切换字体和图标 / 旧结果、旧警告和记录ID保持不变；不追加计算历史 | A | 通过 | operations-v12.test.ts、pipetting-v12/appearance 实际操作、CSV/XLSX警告与来源、database 回读；既有算法保留。 |
| v1.2 / R01 | 新建实验，手机打开第一步 / 标题、正文、4行组分＋表头、所有列、单位、表下注释及其他源节点按顺序出现；不是纯文本摘要 | A | 通过 | run-step-content.test.ts；run-v12 实际富文本/表格/附件图片/工具栏；run-compat UI参数编辑及合成旧快照；run-offline 完整往返。 |
| v1.2 / R02 | 第二步主要内容为材料表；同名步骤切换 / 表格不因没有description而隐藏；按步骤ID显示正确内容，无跨组串表 | A | 通过 | run-step-content.test.ts；run-v12 实际富文本/表格/附件图片/工具栏；run-compat UI参数编辑及合成旧快照；run-offline 完整往返。 |
| v1.2 / R03 | 320×568、360×640、390×844，宽表／长表 / 表内可横向滚动至最后列，纵向能读到最后行，字号可读，页面不横向溢出、内容不截断 | A | 通过 | run-step-content.test.ts；run-v12 实际富文本/表格/附件图片/工具栏；run-compat UI参数编辑及合成旧快照；run-offline 完整往返。 |
| v1.2 / R04 | 共用准备块、独立确认清单、参数化表格 / 公共内容可见，原确认项独立；参数在正确单元格解析，未解析项不静默变空 | A | 通过 | run-step-content.test.ts；run-v12 实际富文本/表格/附件图片/工具栏；run-compat UI参数编辑及合成旧快照；run-offline 完整往返。 |
| v1.2 / R05 | 新Run创建后编辑Protocol库；再打开该Run / 原实验继续显示其版本／快照内容；原步骤ID、完成及计时状态不改变 | A | 通过 | run-step-content.test.ts；run-v12 实际富文本/表格/附件图片/工具栏；run-compat UI参数编辑及合成旧快照；run-offline 完整往返。 |
| v1.2 / R06 | 有同版本富内容的旧Run和仅有文字的旧Run / 前者可恢复且关联不变；后者保留原文并明确格式缺失，不伪造表格 | A | 通过 | run-step-content.test.ts；run-v12 实际富文本/表格/附件图片/工具栏；run-compat UI参数编辑及合成旧快照；run-offline 完整往返。 |
| v1.2 / R07 | 三个宽度下查看辅助工具栏 / 计算器和计时器默认同排，短标签清楚、触控区≥44×44 px；打开面板不误提交表单 | A | 通过 | run-step-content.test.ts；run-v12 实际富文本/表格/附件图片/工具栏；run-compat UI参数编辑及合成旧快照；run-offline 完整往返。 |
| v1.2 / R08 | 首次进入、曾使用稀释后再次进入计算器 / 都先到工具主页，可选任意任务；不自动打开稀释或上次工具 | A | 通过 | run-step-content.test.ts；run-v12 实际富文本/表格/附件图片/工具栏；run-compat UI参数编辑及合成旧快照；run-offline 完整往返。 |
| v1.2 / R09 | 从非第一步进入主页，再进任意工具并记入实验 / 原实验和步骤上下文贯穿，结果仅关联正确位置；“返回实验”回到原步骤 | A | 通过 | run-step-content.test.ts；run-v12 实际富文本/表格/附件图片/工具栏；run-compat UI参数编辑及合成旧快照；run-offline 完整往返。 |
| v1.2 / R10 | 输入未保存偏差备注并启动计时，再往返计算器 / 备注和未提交状态保留，完成状态不被自动提交；计时按真实经过时间恢复，不重置或重复创建 | A | 通过 | run-step-content.test.ts；run-v12 实际富文本/表格/附件图片/工具栏；run-compat UI参数编辑及合成旧快照；run-offline 完整往返。 |
| v1.2 / R11 | 缓存条件下离线往返、刷新、同步重试 / 内容／草稿在支持范围内恢复，待同步明确，恢复网络不重复写入；资源缺失有提示 | A | 通过 | run-step-content.test.ts；run-v12 实际富文本/表格/附件图片/工具栏；run-compat UI参数编辑及合成旧快照；run-offline 完整往返。 |
| v1.2 / R12 | 真机键盘、真实最高160%缩放（替代旧200%）、桌面回归 / 放大后全部内容可读可达，工具可操作；表格最后行和列可访问；桌面侧栏、步骤确认及计时器无回归 | B | 未执行 | 桌面及移动视口回归已通过；原200%被160%替代；真机键盘/最高160%/人员试用未执行，见MANUAL.md。 |
| v1.3 / CP-01 | PC受支持浏览器点击复制后粘贴 / 结果/单位/来源/警告完整，仅成功时显示已复制 | C | 通过 | ux-v13：真实系统剪贴板经键盘粘贴到另一个可编辑文本框，保存clipboard-pasted.txt。 |
| v1.3 / CP-02 | 真机Safari/Chrome（按实有设备注明） / 点击可复制；不支持环境的降级真实可用 | B | 未执行 | 无可用真机，Safari/Chrome真机复制未执行，见MANUAL.md。 |
| v1.3 / CP-03 | 拒绝权限/API不存在 / 不崩溃，不假成功，完整文本能全选/手动复制 | C | 通过 | ux-v13、appearance：API不存在/拒绝、兼容复制与手动全选；失败不显示已复制。 |
| v1.3 / CP-04 | 含批量表、无效行和警告 / 与可见结果和导出内容含义一致 | C | 通过 | ux-v13、pipetting-v12、formal-exports：来源/无效行/警告，下载文件逐单元格或快照比较。 |
| v1.3 / CA-01 | 联网完成离线准备后断网重新打开 / 主页、已声明缓存工具、资源与草稿可用 | C | 通过 | ux-v13：明确准备主页和当前工具，断网重新进入并计算；Run附件也缓存。 |
| v1.3 / CA-02 | 缓存后关闭标签再离线打开 / 验证重新导航，而非停留在已渲染页 | C | 通过 | ux-v13：关闭标签后断网，新标签重新打开主页→已准备工具。 |
| v1.3 / CA-03 | 某必要资源失败/容量不足/超时 / 不显示完整成功，提示原因可重试，旧缓存可用 | C | 通过 | offline-worker.test.ts：404/配额/MIME/超时失败保留旧缓存；offline.test.ts：环境/注册与激活超时清理；浏览器正常缓存流程。故障注入层级明确。  cache-clear-report.json：负应答在真实页面显示失败，重试实际成功；worker失败清理不中断后续请求。 |
| v1.3 / CA-04 | 新版部署、旧缓存或丢失缓存 / 版本一致，不白屏，不丢历史 | C | 通过 | cache-upgrade.json：实际旧部署经只读临时代理准备v4；资源503失败后离线旧页计算；重试成功才发布v5、移除v4。worker单元另验证回收/并发。未更新在用部署。 |
| v1.3 / CA-05 | 清除工具缓存/换账号 / 不误删草稿；不展示前账号Run数据 | C | 通过 | ux-v13：清除缓存前后历史/草稿原字节比较。仓库无账号/退出功能，账户切换子项不适用；缓存仍按站点工作区共享。 |
| v1.3 / NV-01 | 普通目录→工具→返回 / 唯一主返回，可点击，目录位置恢复 | C | 通过 | navigation-icons：搜索→工具→主返回、清空恢复过滤前位置，系统返回。 |
| v1.3 / NV-02 | Run→目录→工具→目录→Run / 步骤、备注、计时状态连续保留 | C | 通过 | run-v12：Run→主页→具体工具→主页→原Run，备注、未提交参数、计时和步骤保持。 |
| v1.3 / NV-03 | 深链接、系统返回、弱网返回 / 有合理回退，不卡在保存请求、不误跳外站 | C | 通过 | legacy 深链接；navigation-icons 系统返回；run-offline 断网返回；performance/trace-report.json 弱网打开。弱网返回由最终性能回归记录。 |
| v1.3 / UI-01 | PC首页 / 六块分类，31项完整，无大段重复说明；记录首屏数量 | C | 通过 | ux-v13：1366/1440/1920明暗截图及实际首屏数量，六分类31项。 |
| v1.3 / UI-02 | 手机首页默认设置 / 常用3×2半屏内，入口清楚，分类紧凑 | C | 通过 | appearance：320/360/390中英；ux-v13：360/390/430，常用区半屏几何测量。 |
| v1.3 / UI-03 | 最近使用含旧摘要 / 说明不重复，真实摘要保留，语言切换正确 | C | 通过 | navigation-icons：旧别名中英文摘要去重，不渲染重复说明，保留真实摘要。 |
| v1.3 / UI-04 | 所有31工具默认及错误状态 / 标题图标同排，字段统一，错误/单位完整 | C | 通过 | ux-v13：30表单默认/错误/结果/导出与31标题；colony-v13：实际图片及无效文件保护。 |
| v1.3 / UI-05 | 批量表格、长名称、160% / 局部滚动可用，不裁掉输入/单位/按钮 | B | 未执行 | 已通过自动化批量表与大字号、桌面原生150%；精确160%及真机未执行，见MANUAL.md。 |
| v1.3 / UI-06 | 返回/帮助/固定/复制 / 图标居中，点击区足够，键盘焦点可见 | C | 通过 | appearance、compact-ui、ux-v13：键盘焦点、帮助与按钮尺寸；TaskHelp仅显示当前气泡。 |
| v1.3 / PF-01 | 31工具扫描＋最慢项轨迹 / 有测量记录，前后对比，无以隐藏等待冒充性能提升 | C | 通过 | performance-before/after.json：31×10原始样本，包含打开/输入/计算/草稿/返回；performance目录保存冷开/弱网和浏览器时间线。 |
| v1.3 / IC-01 | 实验套件全入口检查 / 31项均有映射，25张新增资源接入，失败回退可用 | C | 通过 | 25原图保留、31个128px派生资产；navigation-icons检查31映射与31种线性回退；standalone-v11离线包。 |
| v1.3 / IC-02 | 深浅/32px/40px/离线/独立包 / 主体清楚，不跳布局，无资源404 | C | 通过 | icons/report.json和28张七配色明暗32/40px实页图；standalone-v11及ux-v13离线资源；尺寸压力不是缩放替代。 |
| v1.3 / RG-01 | 已修复数值例题 / WB四组分20µL；并行梯度来源原母液；预混批量检查及百分浓度取液警告保持 | A | 通过 | spec-acceptance、operations-v12、pipetting-v12：WB/并行来源/预混/百分浓度原算法回归；正式文件与DB回读。 |
| v1.3 / RG-02 | Run表A/表B与旧快照 / 不串表，不丢富文本内容，草稿恢复保持 | A | 通过 | run-v12、run-compat、run-offline：不串表，合成旧快照恢复，未提交内容与附件图片。 |
| v1.3 / RG-03 | 工程验证 / 双时区、类型检查、lint、生产构建和相关浏览器流程；提交完整证据 | C | 通过 | 最终工程与CI状态见ACCEPTANCE.md、acceptance-run.json及完整logs。 |

## 跨版本遗留项
| 项目 | 分类 | 状态 | 边界 |
|---|---|---|---|
| 参数编辑后真实 Run 表格显示 | C | 通过 | RunParameterEditor/actions.ts；UI修改为12并独立DB回读，未解析占位保留 |
| 全部正式导出逐文件核对 | B | 通过 | 工具CSV/XLSX 60文件；Result CSV/XLSX/JSON逐字段；PDF逐页渲染，见formal-exports |
| 完整离线往返、重连及幂等回读 | B | 通过 | 合成隔离库真实 API；integration/database/run-offline |
| 旧 Run/快照兼容 | A | 通过 | 合成旧记录；未读取生产旧记录，run-compat |
| 真机键盘 / PC与手机真实160% / 人员试用 | B | 未执行 | 无可用设备及人员时交付操作步骤；不使用200%旧门槛 |
| 三套完整皮肤 | C | 未执行 | v1.3明确排除扩展；仍待视觉稿，不遗漏历史事项 |

## 用户追加：转染材料与单/双管配制

TF-01—TF-13 的统一补充清单、来源、截图和回归结果见 [转染验收](evidence/transfection/README.md)。本批覆盖材料形式、DNA质量/摩尔比、siRNA每种/总量与最终体积、独立配制模式、试剂与辅助试剂依据、处理组隔离、余量、复制/导出及旧请求兼容。真机160%及实验人员试用仍为未执行。此前复制与最近使用补充见 [验收记录](evidence/copy-recent/ACCEPTANCE.md)。这些补充不关闭未执行的历史现场验收项目。
