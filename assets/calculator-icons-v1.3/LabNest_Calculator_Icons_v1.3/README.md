# LabNest Calculator 图标补充包 v1.3

此包包含25张通过内置Image Gen逐项生成的独立PNG原图。已有6张图标未替换，应用代码未修改。

## 内容

- icons/：按稳定工具id命名的25张原图，未裁剪或重绘。
- manifest.json：名称、映射、尺寸、透明度检查、校验和、生成方式与完整提示词。
- preview.html：解压后用浏览器打开，检查144px预览及32/40px深浅底效果。

## 接入

请结合 LabNest_Calculator_UX_Codex_Spec_v1.3.md 第9节执行。原图供资产保存与派生使用，正式网页应通过构建流程生成128/256px优化资源，不能直接加载全部大原图。检查小尺寸细节、主体占比与已有六张图标风格是否协调，并更新task-presentation、manifest、Appearance覆盖范围及离线/独立工具包。

这些图案用于辨识工具，不是实验数据、定量曲线或可用于实验操作的科学示意图。文件齐全与具有透明通道不代表视觉验收或网页集成已通过。

## 映射

| 工具id | 中文名称 | 文件 |
|---|---|---|
| hemocytometer | 血球计数板 | icons/hemocytometer.png |
| hydrogel | 水凝胶培养 | icons/hydrogel.png |
| split | 细胞传代 | icons/split.png |
| freezing | 细胞冻存 | icons/freezing.png |
| transfection | 转染体系 | icons/transfection.png |
| kill-curve | 杀灭曲线 | icons/kill-curve.png |
| viability | 细胞活率 | icons/viability.png |
| od600 | OD600菌液浓度 | icons/od600.png |
| cfu | 菌落形成单位 | icons/cfu.png |
| colony-counter | 菌落辅助计数 | icons/colony-counter.png |
| serial-dilution | 梯度稀释 | icons/serial-dilution.png |
| percent-solution | 百分比溶液 | icons/percent-solution.png |
| media-recipe | 培养基配方 | icons/media-recipe.png |
| buffer-recipe | 缓冲液配方 | icons/buffer-recipe.png |
| ic50-ec50 | IC50 EC50拟合 | icons/ic50-ec50.png |
| ligation | 连接反应 | icons/ligation.png |
| tm | 引物Tm | icons/tm.png |
| dna-rna-conversion | DNA RNA换算 | icons/dna-rna-conversion.png |
| bradford-bca | 蛋白定量 | icons/bradford-bca.png |
| elisa-4pl | ELISA拟合 | icons/elisa-4pl.png |
| moi | 感染复数 | icons/moi.png |
| virus-titer | 病毒滴度 | icons/virus-titer.png |
| unit-converter | 单位换算 | icons/unit-converter.png |
| resuspension | 试剂复溶 | icons/resuspension.png |
| normalization | 浓度归一化 | icons/normalization.png |