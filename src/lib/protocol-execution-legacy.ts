import type { ProtocolContentBlock, ProtocolDocument } from "./protocol-document";
import type { ProtocolStep } from "./types";
/** Frozen pre-20261007 projection, used only to recover existing historical snapshots. */
export function projectLegacyProtocolExecution(document: ProtocolDocument) {
  const stepSection=document.sections.find(section=>section.key==="steps");
  const steps: ProtocolStep[] = [];
  const commonBlocks: ProtocolContentBlock[] = [];
  let startedSteps = false;
  let currentHeading: string | undefined;
  let currentBlocks: ProtocolContentBlock[] = [];
  let currentRef: string | undefined;
  let currentDescription: string[] = [];
  const flushStep = () => {
    const description = currentDescription.filter(Boolean).join("\n").trim();
    if (currentHeading) steps.push({ order: steps.length + 1, title: currentHeading.replace(/^\d+[.、]\s*/, "") || `Step ${steps.length + 1}`, description, requires_confirmation: true, allows_deviation: true });
    else if (description) steps.push({ order: steps.length + 1, title: description.split("\n")[0], description: description.split("\n").slice(1).join("\n"), requires_confirmation: true, allows_deviation: true });
    const projected = (currentHeading || description) ? steps.at(-1) : undefined;
    if(projected && (currentBlocks.length||currentRef)){projected.content_blocks=structuredClone(currentBlocks);projected.source_ref=currentRef??currentBlocks[0]?.id;}
    currentBlocks=[]; currentRef=undefined;
    currentHeading = undefined;
    currentDescription = [];
  };
  const appendToLastProjectedStep = (text: string) => {
    const lastStep = steps.at(-1);
    if (!lastStep) return false;
    lastStep.description = [lastStep.description, text].filter(Boolean).join("\n");
    return true;
  };
  for (const block of stepSection?.blocks ?? []) {
    if (block.type === "heading") { startedSteps = true; flushStep(); currentHeading = block.text; currentRef=block.id; }
    if (block.type === "text") {
      if (!startedSteps && (stepSection?.blocks ?? []).some(b => b.type === "heading" || (b.type === "rich_text" && b.nodes.some(n => ["heading2", "heading3", "numbered"].includes(n.type))))) { commonBlocks.push(block); continue; }
      startedSteps = true;
      currentBlocks.push(block); currentRef??=block.id;
      if (currentHeading) currentDescription.push(block.text);
      else { currentDescription.push(block.text); flushStep(); }
    }
    if (block.type === "rich_text") {
      for (const [nodeIndex,node] of block.nodes.entries()) {
        const fragment:ProtocolContentBlock={...block,id:`${block.id}:${nodeIndex}`,nodes:[node]};
        const text = node.content.map((run) => run.text).join("").trim();
        if (!text) continue;
        if (["numbered", "heading2", "heading3"].includes(node.type)) {
          startedSteps = true;
          flushStep();
          currentHeading = text; currentRef=fragment.id;
          if(node.childContent?.length)currentBlocks.push({...fragment,nodes:[{type:"paragraph",content:[],childContent:node.childContent}]});
        } else if (currentHeading) {currentDescription.push(node.type === "bullet" ? `• ${text}` : text);currentBlocks.push(fragment);}
        else if (node.type === "bullet" && appendToLastProjectedStep(`• ${text}`)) {const last=steps.at(-1)!;last.content_blocks=[...(last.content_blocks??[]),fragment];continue;}
        else if (!startedSteps && (stepSection?.blocks ?? []).some(b => b.type === "heading" || (b.type === "rich_text" && b.nodes.some(n => ["heading2", "heading3", "numbered"].includes(n.type))))) commonBlocks.push(fragment);
        else { startedSteps = true; currentDescription.push(text);currentBlocks.push(fragment);currentRef=fragment.id; flushStep(); }
      }
    }
    if (block.type === "checklist") {
      // A checklist is an explicit execution contract: every item must remain
      // independently confirmable in run mode, even when it follows a heading.
      startedSteps = true;
      flushStep();
      for (const [itemIndex,item] of block.items.entries()) {
        if (!item.trim()) continue;
        steps.push({source_ref:`${block.id}:${itemIndex}`,content_blocks:[{id:`${block.id}:${itemIndex}`,type:"text",text:item,...(block.itemNodes?.[itemIndex]?{nodes:block.itemNodes[itemIndex]}:{})}], order: steps.length + 1, title: item, description: "", requires_confirmation: true, allows_deviation: true });
      }
    }
    if(!["heading","text","rich_text","checklist"].includes(block.type)){
      if(currentHeading)currentBlocks.push(block);
      else if (!startedSteps) commonBlocks.push(block);
      else {
        // Content after an independently confirmed item stays with that item.
        const last = steps.at(-1);
        if (last) last.content_blocks = [...(last.content_blocks ?? []), block];
      }
    }
  }
  flushStep();

  return {steps, commonBlocks};
}
