import { describe, expect, it } from 'vitest';
import { translateUiText } from './i18n';
import { mixView, runQuantityLabelText, runQuantityText, type ProtocolMix } from './protocol-mix';
import { systemLabelText } from './protocol-conditions';
import { readBackTemplate, templateFromRecordLines } from './result-record-line';
import { resolveProtocolSystem, type ProtocolSystems } from './structured-protocol';

const zh = (text: string) => translateUiText(text, 'zh');

/** Run page, mix card, Lens and result template text: English source, and the Chinese the interface showed before. */
const entries: Array<[string, string]> = [
  ["Saved on this device, waiting to sync; the actual values on the server have not changed yet.", "已保存至本机，等待同步；服务端实际记录尚未改变。"],
  ["Storage on this device is unavailable; nothing was saved. Keep this page open.", "本机存储不可用，未保存。请保留页面。"],
  ["This operation or its saved record has changed, so the draft on this device was not applied. Check it first.", "此操作或已保存记录发生变更，本机草稿尚未应用，请先核对。"],
  ["Keep the draft on this device after checking", "核对后保留本机草稿"],
  ["The operation or its unit has changed; fill it in again as now required.", "操作或单位已变化，请按当前要求重新填写。"],
  ["Discard the draft on this device", "放弃本机草稿"],
  ["To be determined · confirm the systems and the parameters it depends on", "待确定 · 请确认体系及依赖参数"],
  ["Optional operation", "可选操作"],
  ["Required operation", "必需操作"],
  ["· required", "· 必填"],
  ["Saved on this device · waiting to sync", "本机已保存 · 待同步"],
  ["Unsaved change", "未保存修改"],
  ["Saved", "已保存"],
  ["Saving the values…", "正在保存…"],
  ["Save actual values", "保存实际值"],
  ["Skip this operation", "跳过操作"],
  ["Reason for skipping", "跳过原因"],
  ["Undo skip", "撤销跳过"],
  ["Record skip", "记录跳过"],
  ["Record saved", "记录已保存"],
  ["Systems for this run confirmed and saved", "本次体系已确认并保存"],
  ["Groups saved; confirm the systems actually used for each group.", "实验组已保存，请逐组确认实际采用体系。"],
  ["The run record was updated; the older draft is kept for checking.", "执行记录已更新，旧草稿保留供核对。"],
  ["The run record was updated. Compare the server record with the older draft before deciding whether to keep using it.", "执行记录已更新。请核对服务器记录与旧草稿，再决定是否继续使用。"],
  ["Show the older draft", "查看旧草稿"],
  ["Checked draft restored, not saved yet", "已恢复核对后的草稿，尚未保存"],
  ["Checked; keep using these drafts", "已核对，继续使用这些草稿"],
  ["Untick the whole group", "取消整组勾选"],
  ["Tick the whole group", "勾选整组"],
  ["Jot a note", "记一笔"],
  ["record it under “Reagents and consumables used in this run”", "请在“本次使用的试剂与耗材”中登记"],
  ["Save failed", "保存失败"],
  ["Component", "组分"],
  ["Per reaction", "每反应"],
  ["Per well", "每孔"],
  ["Per sample", "每样本"],
  ["Per tube", "每管"],
  ["How it is added", "加入方式"],
  ["Separately", "单独加"],
  ["Total amount", "合计"],
  ["This run", "本次"],
  ["Values changed; confirm again", "数值已变化，需重新确认"],
  ["Not confirmed yet", "尚未确认"],
  ["Tap to cross off once added (not counted as progress)", "加完后点一下划掉（不计入进度）"],
  ["Confirmed", "已确认"],
  ["Confirm again", "重新确认"],
  ["Confirm mix card", "确认配液卡"],
  ["Tap an item once it is added to cross it off; the watch stays in sync.", "加完一项点一下划掉；手表同步。"],
  ["Could not copy; select the text by hand", "无法复制，请手动选择文字"],
  ["The browser blocked the print window", "浏览器阻止了打印窗口"],
  ["Amount deleted", "用量已删除"],
  ["System to choose", "待选体系"],
  ["To fill in", "待填写"],
  ["The premix has a component that is not a volume; the aliquot volume leaves it out.", "预混液中有不是体积的组分，分装体积未计入它。"],
  ["Mix card name", "配液卡名称"],
  ["Premix", "预混液"],
  ["Per", "每"],
  ["What one portion is", "每份是什么"],
  ["Overage", "余量"],
  ["Overage percentage", "余量百分比"],
  ["Min. pipetting volume", "移液下限"],
  ["Minimum pipetting volume (µL)", "移液下限（µL）"],
  ["Component name", "组分名称"],
  ["e.g. 2× SYBR Mix", "如 2× SYBR Mix"],
  ["Edit amount", "编辑用量"],
  ["In premix", "预混"],
  ["Delete component", "删除组分"],
  ["Proposed: the Protocol’s author can add it to the next version in one click on the edit page.", "已提议：规程作者在编辑页可一键加入下一个版本。"],
  ["Added during the run", "执行时补充"],
  ["Propose for the Protocol", "提议加入规程"],
  ["Make a mix card at the bench", "现场生成配液卡"],
  ["Make mix card", "生成配液卡"],
  ["Bench mix card", "现场配液卡"],
  ["Mix cards added during runs", "执行时补充的配液卡"],
  ["From a run", "来自执行"],
  ["Add to this step", "加入该步骤"],
  ["Dismiss", "忽略"],
  ["Number of reactions", "反应数"],
  ["Number of wells", "孔数"],
  ["Number of samples", "样本数"],
  ["Number of tubes", "管数"],
  ["System", "体系"],
  ["New condition", "新条件"],
  ["not chosen", "待选择"],
  ["All systems", "全部体系"],
  ["Add systems above first, then mark the recipe table’s columns with their options.", "先在上方添加体系，再把配方表的列标给对应选项。"],
  ["At run time only the chosen system’s columns are kept; when reading all systems the column headers carry symbols.", "执行时只保留所选体系的列；阅读全部体系时表头带符号。"],
  ["Field details", "字段详情"],
  ["Result name, e.g. RNA QC", "结果名称，如 RNA 质检"],
  ["Items to record", "记录"],
  ["记录：concentration ng/µL, A260/280, gel image", "记录：浓度 ng/µL、A260/280、胶图"],
  ["每个样本：sample name, Ct value (only when there is one row per sample)", "每个样本：样本名、Ct 值（每个样本一行时才写）"],
  ["An item with a unit is a number; one ending in 图, 照片, image or photo is an image; one ending in 文件, 原始数据, file or raw data is a file; one starting with “是否” or ending in ? is yes/no; write options in brackets, e.g. (positive/negative); a * after the name makes it required.", "带单位的是数值；图、照片是图片；文件、原始数据是文件；“是否…”是是否；写选项用（阳性/阴性）；名称后加 * 表示必填。"],
  ["Nothing to record yet.", "还没有要记录的项目。"],
  ["Will record", "将记录"],
  ["One row per sample", "每个样本一行"]
];

