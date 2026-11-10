/** Why an action can't be done right now, as the page says it. English source text -> Chinese. */
export const blockedReasonsZh: Record<string, string> = {
  // ProtocolAdaptForm
  "There is no active project to adapt this Protocol into. Create a project under Projects first, then come back.": "还没有进行中的项目，无法改编。请先在「项目」里新建一个项目，再回来改编这份方案。",
  // RunConsumption (completion dialog)
  "Tick at least one line and give every ticked line an actual amount of 0 or more; or use “Complete without deducting”.": "请至少勾选一行，并为每个已勾选的行填写不小于 0 的实际用量；也可以点「不扣减，直接完成」直接完成。",
  // MethodDesignWorkspace: "Only a draft version can be scaled; derive a revision from a reviewed version first" is already in i18n.ts
  "Enter a title and paste at least 40 characters of method text.": "请填写标题，并粘贴至少 40 个字符的方法正文。",
  // InventoryLocationManager (each blocker phrase is translated by the existing inventory rules)
  "This location cannot be deleted; it still has": "不能删除：此位置下还有",
  "Empty it first, or archive it instead.": "请先清空，或改用「归档」。",
  // ExperimentScheduleBoard
  "Every step is already completed, so there is nothing to schedule.": "所有步骤都已完成，没有可排的步骤。",
  // BackupNowButton
  "A backup is already running. Wait for it to finish, then try again.": "已有备份正在进行，请等它结束后再点。",
  // RunGroupPreparation
  "A run has at most 24 groups; that limit is reached.": "最多 24 组，已达上限。",
  // Editors: a fixed section (src/lib/document-sections.ts)
  "Section titles are part of the document’s fixed structure and can’t be deleted.": "小节标题是文档的固定结构，不能删除。",
  "This is the end of the section. The next section’s title is fixed, so the two can’t be merged.": "已到本小节末尾。下一个小节的标题是固定结构，两个小节不能合并。",
  "That would change the document’s fixed sections, so it was not done.": "这个操作会改变文档的固定小节，所以没有执行。",
  // ExperimentForm: a new Experiment that can't be saved yet
  "Can’t save yet: this Experiment follows a Protocol, and none is chosen.": "还不能保存：这个实验要依据实验规程，但还没有选择。",
  "Can’t save yet: a chosen Protocol’s steps aren’t confirmed. Tidy and save them in the Protocol first.": "还不能保存：所选实验规程的步骤尚未确认，请先到规程编辑页整理并保存。",
  "Choose a Protocol": "选择规程",
  "This document holds content that can’t be saved, so nothing was saved. Your edits are still on this page: copy them out, then reload and try again.": "这份文档里有无法保存的内容，所以没有保存。你的修改还在这个页面上：请先把内容复制出来，再刷新页面重试。",
  // The "/" menu and the block menu
  "Duplicate (a picture is still uploading)": "复制（图片还在上传）",
  // The plate editor
  "Duplicate plate": "复制这块板",
  "Colour by": "着色",
  "Choose samples first, then fill.": "请先选择样本，再填入。",
  "Paste the names first, one per line, then fill.": "请先粘贴名单（每行一个），再填入。",
  "A plate keeps at least one parameter.": "一块板至少保留一个参数。",
};
