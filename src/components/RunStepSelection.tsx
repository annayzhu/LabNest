"use client";
import {createContext, useContext, useState, type ReactNode, type Dispatch, type SetStateAction} from "react";
import {AttachmentUploadForm} from "./AttachmentUploadForm";
const RunStepSelection = createContext<{selectedStepId:string;setSelectedStepId:Dispatch<SetStateAction<string>>} | null>(null);
/** A view selection only: progress, evidence, and history remain attached to immutable step IDs. */
export function RunStepSelectionProvider({initialStepId,children}:{initialStepId:string;children:ReactNode}) {
  const [selectedStepId,setSelectedStepId] = useState(initialStepId);
  return <RunStepSelection.Provider value={{selectedStepId,setSelectedStepId}}>{children}</RunStepSelection.Provider>;
}
export function useRunStepSelection() {
  const value=useContext(RunStepSelection);
  if(!value) throw new Error("Run selection provider missing");
  return value;
}
export function RunStepAttachmentUpload({steps}:{steps:{id:string;title:string;order:number}[]}) {
  const {selectedStepId}=useRunStepSelection(),step=steps.find(s=>s.id===selectedStepId);
  if(!step)return null;
  return <div className="lg:hidden" data-current-step-photo><p className="mb-2 text-xs text-muted">照片归属：第 {step.order} 步 · {step.title}</p><AttachmentUploadForm key={step.id} targetType="experiment_step" targetId={step.id} hideTargetFields fileLabel="Photo or file" accept="image/*,video/*,.pdf,.csv,.tsv,.xlsx" linkType="step_evidence" /></div>;
}