type Parameter = ProtocolSystems['parameters'][number];
const fixed = (id: string, label: string, value: number, unit = 'µL'): Parameter => ({ id, label, unit, source: { kind: 'fixed', value, unit } });
const systemsOf = (parameters: Parameter[]): ProtocolSystems => ({ schemaVersion: 1, dimensions: [], presets: [], restrictions: [], rules: [], parameters });
const component = (id: string, name: string, mode: 'premix' | 'separate' = 'premix') => ({ id: `c-${id}`, name, amount: `{{${id}}}`, mode });

describe('Run page and mix card translations', () => {
  it('gives the Chinese interface the run page, mix card and result template text it had', () => {
    expect(entries.map(([english]) => zh(english))).toEqual(entries.map(([, chinese]) => chinese));
    expect(zh(' · required')).toBe(' · 必填');
  });

  it('reads the reminder status, draft recovery, progress and sync lines back', () => {
    const notice = ' This web version only alerts while the page is open; background Web Push is off. For lock-screen reminders use the installed, authorized watch app, and check it on a real device.';
    const zhNotice = '本版网页仅提供前台到时提示，未启用后台 Web Push；锁屏提醒请使用已安装并授权的手表端，并另做真机验证。';
    expect(zh(`Running as a home screen app; notification permission granted.${notice}`)).toBe(`网页：主屏幕应用；通知权限：已允许。${zhNotice}`);
    expect(zh(`Running in a browser tab; notification permission not available here.${notice}`)).toBe(`网页：浏览器页面；通知权限：此环境不提供通知接口。${zhNotice}`);
    expect(zh('Running in a browser tab; notification permission not requested yet.' + notice)).toBe(`网页：浏览器页面；通知权限：尚未申请。${zhNotice}`);
    expect(zh('Not saved on this device · QuotaExceededError: full')).toBe('本机保存失败：QuotaExceededError: full');
    expect([zh('2 records on this device for this step, waiting to be checked or synced.'), zh('1 record on this device for this step, waiting to be checked or synced.')])
      .toEqual(['本步骤有 2 条本机记录等待核对或同步。', '本步骤有 1 条本机记录等待核对或同步。']);
    expect([zh('Draft value for OD600 (µL) · 12'), zh('Draft value for OD600 (µL) · not filled in'), zh('Draft value for Ct · A (cycles) · 21.5')])
      .toEqual(['OD600：12 µL', 'OD600：未填写 µL', 'Ct · A：21.5 cycles']);
    expect([zh('Earlier actual value · 12 · check the unit of the original operation'), zh('Earlier actual value · not filled in · check the unit of the original operation'), zh('Earlier actual value · 12 ')])
      .toEqual(['此前实际值：12（请核对原操作单位）', '此前实际值：未填写（请核对原操作单位）', '此前实际值：12 ']);
    expect([zh('Skip reason not submitted · 样本污染'), zh('Skipped · 样本污染 (not counted as complete)'), zh('Last saved value 12 µL')])
      .toEqual(['未提交原因：样本污染', '已跳过 · 样本污染（不计为完成）', '上次保存：12 µL']);
    expect(zh('3 records on this device waiting to sync, 1 in conflict. The completion count below does not cover them all yet.')).toBe('本机待同步 3 条，其中冲突 1 条。下方完成计数尚未代表全部已同步。');
    expect(zh('Required 3/5 done · optional 0/1 · skipped 1 · to be determined 0')).toBe('必需操作：3/5 完成 · 可选：0/1 · 跳过：1 · 待确定：0');
    expect([zh('Run completed. This run’s use is recorded and deducted from stock.'), zh(' This run’s use is recorded.')]).toEqual(['已完成执行。 已记录本次用量并扣减库存。', ' 已记录本次用量。']);
    expect(zh('The run is complete, but not all of its use was written · record it under “Reagents and consumables used in this run”')).toBe('实验已完成，但用量未全部写入：请在“本次使用的试剂与耗材”中登记');
    expect(zh('The run is complete, but not all of its use was written · Some deductions did not go through · 库存不足; 已锁定. The use records are kept; retry under “Reagents and consumables used in this run”.'))
      .toBe('实验已完成，但用量未全部写入：部分扣减未完成：库存不足；已锁定。使用记录已保留，可在“本次使用的试剂与耗材”中重试。');
  });

  it('reads the mix card lines back, with the stored per word and run quantity key', () => {
    expect([zh('Per reaction · 10% overage'), zh('Per 板 · 5% overage'), zh('Per 板'), zh('10% overage')]).toEqual(['每反应 · 余量 10%', '每板 · 余量 5%', '每板', '余量 10%']);
    expect([zh('This run’s number of reactions'), zh('This run’s 板数')]).toEqual(['本次反应数', '本次板数']);
    expect(zh('Fill in the number of wells under “Preparation”, or enter a quantity for this card here for now.')).toBe('请在“实验准备”填写孔数，或在此临时填写本卡的数量。');
    expect(zh('This card uses 12 reactions, not the 24 in Preparation.')).toBe('本卡按 12 反应，与实验准备的 24 不同。');
    expect([zh('Confirmed · 14:05'), zh('Added cDNA; tap to undo'), zh('Cross off 2× SYBR Mix once added')]).toEqual(['已确认 · 14:05', 'cDNA已加，点按撤销', '2× SYBR Mix加完后划掉']);
    expect(zh('At run time the totals are worked out from this run’s number of reactions and the aliquoting is written out.')).toBe('执行时按本次反应数换算合计并写出分装操作。');
    expect([zh('qPCR 预混液 · 24 reactions (10% overage)'), zh('配液卡 · — reactions (10% overage)'), zh('A · B · 1 well (0% overage)')])
      .toEqual(['qPCR 预混液 · 24 反应（余量 10%）', '配液卡 · — 反应（余量 10%）', 'A · B · 1 孔（余量 0%）']);
    expect([zh('48 µL (add separately)'), zh('cDNA (add separately)')]).toEqual(['48 µL（单独加）', 'cDNA（单独加）']);
    expect([zh('Not in the premix; added to each well on its own'), zh('Delete component Primer F')]).toEqual(['不进预混液，每孔单独加入', '删除Primer F']);
    expect(zh('Write the amount per reaction; it can differ by system. At run time it is scaled by this run’s number of reactions and the overage, and the aliquoting is written out.'))
      .toBe('用量写每反应的量，可以按体系取值；执行时按本次反应数和余量换算合计，并写出分装操作。');
    expect([zh('Pick the amounts to mix together; totals are worked out per reaction. Recorded for this run only.'), zh('Pick the amounts to mix together; totals are worked out per . Recorded for this run only.')])
      .toEqual(['选几个用量一起配，按每反应的量换算合计。只记入本次执行。', '选几个用量一起配，按每的量换算合计。只记入本次执行。']);
    expect([zh(' · 3 components'), zh(' · 1 component'), zh('From EXP-000123'), zh(' · 2 amounts were deleted in this version; fill them in again after adding')])
      .toEqual([' · 3 个组分', ' · 1 个组分', '来自 EXP-000123', ' · 2 个用量在此版本中已删除，加入后需重新填写']);
  });

  it('shows the aliquot and pipetting warnings mixView computes exactly as the stored Chinese wording', () => {
    const systems = systemsOf([fixed('sybr', '', 10), fixed('water', '', 8), fixed('cdna', '', 2), fixed('f', '', 0.4), fixed('enzyme', 'RNase 抑制剂', 0.01), fixed('template', '模板', 0.2), fixed('mg', '', 1, 'mg')]);
    const resolution = resolveProtocolSystem(systems, {}).parameters;
    const base: ProtocolMix = { id: 'mix', type: 'mix', title: 'qPCR 预混液', per: '反应', overagePercent: 10, minPipetteUl: 0.5, components: [] };
    const mixes: ProtocolMix[] = [
      { ...base, components: [component('sybr', '2× SYBR Mix'), component('water', '水'), component('cdna', 'cDNA', 'separate'), component('f', 'Primer F', 'separate')] },
      { ...base, per: '孔', components: [component('sybr', '2× SYBR Mix')] },
      { ...base, per: '样本', components: [component('cdna', 'cDNA', 'separate'), component('f', 'Primer F', 'separate')] },
      { ...base, per: '板', components: [component('sybr', 'SYBR'), component('mg', 'MgCl2')] },
      { ...base, components: [component('enzyme', 'RNase 抑制剂'), component('template', '模板', 'separate')] },
    ];
    for (const mix of mixes) {
      const view = mixView(mix, systems, resolution, 10);
      expect(zh(view.aliquotText)).toBe(view.aliquot);
    }
    const warned = mixView(mixes[4], systems, resolution, 10);
    expect(warned.warnings.map(zh)).toEqual(['RNase 抑制剂合计 0.11 µL，低于移液下限 0.5 µL；可先稀释或增加反应数。', '模板每反应 0.2 µL，低于移液下限 0.5 µL；可先稀释或增加反应数。']);
    expect(mixView(mixes[3], systems, resolution, 10).warnings.map(zh)).toContain('预混液中有不是体积的组分，分装体积未计入它。');
    expect(['Amount deleted', 'System to choose', 'Filled in at run time', 'To fill in'].map(zh)).toEqual(['用量已删除', '待选体系', '执行时填写', '待填写']);
  });

  it('shows the stored run quantity keys and default system labels in English, and the Chinese interface as before', () => {
    expect(['反应数', '孔数', '样本数', '管数', '板数'].map(label => zh(runQuantityLabelText(label, true)))).toEqual(['反应数', '孔数', '样本数', '管数', '板数']);
    expect([zh(`${runQuantityText(24, '反应数')} · Not confirmed`), zh(`${runQuantityText(1, '孔数')} · Confirmed`), zh(`${runQuantityText(3, '板数')} · Confirmed`)])
      .toEqual(['24 反应数 · 待确认', '1 孔数 · 已确认', '3 板数 · 已确认']);
    expect([zh(`Not filled in: ${runQuantityLabelText('反应数')} · Confirmed`), zh(`Not filled in: ${runQuantityLabelText('样本数')}`), zh(`Run quantity not filled in: ${runQuantityLabelText('管数')} · qPCR`)])
      .toEqual(['未填写反应数 · 已确认', '未填写样本数', '尚未填写管数：qPCR']);
    expect(zh('Not filled in: number of reactions · used in Step 1 · qPCR 预混液')).toBe('未填写反应数 · 第 1 步 · qPCR 预混液');
    expect(['体系', '体系 2', '新条件', '是', '否', '容器'].map(label => zh(systemLabelText(label)))).toEqual(['体系', '体系 2', '新条件', '是', '否', '容器']);
    expect([zh(': A'), zh(': not chosen'), zh(': Yes'), zh(': 6 孔板 · 大')]).toEqual(['：A', '：待选择', '：是', '：6 孔板 · 大']);
  });

  it('reads the result template read-back as it did', () => {
    // The Chinese below is what HEAD's readBackTemplate wrote for the same lines.
    const template = templateFromRecordLines({ record: '记录：浓度 ng/µL*、结果（阳性/阴性）、胶图、是否污染、原始数据*', perSample: '每个样本：样本名、Ct 值、采样日期、采样时间' });
    const said = readBackTemplate(template);
    expect(zh(said.items.join(' ｜ '))).toBe('浓度 · 数值 · ng/µL · 必填 ｜ 结果 · 选项 · 阳性/阴性 ｜ 是否污染 · 是否 ｜ 胶图 · 图片 ｜ 原始数据 · 文件 · 必填');
    expect(zh(said.perSample.join(' ｜ '))).toBe('样本名 · 文字 ｜ Ct 值 · 数值 ｜ 采样日期 · 日期 ｜ 采样时间 · 时间');
  });
});
