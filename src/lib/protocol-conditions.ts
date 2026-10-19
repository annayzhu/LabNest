/**
 * A yes/no condition reads as its name: "fatty tissue" or "not fatty tissue"; another option as "Tissue: liver".
 * Interface text; the Chinese interface reads it 富脂组织 / 非富脂组织 / 组织：肝 (conditionTagLabelZh).
 */
export function conditionTagLabel(dimension: string, option: string) {
  const name = systemLabelText(dimension);
  return option === '是' ? name : option === '否' ? `not ${name}` : `${name}: ${systemLabelText(option)}`;
}
/** conditionTagLabel in Chinese, for text the page translator cannot reach (the editor's CSS tags). */
export function conditionTagLabelZh(dimension: string, option: string) {
  return option === '是' ? dimension : option === '否' ? `非${dimension}` : `${dimension}：${option}`;
}

const defaultLabels = new Map([['体系', 'System'], ['新条件', 'New condition'], ['是', 'Yes'], ['否', 'No']]);
/**
 * A system or condition label as the interface shows it. LabNest names a new dimension 体系 (体系 2…) or 新条件 with the
 * options 是 / 否; those read "System", "New condition", "Yes", "No". Display only: the stored label stays, a typed one passes through.
 */
export function systemLabelText(label: string) {
  const numbered = /^体系 (\d+)$/.exec(label);
  return numbered ? `System ${numbered[1]}` : defaultLabels.get(label) ?? label;
}
