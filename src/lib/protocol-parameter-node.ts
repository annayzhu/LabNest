import { Node } from '@tiptap/core';
import type { JSONContent } from '@tiptap/core';
import type { ProtocolSystems } from './protocol-systems-schema';

/** The editor presents an atomic label; persistence retains the stable parameter reference. */
export const ProtocolParameterNode = Node.create({
  name: 'protocolParameter', group: 'inline', inline: true, atom: true,
  addAttributes: () => ({ parameterId: { default: '' }, label: { default: '' }, unit: { default: '' } }),
  parseHTML: () => [{ tag: 'span[data-protocol-parameter]', getAttrs: element => ({ parameterId: element.getAttribute('data-protocol-parameter'), label: element.getAttribute('data-label'), unit: element.getAttribute('data-unit') }) }],
  renderHTML: ({ node }) => ['span', { 'data-protocol-parameter': node.attrs.parameterId, 'data-label': node.attrs.label, 'data-unit': node.attrs.unit, class: 'protocol-parameter-chip', title: '来自规程参数；执行时采用已确认值' }, `${node.attrs.label || '未识别参数'} · ${node.attrs.unit}`],
  renderText: ({ node }) => `{{${node.attrs.parameterId}}}`,
});

export function parameterNodesForEditor(json: JSONContent, systems?: ProtocolSystems): JSONContent {
  const visit = (node: JSONContent): JSONContent[] => {
    if (node.type === 'text' && node.text?.includes('{{')) {
      return node.text.split(/(\{\{[\w-]+\}\})/g).filter(Boolean).map(text => {
        const id = /^\{\{([\w-]+)\}\}$/.exec(text)?.[1];
        const parameter = systems?.parameters.find(p => p.id === id);
        return id ? { type: 'protocolParameter', attrs: { parameterId: id, label: parameter?.label ?? '参数引用待处理', unit: parameter?.unit ?? '' }, marks: node.marks } : { ...node, text };
      });
    }
    return [{ ...node, ...(node.content ? { content: node.content.flatMap(visit) } : {}) }];
  };
  return visit(json)[0];
}

export function persistParameterNodes(json: JSONContent): JSONContent {
  if (json.type === 'protocolParameter') return { type: 'text', text: `{{${json.attrs?.parameterId}}}`, ...(json.marks ? { marks: json.marks } : {}) };
  return { ...json, ...(json.content ? { content: json.content.map(persistParameterNodes) } : {}) };
}
