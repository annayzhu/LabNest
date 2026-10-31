/** Chinese for the samples module (S1–S16); spread first into zhUi, so an existing translation of the same text wins. */
export const samplesZh: Record<string, string> = {
  // Navigation, list and filters
  "Sample sections": "样本分区",
  "Boxes": "盒子",
  "Code, name, origin, external ID…": "编号、名称、来源、外部编号…",
  "types": "类型",
  "statuses": "状态",
  "places": "位置",
  "projects": "项目",
  "batch": "批次",
  "This batch": "本批",
  "No project": "不属于项目",
  "Recently added": "最近添加",
  "Code A–Z": "编号 A–Z",
  "Name A–Z": "名称 A–Z",
  "By place": "按位置",
  "New samples": "新建样本",
  "No samples match this view.": "没有符合条件的样本。",
  "No samples yet. Add them with New samples, or register what an experiment produced.": "还没有样本。可以点“新建样本”，或在实验里登记产出。",
  "Origin": "来源",
  "Parent sample": "母样本",
  "Place": "位置",
  "Amount": "体积/量",
  "Concentration": "浓度",
  "Produced by": "来源实验",
  "Previous": "上一页",
  "Next": "下一页",
  "Pages": "分页",
  "In storage": "在库",
  "Used up": "已用完",
  "Discarded": "已丢弃",
  "Sent out": "已转出",
  "Not placed": "未放置",
  "samples": "个样本",
  // Batches
  "Batch saved": "本批已保存",
  "Undo this batch": "撤销本批",
  "Undo this batch?": "撤销本批？",
  "Undo": "撤销",
  "Some of these samples are already used, so the batch can no longer be undone.": "本批中已有样本被使用或派生，不能再整批撤销。",
  // Bulk actions
  "Change status…": "改状态…",
  "Move to a box…": "移到盒子…",
  "Change project…": "改项目…",
  "Start position": "起始位置",
  "Move to": "移到",
  "Change the status of the selected samples?": "修改所选样本的状态？",
  "Move the selected samples?": "移动所选样本？",
  "Change the project of the selected samples?": "修改所选样本的项目？",
  "Delete the selected samples?": "删除所选样本？",
  "Already in this project.": "已在这个项目中。",
  "Already has this status.": "已是这个状态。",
  "Only samples in storage have a place.": "只有在库样本有位置。",
  // New samples table
  "Register outputs": "登记产出",
  "Aliquot": "分装",
  "Aliquot…": "分装…",
  "Outputs of": "产出自",
  "Aliquots of": "分装自",
  "Mark the parent as used up": "母样本标为已用完",
  "Type for new rows": "新行的类型",
  "Add row": "加一行",
  "Generate rows…": "按规则生成…",
  "Paste from Excel…": "从 Excel 粘贴…",
  "Import a file…": "导入文件…",
  "Import a file": "导入文件",
  "Place in a box…": "放入盒子…",
  "Fill from a result table…": "从结果表带入…",
  "Download the template": "下载模板",
  "How many": "数量",
  "Name before the number": "编号前的名称",
  "First number": "起始数字",
  "Digits": "位数",
  "After the number": "数字后的名称",
  "e.g.": "例如",
  "Add rows": "添加",
  "Codes are given from the type’s prefix when saved (RNA-0001…); type your own in the Code column to keep them.": "保存时按类型前缀自动编号（RNA-0001…）；在“编号”列手填的编号会保留。",
  "Pasted table": "粘贴的表格",
  "Copy cells from Excel with their header row and paste them here.": "从 Excel 连同表头一起复制，粘贴到这里。",
  "Read the table": "读取表格",
  "Skip": "不导入",
  "Add these rows": "加入这些行",
  "Replace the table": "替换表格",
  "Back": "返回",
  "Column": "列",
  "Box": "盒子",
  "From position": "起始位置",
  "Place them": "放入",
  "Only rows without a position": "只填还没有位置的行",
  "Positions are filled row by row, skipping those already held. A box without rows and columns takes the samples without positions; set its size under Boxes.": "按行依次填入空位，跳过已占用的格子。没有设置行列的盒子只记盒子不记位置；可在“盒子”页设置规格。",
  "Result table": "结果表",
  "Fill in": "带入",
  "Rows are matched by name to the table’s sample column (by order when it has none); concentration, volume, box, position and the type’s fields are filled in. The two records are kept separately afterwards.": "按名称与结果表的样本列对应（没有样本列时按顺序），带入浓度、体积、盒子、位置和类型字段。带入后两边各自保存，之后不自动同步。",
  "Name *": "名称 *",
  "Unit": "单位",
  "BSL": "生物安全等级",
  "Remove row": "删除这一行",
  "rows": "行",
  "Check": "检查",
  "Save samples": "保存样本",
  "auto": "自动",
  "The file is over 10 MB.": "文件超过 10 MB。",
  "The file could not be read.": "文件读取失败。",
  // Checks
  "Name is required.": "名称必填。",
  "Choose a sample type.": "请选择样本类型。",
  "The storage location no longer exists.": "这个库位已不存在。",
  "Choose a box for the position.": "填了位置，请选择盒子。",
  "Amount must be a number of 0 or more.": "体积/量须为不小于 0 的数字。",
  "Concentration must be a number of 0 or more.": "浓度须为不小于 0 的数字。",
  "Give the amount a unit.": "请填写体积/量的单位。",
  "Give the concentration a unit.": "请填写浓度单位。",
  "Date must be like 2026-10-31.": "日期格式应为 2026-10-31。",
  "Biosafety level must be BSL-1, BSL-2 or BSL-3.": "生物安全等级须为 BSL-1、BSL-2 或 BSL-3。",
  "Add at least one sample.": "至少添加一个样本。",
  "One batch holds at most 500 samples.": "一批最多 500 个样本。",
  "Another save took one of these codes or positions just now; check again.": "其他人刚刚占用了其中的编号或位置，请重新检查。",
  "The samples could not be checked.": "样本检查失败。",
  "The samples could not be saved.": "样本保存失败。",
  "A sample cannot descend from itself.": "样本不能以自己或自己的下游为母样本。",
  "Code is required.": "编号必填。",
  "Another sample already has this code or position.": "已有其他样本使用了这个编号或位置。",
  "The parent sample no longer exists.": "母样本已不存在。",
  // Detail, edit and delete
  "Biosafety level": "生物安全等级",
  "External sample bank": "外部样本库",
  "Lineage": "谱系",
  "Derived samples": "派生样本",
  "No samples derived from this one yet.": "还没有由它派生的样本。",
  "Experiments": "实验",
  "Took": "取用",
  "Not in any experiment yet.": "还没有用于实验。",
  "History": "历史",
  "Created": "创建",
  "Edited": "编辑",
  "Amount taken": "取用",
  "Aliquoted": "分装",
  "Box size set": "设置盒子规格",
  "Deleted": "删除",
  "Amount unit": "体积/量单位",
  "Concentration unit": "浓度单位",
  "Fields": "字段",
  "This sample cannot be deleted": "这个样本不能删除",
  "Delete this sample?": "删除这个样本？",
  "Type the code to confirm": "输入编号以确认",
  "This sample no longer exists.": "这个样本已不存在。",
  "The sample could not be saved.": "样本保存失败。",
  "The sample could not be deleted.": "样本删除失败。",
  "A sample that is not in storage has no place; saving frees its position.": "不在库的样本没有位置；保存后会腾出原来的格位。",
  "Choose a status.": "请选择状态。",
  // Types
  "Sample types": "样本类型",
  "Code prefix": "编号前缀",
  "Tissue": "组织",
  "Whole blood": "全血",
  "Serum": "血清",
  "Plasma": "血浆",
  "Cells": "细胞",
  "Genomic DNA": "基因组 DNA",
  "Protein lysate": "蛋白裂解液",
  "Other": "其他",
  "Site": "部位",
  "Pathology": "病理类型",
  "Preservation": "保存方式",
  "Frozen": "冻存",
  "Fresh": "新鲜",
  "Anticoagulant": "抗凝剂",
  "Heparin": "肝素",
  "Sodium citrate": "枸橼酸钠",
  "Cell count": "细胞数",
  "Type name is required.": "类型名称必填。",
  "This sample type no longer exists.": "这个样本类型已不存在。",
  "Offered for new samples again.": "新建样本时重新可选。",
  "No longer offered for new samples.": "新建样本时不再可选。",
  "The sample type could not be saved.": "样本类型保存失败。",
  "The sample type could not be changed.": "样本类型修改失败。",
  "The sample type could not be deleted.": "样本类型删除失败。",
  "Saved.": "已保存。",
  "Deleted.": "已删除。",
  // Boxes
  "No storage locations yet. Add freezers, shelves and boxes under Inventory · Storage locations; samples share them.": "还没有库位。请在“库存 · 库位”中添加冰箱、架子和盒子，样本与库存共用。",
  "Storage locations": "库位",
  "List": "清单",
  "Box size": "盒子规格",
  "Rows": "行",
  "Columns": "列",
  "Set the box size to see it as a grid and place samples at A1-style positions.": "设置行列后按格子显示，样本位置写成 A1。",
  "Here without a position": "在这里但没有位置",
  "Samples here": "这里的样本",
  "This storage location no longer exists.": "这个库位已不存在。",
  "Box size cleared.": "已清除盒子规格。",
  "The box size could not be saved.": "盒子规格保存失败。",
  // Experiment: 实验设置与样本
  "Samples used": "使用的样本",
  "Samples produced": "产出的样本",
  "Groups": "分组",
  "Choose samples…": "选择样本…",
  "Groups…": "分组…",
  "Plate layout…": "排板…",
  "The plate planner opens with this experiment’s samples, grouped and in order. Back up the project there and attach the file here; wells that name a sample show beside it.": "排板工具打开时已带入本实验的样本（按组和顺序）。在工具里“备份项目”后把文件附到这里，样本旁会显示它所在的孔。",
  "qPCR plate planner": "qPCR 排板工具",
  "CNV plate planner": "CNV 排板工具",
  "Set group…": "设为分组…",
  "Set group": "设为分组",
  "New group…": "新分组…",
  "New group": "新分组",
  "No group": "不分组",
  "Group name": "分组名称",
  "Remove": "移除",
  "Remove the selected samples from this experiment?": "把所选样本从本实验中移除？",
  "What their use took is given back to them.": "已扣减的用量会退回样本。",
  "Select all": "全选",
  "Wells": "孔位",
  "Used": "用量",
  "Order": "顺序",
  "Move up": "上移",
  "Move down": "下移",
  "No samples chosen yet.": "还没有选择样本。",
  "Choose them from the sample list, by pasting codes, or a whole box.": "可以从样本清单中选择、粘贴编号，或整盒选入。",
  "Not found": "没有找到",
  "Several samples have this name; use its code": "有多个样本同名，请用编号",
  "Search": "搜索",
  "Paste codes": "粘贴编号",
  "Whole box": "整盒",
  "Codes or names": "编号或名称",
  "Add": "添加",
  "One code or name per line, or separated by commas. A name several samples share needs its code.": "每行一个编号或名称，或用逗号分隔。多个样本同名时请用编号。",
  "Search samples": "搜索样本",
  "Code, name, origin…": "编号、名称、来源…",
  "All types": "全部类型",
  "Choose a box…": "选择盒子…",
  "All places": "全部位置",
  "Show the box": "显示整盒",
  "Add selected": "添加所选",
  "No samples found.": "没有找到样本。",
  "Design groups (control / treated, tumour / normal). They do not split the Protocol’s steps; a run that needs different systems per group sets that up in its preparation.": "设计分组（对照/处理、肿瘤/癌旁）。分组不拆分规程步骤；各组需要不同体系时，在运行准备里设置多个组。",
  "Remove group": "删除分组",
  "Add group": "加分组",
  "Save groups": "保存分组",
  "Or paste two columns from Excel: sample (code or name) and group. Groups are created as named.": "或从 Excel 粘贴两列：样本（编号或名称）和分组；没有的分组会自动建立。",
  "Sample and group": "样本和分组",
  "Assign groups": "分配分组",
  "Groups saved.": "分组已保存。",
  "Use cleared.": "已清除用量。",
  "Recorded; the units do not compare with the sample's, so nothing was subtracted.": "已记录；单位与样本的不同，没有扣减余量。",
  "This Experiment is locked; its samples cannot change.": "这个实验已锁定，样本不能修改。",
  "Choose samples to add.": "请选择要添加的样本。",
  "Choose samples to remove.": "请选择要移除的样本。",
  "Paste at most 500 codes or names at a time.": "一次最多粘贴 500 个编号或名称。",
  "Samples this experiment produced are removed by deleting them or undoing their batch.": "本实验产出的样本请通过删除样本或撤销本批来移除。",
  "Only samples this experiment takes have an amount used.": "只有本实验使用的样本可以填写用量。",
  "Enter an amount above 0.": "请输入大于 0 的数量。",
  "Two groups have the same name.": "两个分组同名。",
  "A group needs a name.": "分组需要名称。",
  "This group no longer exists.": "这个分组已不存在。",
  "Paste two columns: sample and group.": "请粘贴两列：样本和分组。",
  "Choose samples and a group.": "请选择样本和分组。",
  "Choose a sample to move.": "请选择要移动的样本。",
  "This sample is no longer in the experiment.": "这个样本已不在本实验中。",
  "Back to the experiment": "返回实验",
  "Edit sample": "编辑样本",
  "Samples taken from": "取用过的样本",
  "Register samples in Samples.": "样本请在“样本”模块中登记。",
  "Every field needs a name.": "每个字段都需要名称。",
  "A choice field needs at least one option.": "选项字段至少需要一个选项。",
  // Run preparation (S15)
  "Samples to take out": "要取出的样本",
  "Samples without a place": "未放置的样本",
  "Samples and plate layouts": "样本与排板",
};

