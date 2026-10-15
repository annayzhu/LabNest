/** A yes/no condition reads as its name: "富脂组织" or "非富脂组织". */
export function conditionTagLabel(dimension: string, option: string) {
  return option === '是' ? dimension : option === '否' ? `非${dimension}` : `${dimension}：${option}`;
}
