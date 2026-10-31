import { describe, expect, it } from 'vitest';
import { translateUiText } from './i18n';

const zh = (text: string) => translateUiText(text, 'zh');

/** Run chips, chip popovers, the protocol read view, the AI assistant and settings, run and method-source errors: English source, the Chinese shown before. */
const entries: Array<[string, string]> = [
  ["To record", "待记录"],
  ["This run’s values", "本次执行"],
  ["This step is complete; its record no longer changes.", "此步骤已完成，记录不再修改。"],
  ["Value this run", "本次数值"],
  ["Specified", "规定"],
  ["Actual", "实际"],
  ["Actual (required)", "实际（必填）"],
  ["Record value", "记录"],
  ["Pause", "暂停"],
  ["Resume", "继续"],
  ["Start countdown", "开始倒计时"],
  ["Finish", "结束"],
  ["Restart timer", "重新计时"],
  ["Another timer is running in this step.", "这一步正在进行另一个计时。"],
  ["Time is up; the step still needs checking off.", "计时已到，步骤仍需勾选完成。"],
  ["Calculation failed", "计算失败"],
  ["Adopted", "已采用"],
  ["Preview, not adopted yet", "预览，尚未采用"],
  ["Calculate and adopt", "计算并确认采用"],
  ["Systems this column applies to", "这一列的适用体系"],
  ["This column only applies to", "这一列仅适用于"],
  ["Where this step applies", "这一步的适用范围"],
  ["Where this content applies", "这段内容的适用范围"],
  ["Only applies to", "仅适用于"],
  ["No systems or conditions yet. Create a condition, such as “fatty tissue”.", "还没有体系或条件。新建一个条件，例如“富脂组织”。"],
  ["Condition name, such as fatty tissue", "条件名称，如 富脂组织"],
  ["Optional step: may be skipped at run time and does not count toward required progress", "可选步骤：执行时可跳过，不计入必需进度"],
  ["Not a number; not used", "不是数字，未采用"],
  ["Unit suggestions", "单位建议"],
  ["Some inputs are filled in or confirmed at run time; it is calculated then and adopted once confirmed.", "有输入在执行时填写或确认：届时计算，确认后采用。"],
  ["This parameter shows", "这个参数块显示"],
  ["Fill in here", "在此填写"],
  ["Also in the text:", "也写入正文："],
  ["The actual value is recorded in the experiment at run time", "执行时在实验中记录实际值"],
  ["This parameter takes its value from combined conditions and cannot be edited item by item here; above, switch it to a fixed value or to values by one system.", "此参数按组合条件取值，这里不能逐项修改；可在上方改为固定值或按单个体系取值。"],
  ["Also split by", "再按"],
  ["Value source", "取值方式"],
  ["Fixed value", "固定值"],
  ["Name (optional)", "名称（可选）"],
  ["Name (optional), such as Proteinase K", "名称（可选），如 Proteinase K"],
  ["Linked to the materials table", "已关联材料表"],
  ["Materials table", "材料表"],
  ["Mixing method", "混匀方式"],
  ["Values by system", "按体系取值"],
  ["A reminder to work protected from light; no values.", "提醒操作时避光，没有数值。"],
  ["Parameter", "参数"],
  ["This parameter has been deleted.", "这个参数已被删除。"],
  ["Count consumption by", "消耗按"],
  ["Total this run", "本次总量"],
  ["Actual value required at run time", "执行时必填实际值"],
  ["Delete parameter", "删除参数块"],
  ["The referenced parameter was deleted", "引用的参数已删除"],
  ["Parameter deleted", "参数已删除"],
  ["Confirm after calculating", "计算后确认"],
  ["Conflicting values", "取值冲突"],
  ["Incompatible unit", "单位不兼容"],
  ["non-", "非"],
  ["End timer (the step still needs confirming)", "结束计时（步骤仍需确认）"],
  ["The timer reached zero; the step is not completed automatically. Reset before timing again.", "计时已到零，步骤尚未自动完成。重新计时请先重置。"],
  ["Offline, the timer keeps showing; start, pause and reset need a connection to confirm, so nothing runs late after reconnecting.", "离线时保留计时显示；开始、暂停与重置需联网确认，避免重连后延迟执行。"],
  ["The clock is not calibrated yet or the device time changed; check it once online. The current display is not a precise timing reference.", "时钟尚未校准或设备时间发生变化，请联网后核对；当前显示不能作为精确计时依据。"],
  ["Text", "文本"],
  ["Choice", "选项"],
  ["Yes/No", "是/否"],
  ["Date & time", "日期时间"],
  ["Identifier", "标识"],
  ["Design factor", "设计"],
  ["Grouping", "分组"],
  ["Quality control", "质控"],
  ["Annotation", "注释"],
  ["Instructions", "填写说明 / Instructions"],
  ["Field requirements", "字段要求 / Fields"],
  ["File requirements", "文件要求 / File requirements"],
  ["These are the raw files to keep or upload; the files themselves are uploaded after creating or opening the Result record.", "这里定义需要保留或上传的原始文件；实际文件在创建 / 打开 Result 记录后上传。"],
  ["Only", "仅"],
  ["Not in this preview · expand", "不适用于当前预览 · 展开"],
  ["Old formula table, for reference only: runs no longer calculate from it; amounts come from the parameters and mix cards in the steps.", "旧公式表，仅作说明：执行时不再按它计算，用量来自步骤里的参数块和配液卡。"],
  ["Usage per reaction", "每反应用量"],
  ["Summed from the parameters; multiplied by the run quantity at run time and usable to deduct stock on completion", "由参数块汇总；执行时乘以本次数量，完成时可据此扣减库存"],
  ["Amount used", "用量"],
  ["Basis", "按"],
  ["AI assistant", "AI 助手"],
  ["AI assistant · AI is off", "AI 助手 · AI 未开启"],
  ["AI is ready", "AI 已就绪"],
  ["AI is not on yet", "AI 还没有开启"],
  ["Once it is on, the AI buttons in the places below work. Protocols, calculations and runs do not need AI and work as usual.", "开启后，下面这些地方的 AI 按钮才能用。规程、计算和实验执行不需要 AI，照常可用。"],
  ["AI is on, one step to go", "AI 已开启，还差一步"],
  ["The default service is not set up yet.", "默认服务还没有配好。"],
  ["Cannot read AI settings", "读不到 AI 设置"],
  ["Close AI assistant", "关闭 AI 助手"],
  ["Read again", "重新读取"],
  ["Where you can use AI", "可以用 AI 的地方"],
  ["This page", "这一页"],
  ["Until AI is on, the AI buttons on these pages are gray; everything else works as usual.", "AI 开启前，这些页面里的 AI 按钮是灰色的，其余功能照常。"],
  ["Check what AI generates; text is sent to a model only when you click an AI button.", "AI 生成的内容需要你核对；只有点击 AI 按钮时，文字才会发给模型。"],
  ["Turn on AI", "开启 AI"],
  ["One step left to turn on AI", "开启 AI 只差一步"],
  ["(done)", "（已完成）"],
  ["(not done)", "（未完成）"],
  ["Go to AI settings", "去 AI 设置"],
  ["You can open AI settings any time from the gear at the top right.", "随时可以点右上角的齿轮打开 AI 设置。"],
  ["Add a model service", "添加一个模型服务"],
  ["Make it the default service and fill in its key and model", "选为默认服务，并填好密钥和模型"],
  ["Turn on “Enable AI”", "打开“启用 AI”"],
  ["Propose next steps from a quick entry", "从快速记录提议后续操作"],
  ["On a quick entry, click “Propose with AI” at the top right; proposals take effect only after you confirm them", "在快速记录页右上角点“Propose with AI”，提议等你确认后才生效"],
  ["AI workbench", "AI 工作台"],
  ["Without a connected model, copy the prompt to any AI and paste the answer back", "没有联网的模型时，复制提示词给任意 AI，再把回答贴回来"],
  ["Reading settings…", "正在读取设置…"],
  ["Settings could not be read", "设置读取失败"],
  ["Off", "已关闭"],
  ["On · setup incomplete", "已开启 · 待配置"],
  ["On · fully set up", "已开启 · 配置齐备"],
  ["Saving failed; try again.", "保存失败，请重试。"],
  ["Switch saved", "开关已保存"],
  ["Feature settings saved", "功能设置已保存"],
  ["Saving failed; the switch keeps its last saved state. Read the settings again to check.", "保存失败，开关保留上次成功保存的状态。请重新读取确认。"],
  ["AI feature settings", "AI 功能设置"],
  ["Enable AI", "启用 AI"],
  ["AI is used only when you act; turning it on does not scan or process past records.", "仅按你的操作使用 AI；开启不会扫描或处理历史记录。"],
  ["Applies to this LabNest workspace, the same scope as before; Visualization Studio uses its own settings.", "作用于当前 LabNest 工作空间，与原设置范围一致；Visualization Studio 使用自己的设置。"],
  ["Next: add a model service, then choose it as the default service.", "下一步：添加一个模型服务，再选择为默认服务。"],
  ["Next: choose the default service below and click “Save feature settings”. A service card being enabled does not do this step for you.", "下一步：在下方选择默认服务，点击“保存功能设置”。服务卡片的启用状态不会替你完成这一步。"],
  ["Next: turn on the “Enable AI” switch above. The default service is kept.", "下一步：打开上方“启用 AI”总开关。默认服务已保留。"],
  ["Ready. Choose one of the entry points below to start an AI action yourself.", "已准备好。选择下方一个入口，主动发起 AI 操作。"],
  ["Complete the setup", "补充配置"],
  ["Feature settings", "功能设置"],
  ["Default AI service", "默认使用的 AI 服务"],
  ["None chosen", "未选择"],
  ["Allow attachments the user explicitly chooses", "允许用户明确选择的附件"],
  ["Save feature settings", "保存功能设置"],
  ["Unsaved changes; the main switch does not submit them.", "有未保存的修改；总开关不会提交这些修改。"],
  ["Only explicitly chosen context is sent; it does not authorize uploading the whole project.", "只发送明确选择的上下文，不授权整个项目上传。"],
  ["Use AI", "使用 AI"],
  ["Open the AI workbench", "打开 AI 工作台"],
  ["Generate suggestions from entries", "从记录生成建议"],
  ["Import a protocol and extract parameters", "导入规程并提取参数"],
  ["AI suggestions need a human check; turning AI on does not process past records. Protocol systems, ordinary calculations and runs all work with AI off.", "AI 建议需要人工核对；开启不会处理历史记录。规程体系、普通计算和实验执行均可在 AI 关闭时使用。"],
  ["AI settings · LabNest", "AI 设置 · LabNest"],
  ["Model connections and AI feature settings.", "模型连接与 AI 功能设置。"],
  ["Cannot read the connection settings; saved settings are unchanged.", "无法读取连接设置，已保存的设置未改变。"],
  ["Model connections and AI feature settings. Suggestions waiting for you are shown on each entry and experiment.", "模型连接与 AI 功能设置。待确认的建议在各条记录和实验里查看。"],
  ["Model service settings saved", "模型服务设置已保存"],
  ["Configure the server encryption key first to store API keys safely.", "需先配置服务器加密密钥，才能安全保存 API 密钥。"],
  ["Service enabled", "服务已启用"],
  ["Service disabled", "服务已停用"],
  ["Default service URL", "默认服务地址"],
  ["Manual mode", "手动模式"],
  ["Disable service", "停用"],
  ["Enable service", "启用"],
  ["New model service", "添加模型服务"],
  ["Model services", "模型服务"],
  ["No model service yet. Add one below.", "还没有模型服务，在下方添加。"],
  ["Reads pictures", "识别图片"],
  ["Sign in with a subscription", "用订阅登录"],
  ["Add with an API key", "用 API 密钥添加"],
  ["Sign in with ChatGPT", "用 ChatGPT 订阅登录"],
  ["Use Gemini (free API key)", "使用 Gemini（免费 API key）"],
  ["ChatGPT subscription · gpt-6.1-sol · high", "ChatGPT 订阅 · gpt-6.1-sol · high"],
  ["High reasoning", "高"],
  ["The default service “Gemini” is not used for pictures automatically; choose it here if its model can read pictures, or choose another service.", "默认服务“Gemini”不会自动用于识别图片；如果它的模型能看图，请在这里选择它，或选择其他服务。"],
  ["Keys stay encrypted on the server and are never shown on the page. Saving the setup does not connect to the model.", "密钥沿用服务器加密保存，页面不会回显。保存配置不会连接模型。"],
  ["Manual copy and paste", "手动复制粘贴"],
  ["Official OpenAI API", "OpenAI 官方接口"],
  ["OpenAI-compatible API", "OpenAI 兼容接口"],
  ["Anthropic API", "Anthropic 接口"],
  ["Dify app", "Dify 应用"],
  ["Enable AI first, then test the connection.", "请先启用 AI，再测试连接。"],
  ["This service is disabled; enable it first.", "此服务已停用，请先启用。"],
  ["Connection test failed; try again.", "连接测试失败，请重试。"],
  ["The LabNest server test timed out; try again later.", "LabNest 服务器测试超时，请稍后重试。"],
  ["Testing…", "正在测试…"],
  ["Test connection", "测试连接"],
  ["Sends one short test message, which may cost a little API usage.", "将发送一条简短测试消息，可能产生少量 API 费用。"],
  ["· this test only", "· 仅代表本次测试"],
  ["The test used up its output allowance before any text came back; this does not mean the key is wrong.", "测试输出额度已用完，未获得有效正文；这不表示密钥错误。"],
  ["The model returned empty content; generation is not verified yet.", "模型返回了空内容，尚未验证生成。"],
  ["Connects a published Dify app, such as the matching ZJU AIHub app.", "连接已发布的 Dify 应用，例如相应的浙大 AIHub 应用。"],
  ["Enter the API address the app provides, such as https://aihub.zju.edu.cn/v1.", "填写应用提供的 API 地址，例如 https://aihub.zju.edu.cn/v1。"],
  ["An optional note; it does not change the actual model, which the Dify app sets.", "可选说明，不改变实际模型；模型由 Dify 应用配置决定。"],
  ["Enter the app-… key issued on the app’s API access page.", "填写该应用 API 访问页颁发的 app-… 密钥。"],
  ["Choose this when the provider explicitly supports Chat Completions; use it to connect DeepSeek directly.", "服务方明确支持 Chat Completions 时选择；直连 DeepSeek 使用此项。"],
  ["Enter the public address prefix; keep the /v1 or custom prefix the provider requires, without /chat/completions.", "填写公共地址前缀；保留服务方要求的 /v1 或自定义前缀，不填写 /chat/completions。"],
  ["Enter the exact model ID, such as deepseek-flash or deepseek-v4-pro; what is actually available depends on account permissions and testing.", "填写精确模型 ID，例如 deepseek-flash 或 deepseek-v4-pro，实际可用性以账号权限及测试为准。"],
  ["Enter the API credential the platform issued, not a chat account password.", "填写服务平台颁发的调用凭据，不是聊天账户密码。"],
  ["Connects the official OpenAI API.", "连接 OpenAI 官方 API。"],
  ["Enter the exact model ID the provider gives.", "填写服务方提供的精确模型 ID。"],
  ["Enter an OpenAI API key.", "填写 OpenAI API 密钥。"],
  ["Choose this when the provider offers the Anthropic Messages format.", "服务方提供 Anthropic Messages 格式时选择。"],
  ["Enter an API key that works with this interface.", "填写适用于该接口的 API 密钥。"],
  ["Generates a prompt to run by hand in an outside chat tool; no network interface to configure.", "生成提示词，手动到外部聊天工具运行；无需配置联网接口。"],
  ["Not needed.", "无需填写。"],
  ["Use DeepSeek", "使用 DeepSeek"],
  ["Fills in the official address and deepseek-flash; for V4 Pro, change the model ID to deepseek-v4-pro.", "填入官方地址和 deepseek-flash；使用 V4 Pro 时将模型 ID 改为 deepseek-v4-pro。"],
  ["Service name", "服务名称"],
  ["Such as DeepSeek official", "例如 DeepSeek 官方"],
  ["Only for you to recognize it; it does not set the provider or protocol.", "仅供自己识别，不决定服务商或协议。"],
  ["Interface type", "接口类型"],
  ["API base URL", "API 基础地址"],
  ["Model note (optional)", "模型说明（可选）"],
  ["Default model / model ID", "默认模型 / 模型 ID"],
  ["Leave empty to keep the saved key", "留空保留已保存的密钥"],
  ["Enter the API key for this target", "填写当前目标的 API 密钥"],
  ["The service was changed on another page; reload before testing.", "服务已在其他页面修改，请重新加载后测试。"],
  ["This service is disabled; save it enabled first.", "此服务已停用，请先保存启用此服务。"],
  ["Saving the setup.", "正在保存配置。"],
  ["Enable this service", "启用此服务"],
  ["The service setup changed on another page and this draft is not saved. Copy what you want to keep first, then", "服务配置已在其他页面改变，本页草稿尚未保存。请先复制需要保留的内容，再"],
  ["reload", "重新加载"],
  ["(full stop)", "。"],
  ["Saving the service…", "正在保存…"],
  ["Save service", "保存服务"],
  ["Add service", "添加服务"],
  ["Testing does not save. After adding or saving a service, choose it under “Default AI service” and click “Save feature settings”.", "测试不会保存。添加或保存服务后，还需在“默认使用的 AI 服务”中选择，并点击“保存功能设置”。"],
  ["Cannot read AI settings; try again. Saved settings are unchanged.", "无法读取 AI 设置，请重试；已保存的设置未改变。"],
  ["Cannot read AI settings.", "无法读取 AI 设置。"],
  ["On · setup incomplete; finish the connection settings on the AI page first.", "已开启 · 待配置，请先在 AI 页面完成连接设置。"],
  ["AI settings changed; this result was not applied. Check the settings and try again.", "AI 设置已改变，本次返回结果未应用。请确认设置后重试。"],
  ["AI is off or its settings changed; check them on the AI page.", "AI 已关闭或设置已改变，请在 AI 页面确认设置。"],
  ["The service setup was changed on another page; read it again before testing.", "服务配置已在其他页面修改，请重新读取后测试。"],
  ["Enable AI first; saving a connection setup does not turn AI on.", "请先启用 AI；保存连接配置不会自动开启 AI。"],
  ["Enable this service first.", "请先启用此服务。"],
  ["Manual copy and paste needs no connection test.", "手动复制粘贴模式无需联网测试。"],
  ["The service is disabled or its setup changed; read it again before testing.", "服务已停用或配置已改变，请重新读取后测试。"],
  ["Enter a new key for this address and interface type; the old key is never sent to a new target.", "请填写适用于当前地址和接口类型的新密钥；旧密钥不会发往新目标。"],
  ["Enter the API key.", "请填写 API 密钥。"],
  ["Cannot read the connection credentials; check the server encryption setup.", "无法读取连接凭据，请检查服务器加密配置。"],
  ["Record not saved", "记录保存失败"],
  ["Systems not saved; try again", "体系未保存，请重试"],
  ["Groups not saved", "实验组未保存"],
  ["The repeated request does not belong to this step", "重复请求不属于此步骤"],
  ["Execution plan changed; reload", "执行方案已变更，请刷新"],
  ["End the timer before confirming the step complete", "请先结束计时，再确认步骤完成"],
  ["A finished run record cannot be changed", "已结束的执行记录不可改写"],
  ["This item does not support precise deduction; use a physical movement or count it first.", "该物料不支持精确扣减；请使用实物流转或先盘点。"],
  ["Confirm system parameters in run preparation; the old parameter table cannot override them.", "体系参数请在实验准备中确认，不能通过旧参数表覆盖。"],
  ["Parameters saved", "参数已保存"],
  ["Disconnect failed", "断开失败"],
  ["Not saved; try again", "未保存，请重试"],
  ["This protocol is not part of this run", "此规程不属于本次执行"],
  ["Confirm this run’s systems in run preparation first", "请先在实验准备中确认本次体系"],
  ["This run has ended; its mix cards can no longer change", "此执行已结束，配液卡不能再修改"],
  ["This experiment has no execution plan", "此实验没有执行方案"],
  ["Execution plan changed; reload before confirming", "执行方案已变更，请刷新后再确认"],
  ["This step is not part of this run", "此步骤不属于本次执行"],
  ["The step is complete; its mix cards no longer change", "步骤已完成，配液卡不再修改"],
  ["Confirm the systems and this step’s parameters first", "请先确认体系和这一步的参数"],
  ["The mix card does not belong to this step", "配液卡不属于此步骤"],
  ["The run quantity changed; reload and check", "本次数量已变化，请刷新核对"],
  ["The mix card still has undetermined amounts", "配液卡还有未确定的用量"],
  ["The mix card’s values changed; check them and confirm again", "配液卡数值已变化，请核对后重新确认"],
  ["The component does not belong to this mix card", "组分不属于此配液卡"],
  ["The mix card is not confirmed or its values changed; confirm it first", "配液卡尚未确认或数值已变化，请先确认"],
  ["Execution plan changed; reload before saving", "执行方案已变更，请刷新后再保存"],
  ["Execution plan changed; reload before making it", "执行方案已变更，请刷新后再生成"],
  ["Only parameters in this step can be chosen", "只能选用这一步里的参数块"],
  ["Only mix cards added during the run can be proposed", "只能提议执行时补充的配液卡"],
  ["This mix card has already been proposed", "这张配液卡已提议过"],
  ["Group IDs are duplicated or invalid", "实验组标识重复或无效"],
  ["A step refers to a group that does not exist", "步骤引用了不存在的实验组"],
  ["The run snapshot is missing a saved step", "执行快照缺少已保存步骤"],
  ["A shared operation is missing its source steps", "共享操作缺少来源步骤"],
  ["A step’s group is missing; check the saved execution plan.", "步骤的实验组归属缺失，请核对保存的执行方案。"],
  ["Confirm the applicable system and resolve parameters first", "请先确认体系并解决待确定参数"],
  ["Reopen the skipped operation first", "此步骤已记录跳过；请先撤销跳过"],
  ["Execution plan changed; reload before continuing", "执行方案已变更，请刷新核对"],
  ["Response too large; abandoned", "响应过大，已放弃"],
  ["Pasted text has no source to fetch", "粘贴的原文没有可抓取的来源"],
  ["This source is not turned on now", "这个来源现在没有开启"],
];