/** Sample messages that carry a name, a code or a count; undefined when the text is not one of them. */
export function translateSamplesDynamic(value: string): string | undefined {
  let match = value.match(/^(\d+) samples? (added|removed|grouped|ungrouped)(?:; (\d+) already in this experiment)?\.$/);
  if (match) return `${{ added: "已添加", removed: "已移除", grouped: "已分组", ungrouped: "已取消分组" }[match[2]]} ${match[1]} 个样本${match[3] ? `；${match[3]} 个已在本实验中` : ""}。`;
  if ((match = value.match(/^(\d+) samples? will be removed\.$/))) return `将移除 ${match[1]} 个样本。`;
  if ((match = value.match(/^(\d+) rows? need(?:s)? attention(?: before saving)?\.$/))) return `${match[1]} 行需要修改。`;
  if ((match = value.match(/^All (\d+) rows can be saved\.$/))) return `${match[1]} 行都可以保存。`;
  if ((match = value.match(/^(\d+) rows read\. Check which column each one fills\.$/))) return `读到 ${match[1]} 行。请核对每列对应的内容。`;
  if ((match = value.match(/^([\s\S]+) has (\d+) free positions from (\S+); (\d+) are needed\.$/))) return `${match[1]} 从 ${match[3]} 起只有 ${match[2]} 个空位，需要 ${match[4]} 个。`;
  if ((match = value.match(/^Sample type ([\s\S]+) was not found\.$/))) return `没有找到样本类型“${match[1]}”。`;
  if ((match = value.match(/^Box ([\s\S]+) was not found\.$/))) return `没有找到盒子“${match[1]}”。`;
  if ((match = value.match(/^Code (\S+) is already used\.$/))) return `编号 ${match[1]} 已被使用。`;
  if ((match = value.match(/^Code (\S+) repeats row (\d+)\.$/))) return `编号 ${match[1]} 与第 ${match[2]} 行重复。`;
  if ((match = value.match(/^Parent sample (\S+) was not found\.$/))) return `没有找到母样本 ${match[1]}。`;
  if ((match = value.match(/^([\s\S]+) is not a position like A1\.$/))) return `${match[1]} 不是 A1 这样的位置。`;
  if ((match = value.match(/^([\s\S]+) is outside the (\d+) × (\d+) box\.$/))) return `${match[1]} 超出 ${match[2]} × ${match[3]} 的盒子。`;
  if ((match = value.match(/^([\s\S]+) (\S+) already holds a sample\.$/))) return `${match[1]} ${match[2]} 已有样本。`;
  if ((match = value.match(/^([\s\S]+) (\S+) repeats row (\d+)\.$/))) return `${match[1]} ${match[2]} 与第 ${match[3]} 行重复。`;
  if ((match = value.match(/^([\s\S]+) must be a number\.$/))) return `${match[1]} 须为数字。`;
  if ((match = value.match(/^([\s\S]+) must be a date\.$/))) return `${match[1]} 须为日期。`;
  if ((match = value.match(/^Choose one of the options for ([\s\S]+)\.$/))) return `请为 ${match[1]} 选择一个选项。`;
  if ((match = value.match(/^No free position left in ([\s\S]+)\.$/))) return `${match[1]} 没有空位了。`;
  if ((match = value.match(/^Has ([\s\S]+); mark it as discarded instead\.$/))) return `有 ${zhSampleBlockers(match[1])}；请改为“已丢弃”。`;
  if ((match = value.match(/^This sample has ([\s\S]+), so it cannot be deleted\. Mark it as discarded instead\.$/))) return `这个样本有 ${zhSampleBlockers(match[1])}，不能删除。请改为“已丢弃”。`;
  if ((match = value.match(/^This batch has ([\s\S]+), so it can no longer be undone\.$/))) return `本批有 ${zhSampleBlockers(match[1])}，不能再撤销。`;
  if ((match = value.match(/^Enter (\S+) exactly to confirm permanent deletion\.$/))) return `请准确输入 ${match[1]} 以确认永久删除。`;
  if ((match = value.match(/^Type (\d+) to confirm deleting the selected samples\.$/))) return `请输入 ${match[1]} 以确认删除所选样本。`;
  if ((match = value.match(/^(\S+) now has ([\d.]+) ([\s\S]*) left\.$/))) return `${match[1]}：剩余 ${match[2]} ${match[3]}。`;
  if ((match = value.match(/^(\S+) has only ([\d.]+) ([\s\S]*) left\.$/))) return `${match[1]} 只剩 ${match[2]} ${match[3]}。`;
  if ((match = value.match(/^A sample type named “([\s\S]+)” already exists\.$/))) return `已有名为“${match[1]}”的样本类型。`;
  if ((match = value.match(/^(\d+) samples? ha(?:s|ve) this type, so it cannot be deleted\. Turn it off instead\.$/))) return `有 ${match[1]} 个样本使用这个类型，不能删除，请改为停用。`;
  if ((match = value.match(/^Box size set to (\d+) × (\d+)\.$/))) return `盒子规格已设为 ${match[1]} × ${match[2]}。`;
  if ((match = value.match(/^A box has at most (\d+) (rows|columns)\.$/))) return `盒子最多 ${match[1]} ${match[2] === "rows" ? "行" : "列"}。`;
  if ((match = value.match(/^(\d+) samples? sits? outside (\d+) × (\d+): ([\s\S]+)\.$/))) return `有 ${match[1]} 个样本在 ${match[2]} × ${match[3]} 之外：${match[4]}。`;
  if ((match = value.match(/^Every aliquot needs (\S+) as its parent sample\.$/))) return `每个分装都要以 ${match[1]} 为母样本。`;
  if ((match = value.match(/^Subtract what is split off from the parent \(([\s\S]*)\)$/))) return `从母样本扣除分出的量（${match[1]}）`;
  if ((match = value.match(/^Amount taken from (\S+)$/))) return `${match[1]} 的用量`;
  if ((match = value.match(/^Unit for (\S+)$/))) return `${match[1]} 的单位`;
  if ((match = value.match(/^Select sample (\S+)$/))) return `选择 ${match[1]}`;
  if ((match = value.match(/^(\d+) samples?(?: · ([\s\S]+))?$/))) return `${match[1]} 个样本${match[2] ? ` · ${match[2]}` : ""}`;
  if ((match = value.match(/^(\d+) without a place$/))) return `${match[1]} 个未放置`;
  if ((match = value.match(/^Use the (\d+) samples chosen$/))) return `填入已选的 ${match[1]} 个样本`;
  return undefined;
}

function zhSampleBlockers(text: string) {
  return text.split(", ").map((part) => part
    .replace(/^(\d+) derived samples?$/, "$1 个派生样本")
    .replace(/^(\d+) experiments?$/, "$1 个实验记录")).join("、");
}
