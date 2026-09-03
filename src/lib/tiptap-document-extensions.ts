import { Extension, mergeAttributes, Node, type NodeViewRenderer } from "@tiptap/core";
import { TableKit } from "@tiptap/extension-table";

const documentBlockTypes = ["paragraph", "heading", "blockquote", "bulletList", "orderedList", "taskList", "table"];
const documentTextBlockTypes = ["paragraph", "heading", "blockquote"];

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    documentBlockLineHeight: {
      setDocumentBlockLineHeight: (lineHeight: string) => ReturnType;
      unsetDocumentBlockLineHeight: () => ReturnType;
    };
  }
}

type SectionAttribute = {
  default: string;
  htmlAttribute: string;
};

type LegacyAttribute = {
  name: string;
  htmlAttribute: string;
};

/**
 * Shared Tiptap extension Module. Protocol and scientific documents keep their
 * domain Adapters, while the structural Implementation lives behind this
 * narrow Interface so schema changes remain local.
 */
export function createDocumentSectionExtension({
  name,
  tag,
  attributes,
  nodeView,
}: {
  name: string;
  tag: string;
  attributes: Record<string, SectionAttribute>;
  nodeView: NodeViewRenderer;
}) {
  return Node.create({
    name,
    group: "block",
    content: "block*",
    defining: true,
    isolating: true,
    addAttributes() {
      return Object.fromEntries(Object.entries(attributes).map(([key, value]) => [key, { default: value.default }]));
    },
    parseHTML() {
      return [{
        tag,
        getAttrs: (element) => Object.fromEntries(Object.entries(attributes).map(([key, value]) => [key, (element as HTMLElement).getAttribute(value.htmlAttribute)])),
      }];
    },
    renderHTML({ HTMLAttributes }) {
      const persisted = Object.fromEntries(Object.entries(attributes).map(([key, value]) => [value.htmlAttribute, HTMLAttributes[key]]));
      return ["section", mergeAttributes(HTMLAttributes, persisted), 0];
    },
    addNodeView() {
      return nodeView;
    },
    addKeyboardShortcuts() {
      const atProtectedBoundary = (edge: "start" | "end") => {
        const { selection } = this.editor.state;
        if (!selection.empty) return false;
        const position = selection.$from;
        let sectionDepth = -1;
        for (let depth = position.depth; depth > 0; depth -= 1) {
          if (position.node(depth).type.name === name) { sectionDepth = depth; break; }
        }
        if (sectionDepth < 0) return false;
        if (edge === "start") return position.parentOffset === 0 && position.index(sectionDepth) === 0;
        return position.parentOffset === position.parent.content.size && position.indexAfter(sectionDepth) === position.node(sectionDepth).childCount;
      };
      return {
        Backspace: () => atProtectedBoundary("start"),
        Delete: () => atProtectedBoundary("end"),
      };
    },
  });
}

export function createDocumentWidgetExtension({ name, htmlAttribute, nodeView }: {
  name: string;
  htmlAttribute: string;
  nodeView: NodeViewRenderer;
}) {
  return Node.create({
    name,
    group: "block",
    atom: true,
    draggable: true,
    isolating: true,
    addAttributes() {
      return { block: { default: null } };
    },
    parseHTML() {
      return [{
        tag: `div[${htmlAttribute}]`,
        getAttrs: (element) => {
          try { return { block: JSON.parse((element as HTMLElement).getAttribute(htmlAttribute) ?? "null") }; }
          catch { return { block: null }; }
        },
      }];
    },
    renderHTML({ HTMLAttributes }) {
      return ["div", { [htmlAttribute]: JSON.stringify(HTMLAttributes.block) }];
    },
    addNodeView() {
      return nodeView;
    },
  });
}

/** Line spacing belongs to the paragraph box, rather than an inline text mark. */
export function createDocumentBlockLineHeightExtension() {
  return Extension.create({
    name: "documentBlockLineHeight",
    addGlobalAttributes() {
      return [{
        types: documentTextBlockTypes,
        attributes: {
          documentLineHeight: {
            default: null,
            parseHTML: (element: HTMLElement) => element.getAttribute("data-labnest-line-height") ?? element.style.lineHeight ?? null,
            renderHTML: (attributes: Record<string, unknown>) => attributes.documentLineHeight
              ? { "data-labnest-line-height": attributes.documentLineHeight, style: `line-height: ${attributes.documentLineHeight}` }
              : {},
          },
        },
      }];
    },
    addCommands() {
      return {
        setDocumentBlockLineHeight: (lineHeight: string) => ({ chain }) => {
          let next = chain();
          for (const type of documentTextBlockTypes) next = next.updateAttributes(type, { documentLineHeight: lineHeight });
          return next.run();
        },
        unsetDocumentBlockLineHeight: () => ({ chain }) => {
          let next = chain();
          for (const type of documentTextBlockTypes) next = next.resetAttributes(type, "documentLineHeight");
          return next.run();
        },
      };
    },
  });
}

export function createDocumentLegacyAttributesExtension({ name, attributes }: {
  name: string;
  attributes: LegacyAttribute[];
}) {
  return Extension.create({
    name,
    addGlobalAttributes() {
      return [{
        types: documentBlockTypes,
        attributes: Object.fromEntries(attributes.map((attribute) => [attribute.name, {
          default: null,
          parseHTML: (element: HTMLElement) => element.getAttribute(attribute.htmlAttribute),
          renderHTML: (values: Record<string, unknown>) => values[attribute.name] ? { [attribute.htmlAttribute]: values[attribute.name] } : {},
        }])),
      }];
    },
  });
}

export function createResizableDocumentTableExtension() {
  return TableKit.configure({ table: { resizable: true, cellMinWidth: 54, allowTableNodeSelection: true } });
}