describe('English source text reads as before in Chinese', () => {
  it.each(entries)('%s', (english, chinese) => expect(zh(english)).toBe(chinese));

  it('reads dynamic chip, timer and calculation text back exactly', () => {
    expect(zh('04:59 left')).toBe('剩余 04:59');
    expect(zh('Actual 5 µL · 10 min')).toBe('实际 5 µL · 10 min');
    expect(zh('稀释 calculation')).toBe('稀释计算');
    expect(zh('Method version 2')).toBe('方法版本 2');
    expect(zh('Method version 2 · confirmed 2026/10/19 14:03:00')).toBe('方法版本 2 · 确认于 2026/10/19 14:03:00');
    expect(zh('Unrecognized unit; still µL')).toBe('未识别的单位，仍按 µL');
    expect(zh('Fill in 母液浓度, 目标浓度 to see the expected result.')).toBe('填写母液浓度、目标浓度后显示预计结果。');
    expect(zh('About 12.5 µL with the current inputs; adopted once confirmed at run time.')).toBe('按当前输入约 12.5 µL，执行时确认后采用。');
    expect(zh('计数 2 (optional)')).toBe('计数 2（可选）');
    expect(zh('DNA 原液 source')).toBe('DNA 原液来源');
    expect(zh('By Enzyme')).toBe('按Enzyme');
    expect(zh('Split by 酶 only')).toBe('只按酶区分');
    expect(zh('Remove 温度')).toBe('移除温度');
    expect(zh('Edit 体积')).toBe('编辑体积');
    expect(zh('Edit pH')).toBe('编辑pH');
    expect(zh('Edit parameter: 离心 · 10 min')).toBe('编辑参数：离心 · 10 min');
    expect(zh('Per reaction · 配液卡')).toBe('每反应 · 配液卡');
    expect(zh('Per plate · qPCR 预混液')).toBe('每plate · qPCR 预混液');
  });

  it('reads dynamic AI text back exactly', () => {
    expect(zh('AI assistant, 3 AI suggestions waiting for you')).toBe('AI 助手，3 条 AI 建议等你确认');
    expect(zh('AI assistant, 1 AI suggestion waiting for you')).toBe('AI 助手，1 条 AI 建议等你确认');
    expect(zh('Default service: DeepSeek · deepseek-flash. Use the AI buttons in the places below.')).toBe('默认服务：DeepSeek · deepseek-flash。在下面这些地方点 AI 按钮就能用。');
    expect(zh('Default service: model. Use the AI buttons in the places below.')).toBe('默认服务：模型。在下面这些地方点 AI 按钮就能用。');
    expect(zh('AI suggestions waiting for you · 4')).toBe('等你确认的 AI 建议 · 4 条');
    expect(zh('2 to accept or dismiss')).toBe('2 条待采纳或忽略');
    expect(zh('3 more quick entries have suggestions waiting.')).toBe('还有 3 条快速记录有待确认的建议。');
    expect(zh('2 steps left to turn on AI')).toBe('开启 AI 还差 2 步');
    expect(zh('Edit model service · Lab GPT')).toBe('编辑模型服务 · Lab GPT');
    expect(zh('OpenAI-compatible API · deepseek-flash')).toBe('OpenAI 兼容接口 · deepseek-flash');
    expect(zh('Test succeeded · requested model a · returned model b (differs from the requested ID; check the service’s mapping) · output truncated'))
      .toBe('测试成功 · 请求模型 a · 返回模型 b（与请求 ID 不同，请核对服务端映射） · 输出已截断');
    expect(zh('Test succeeded, settings not saved yet · requested model a · the service returned no model ID')).toBe('测试成功，配置尚未保存 · 请求模型 a · 服务未返回模型 ID');
    expect(zh('App generation test succeeded, settings not saved yet; the actual model is set by the Dify app.')).toBe('应用生成测试成功，配置尚未保存；实际模型由 Dify 应用配置决定。');
    expect(zh(' · this test only')).toBe(' · 仅代表本次测试');
    expect(zh('Leave empty to use https://api.openai.com/v1. After changing the address or interface type, enter a key that works with them again.'))
      .toBe('留空使用 https://api.openai.com/v1。 更换地址或接口类型后，需重新填写适用的密钥。');
    expect(zh('Enter an OpenAI API key. The key is stored only encrypted on the server and never shown again.')).toBe('填写 OpenAI API 密钥。 密钥只在服务器加密保存，不回显。');
  });

  it('reads run and method-source errors back exactly', () => {
    expect(zh('Record the actual value: 离心 · 时间')).toBe('请记录实际值：离心 · 时间');
    expect(zh('Incompatible unit for the actual value: 温度')).toBe('实际值单位不兼容：温度');
    expect(zh('Confirm the mix card first: 配液卡')).toBe('请先确认配液卡：配液卡');
    expect(zh('The mix card’s values changed; confirm again: qPCR 预混液')).toBe('配液卡数值已变化，请重新确认：qPCR 预混液');
    expect(zh('Address not on the allow list: evil.example')).toBe('不在白名单内的地址：evil.example');
    expect(zh('europe_pmc: www.ebi.ac.uk returned 503')).toBe('europe_pmc：www.ebi.ac.uk 返回 503');
    expect(zh('europe_pmc: Search failed；protocols_io: Response too large; abandoned')).toBe('europe_pmc：检索失败；protocols_io：响应过大，已放弃');
  });

  it('leaves look-alike author text alone', () => {
    for (const text of ['Remove the lid', 'Actual volume', 'Wash source', 'Mix calculation']) expect(zh(text)).not.toMatch(/移除|编辑|实际|来源|计算/);
  });
});
