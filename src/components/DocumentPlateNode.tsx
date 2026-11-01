"use client";

import dynamic from "next/dynamic";
import { useContext, useEffect, useState } from "react";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { Pencil } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { cn } from "@/lib/cn";
import { plateFilledCount, type PlateLayout } from "@/lib/plate-layout";
import { createDocumentWidgetExtension } from "@/lib/tiptap-document-extensions";
import { PlateLayoutGrid } from "./PlateLayoutGrid";
import { ReferenceScope } from "./ReferencePicker";

// The editor is only loaded when someone edits a plate.
const PlateLayoutEditor = dynamic(() => import("./PlateLayoutEditor").then((module) => module.PlateLayoutEditor), { ssr: false });

// A plate just inserted from "/" opens its editor once it is on the page.
const openOnShow = new Set<string>();
export function openPlateEditorWhenShown(plateId: string) { openOnShow.add(plateId); }

function PlateNodeView({ node, editor, selected, getPos }: NodeViewProps) {
  const block = node.attrs.block as PlateLayout;
  const { t } = useI18n();
  const { experimentId } = useContext(ReferenceScope);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!openOnShow.delete(block.id)) return;
    queueMicrotask(() => setEditing(true));
  }, [block.id]);

  /** One undoable change: the plate as edited, and any further plates its imported backup held, right after it. */
  const save = (layout: PlateLayout, more: PlateLayout[]) => {
    setEditing(false);
    const pos = getPos();
    if (typeof pos !== "number") return;
    let chain = editor.chain().focus().command(({ tr }) => { tr.setNodeMarkup(pos, undefined, { ...node.attrs, block: layout }); return true; });
    if (more.length) chain = chain.insertContentAt(pos + node.nodeSize, more.map((plate) => ({ type: "documentPlate", attrs: { block: plate } })));
    chain.setNodeSelection(pos).run();
  };

  // The page translator skips editable content, so the words here are translated in place.
  return <NodeViewWrapper className={cn("ln-document-plate", selected && "is-selected")} data-plate-id={block.id}>
    <div contentEditable={false}>
      <PlateLayoutGrid layout={block} />
      {editor.isEditable ? <div className="ln-document-plate-bar" data-print-hidden>
        {!plateFilledCount(block) ? <p className="ln-document-plate-empty">{t("No wells filled yet.")}</p> : null}
        <button type="button" className="focus-ring" onClick={() => setEditing(true)}><Pencil aria-hidden />{t("Edit plate")}</button>
      </div> : null}
    </div>
    {editing ? <PlateLayoutEditor initial={block} experimentId={experimentId} onDone={save} onCancel={() => { setEditing(false); editor.commands.focus(); }} /> : null}
  </NodeViewWrapper>;
}

/** "/板布局": a plate inside the document, kept in the saved Markdown as one line (Q255–Q256). */
export const DocumentPlateNode = createDocumentWidgetExtension({ name: "documentPlate", htmlAttribute: "data-document-plate", nodeView: ReactNodeViewRenderer(PlateNodeView) });
