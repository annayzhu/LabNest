/** Chinese for 多日排程 (Q259–Q270); spread first into zhUi, so an existing translation of the same text wins. */
export const scheduleZh: Record<string, string> = {
  // The schedule page
  "Each day’s work, drafted from the waits in its Protocols. Drag a block to another day; what waits for it moves along.": "每天要做的事，按规程里的等待自动排出。把一段拖到另一天，等它的后续段会一起移动。",
  "View": "视图",
  "Flowchart": "流程图",
  "Days": "共几天",
  "Day 1 starts at": "第 1 天开始于",
  "List": "列表",
  "Day": "第几天",
  "Move the blocks after it too": "后面的段一起移动",
  "Add item": "添加事项",
  "Redraft": "重新排初稿",
  "Draft the schedule": "排日程",
  "Redraft from the Protocols": "按规程重新排初稿",
  "Arrange the days": "安排每天的事",
  "Waits of 4 h or more, overnight steps and work that would run past the end of the day start a new block; the next block starts when the wait is over.": "等待 4 小时以上、过夜，或到下班还做不完时，在这里断开；等待结束后开始下一段。",
  "Working day": "工作时间",
  "Work starts": "上班时间",
  "Work ends": "下班时间",
  "Weekends are working days": "周末也上班",
  "Draft from the Protocols": "按规程排出初稿",
  "This experiment has no steps yet. Add items for each day, or add steps to the experiment first.": "这个实验还没有步骤。可以先按天添加事项，或先给实验添加步骤。",
  "No schedule yet.": "还没有日程。",
  "Schedule flowchart": "日程流程图",
  "Block": "日程段",
  "Waits": "等待",
  "Marks": "提醒",
  "Block details": "日程段详情",
  "Select a block, then add a step to it from the block’s panel; or redraft.": "选中一段，在它的面板里把步骤加进去；或重新排初稿。",
  "Unsaved schedule": "未保存的日程",
  "Unsaved changes": "有未保存的修改",
  "Why the schedule changes (the experiment is under way)": "改期原因（实验进行中）",
  "Why the schedule changes": "改期原因",
  "Discard changes": "放弃修改",
  "Save schedule": "保存日程",
  "Expected minutes": "预计分钟",
  "At least (h)": "至少（小时）",
  "At most (h)": "至多（小时）",
  "Add a step": "加入步骤",
  "Merge into the block before": "并入前一段",
  "Remove item": "删除事项",
  "Take off the schedule": "移出日程",
  "All day": "全天",
  // Entry points
  "Day plan": "日程",
  "Plan the days": "安排日程",
  "Arrange each day": "安排每天的事",
  "Start date": "开始日期",
  // What the server says back
  "The schedule was not saved.": "日程没有保存。",
  "The item was not updated.": "事项没有更新。",
  "Choose an item.": "请选择事项。",
  "The schedule was changed elsewhere; reload before changing it.": "日程已在别处修改，请刷新后再改。",
  "A done block keeps its place and its steps.": "已完成的段不能移动，也不能改动其中的步骤。",
  "The experiment is under way: say why the schedule changes.": "实验进行中改期，请写一句原因。",
  "A block id is already in use.": "日程段编号已被占用。",
  "An archived experiment cannot change its schedule.": "已归档的实验不能改日程。",
  "This item is not in the schedule.": "日程里没有这个事项。",
  "Part of the schedule is done: change the days on the schedule itself.": "日程已有完成的段，请在日程图里改期。",
  "Two blocks have the same id": "两个日程段编号相同",
  "A block of steps has no steps": "有一段没有步骤",
  "An item needs a name": "事项需要名称",
  "A block names a step this experiment does not have": "日程段里有本实验没有的步骤",
  "A step is in two blocks": "同一步出现在两段里",
  "A block waits for a block that is not in this schedule": "某一段等待的段不在这份日程里",
  "A block cannot wait for itself": "日程段不能等待自己",
  "A time window ends before it starts": "时间窗的上限小于下限",
  "A block is longer than a day": "日程段超过一天",
  "A block has no valid start": "日程段缺少有效的开始时间",
  "The waits between blocks go in a circle": "日程段之间的等待形成了循环",
  // Calendar export
  "Remind me 15 minutes before a block with a time": "定时的日程段开始前 15 分钟提醒",
};

/** Schedule text with a number or a name in it: block names, counts and the page title. */
export function translateScheduleDynamic(value: string): string | undefined {
  let match = value.match(/^Schedule · (.+)$/);
  if (match) return `日程 · ${match[1]}`;
  match = value.match(/^(.+) · steps (\d+)–(\d+)$/);
  if (match) return `${match[1]} · 第 ${match[2]}–${match[3]} 步`;
  match = value.match(/^(.+) · step (\d+)$/);
  if (match) return `${match[1]} · 第 ${match[2]} 步`;
  match = value.match(/^(\d+) blocks?$/);
  if (match) return `${match[1]} 段`;
  match = value.match(/^Day (\d+)$/);
  if (match) return `第 ${match[1]} 天`;
  // A long countdown where the locale is not passed in (formatStepTimer, Q269).
  match = value.match(/^(\d+) h (\d+) min( left)?$/);
  if (match) return `${match[1]} 小时 ${match[2]} 分${match[3] ? "后结束" : ""}`;
  match = value.match(/^(\d+) d (\d+) h( left)?$/);
  if (match) return `${match[1]} 天 ${match[2]} 小时${match[3] ? "后结束" : ""}`;
  return undefined;
}
