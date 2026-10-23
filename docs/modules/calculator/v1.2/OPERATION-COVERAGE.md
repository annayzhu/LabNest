# Liquid operation coverage — v1.2

检查对象为当前注册的全部工具。`operations.ts` 的集中注册与 `v12-operations.test.ts` 的目录集合断言防止新增工具被静默漏检。此表是适配与模式清单；并非每种下拉排列都已进行浏览器测试。

| 工具 ID | 模式/选项 | 操作边界 | 验证 |
|---|---|---|---|
| hemocytometer | countRegion: standard, custom | not-applicable: counting only | 全仓单测 / 旧入口显式示例回归；所有模式的浏览器排列未执行 |
| seeding | single | adapter: batch and per-well | T24 / 既有铺板与孔板回归 |
| hydrogel | single | adapter: batch and per-well | 全仓单测 / 旧入口显式示例回归；所有模式的浏览器排列未执行 |
| split | areaMode: same, different | not-applicable: confluency estimate | 全仓单测 / 旧入口显式示例回归；所有模式的浏览器排列未执行 |
| freezing | single | adapter: batch and per-vial | 全仓单测 / 旧入口显式示例回归；所有模式的浏览器排列未执行 |
| transfection | complexMode: combined, two-tube | adapter: one/two-tube batch and dispensing | 全仓单测 / 旧入口显式示例回归；所有模式的浏览器排列未执行 |
| kill-curve | scale: linear, log | adapter: parallel additions and diluent | 全仓单测 / 旧入口显式示例回归；所有模式的浏览器排列未执行 |
| viability | single | adapter: final resuspension target | 全仓单测 / 旧入口显式示例回归；所有模式的浏览器排列未执行 |
| od600 | single | not-applicable: density estimate | 全仓单测 / 旧入口显式示例回归；所有模式的浏览器排列未执行 |
| cfu | single | not-applicable: colony count reference | 全仓单测 / 旧入口显式示例回归；所有模式的浏览器排列未执行 |
| colony-counter | single | not-applicable: image count | 全仓单测 / 旧入口显式示例回归；所有模式的浏览器排列未执行 |
| reagent-dosing | mode: final, add, fold, ratio, parts | adapter: dilution | T20–T21 / 既有单位及规划测试 |
| dilution | mode: final, add, fold, ratio, parts | adapter: final/add/fold/ratio | T20–T21 / 既有单位及规划测试 |
| fold-dilution | mode: final, add, fold, ratio, parts | adapter: dilution | T20–T21 / 既有单位及规划测试 |
| serial-dilution | gradientMode: geometric, linear, custom; volumeMode: mixed, retained; firstSource: prepared, stock | adapter: transfers and diluent | T25 / 梯度规划测试 |
| molarity | mode: mass, concentration, volume | adapter: final-volume target only | 全仓单测 / 旧入口显式示例回归；所有模式的浏览器排列未执行 |
| percent-solution | type: w/v, v/v, w/w | adapter: v/v liquid and make-up; w/v make-up; w/w masses | T01–T06, T15–T19, T22 |
| media-recipe | recipeMode: final, add | adapter: typed liquid rows and make-up | 全仓单测 / 旧入口显式示例回归；所有模式的浏览器排列未执行 |
| buffer-recipe | recipeMode: final, add | adapter: typed liquid rows and make-up | 全仓单测 / 旧入口显式示例回归；所有模式的浏览器排列未执行 |
| ic50-ec50 | concentrationUnit: , µM, nM, mg/mL, µg/mL, ng/mL, pg/mL; mode: inhibition, activation | not-applicable: analysis | 全仓单测 / 旧入口显式示例回归；所有模式的浏览器排列未执行 |
| master-mix | single | planner: per-group bulk, separate samples, dispensing | T07–T14, T19 |
| ligation | single | not-applicable: DNA mass only | 全仓单测 / 旧入口显式示例回归；所有模式的浏览器排列未执行 |
| tm | single | not-applicable: temperature estimate | 全仓单测 / 旧入口显式示例回归；所有模式的浏览器排列未执行 |
| dna-rna-conversion | type: dsDNA, ssDNA, RNA | not-applicable: quantity conversion | 全仓单测 / 旧入口显式示例回归；所有模式的浏览器排列未执行 |
| bradford-bca | concentrationUnit: , µM, nM, mg/mL, µg/mL, ng/mL, pg/mL | not-applicable: analysis | 全仓单测 / 旧入口显式示例回归；所有模式的浏览器排列未执行 |
| elisa-4pl | concentrationUnit: , µM, nM, mg/mL, µg/mL, ng/mL, pg/mL | not-applicable: analysis | 全仓单测 / 旧入口显式示例回归；所有模式的浏览器排列未执行 |
| wb-loading | bufferContainsReducingAgent: , no, yes; reducingMode: volume-fraction, target-concentration | adapter: each valid sample all components | T23 / WB UI及导出回归 |
| moi | titerUnit: PFU/mL, IU/mL, TU/mL, VG/mL | adapter: virus stock | 全仓单测 / 旧入口显式示例回归；所有模式的浏览器排列未执行 |
| virus-titer | mode: plaque, tcid50 | not-applicable: titer estimate | 全仓单测 / 旧入口显式示例回归；所有模式的浏览器排列未执行 |
| unit-converter | dimension: mass, volume, concentration, temperature | not-applicable: pure conversion | 全仓单测 / 旧入口显式示例回归；所有模式的浏览器排列未执行 |
| centrifuge | mode: rpm-to-rcf, rcf-to-rpm; radiusDefinition: entered, maximum, mean | not-applicable: speed conversion | 全仓单测 / 旧入口显式示例回归；所有模式的浏览器排列未执行 |
| resuspension | mode: amount, mass, mass-molar | adapter: make-up target | 全仓单测 / 旧入口显式示例回归；所有模式的浏览器排列未执行 |
| normalization | single | adapter: sample and diluent | 全仓单测 / 旧入口显式示例回归；所有模式的浏览器排列未执行 |

体积适配使用统一 quantities；质量不会转换为体积。定容单独使用 make-up-to，缺少固定取液量不声称完成设备检查。未知工具状态为 incomplete。预混由 mixPlan 直接返回操作；表格排序、显示单位或中英文文案不参与预混判定。

采用步进后只对采用量检查，理论量仍在比较表中。移液下限检查不等价于设备上限、精度或实验适用性验证。
