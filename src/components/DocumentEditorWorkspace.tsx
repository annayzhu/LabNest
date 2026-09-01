"use client";

import { FileText, Link2, SlidersHorizontal } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type WorkspaceTab = "document" | "metadata" | "relations";

export function DocumentEditorWorkspace({
  document,
  metadata,
  relations,
  className,
}: {
  document: ReactNode;
  metadata: ReactNode;
  relations: ReactNode;
  className?: string;
}) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("document");
  const tabs: Array<{ id: WorkspaceTab; label: string; icon: typeof FileText }> = [
    { id: "document", label: "Document", icon: FileText },
    { id: "metadata", label: "Metadata", icon: SlidersHorizontal },
    { id: "relations", label: "Relevant items", icon: Link2 },
  ];

  return <div className={cn("document-editor-workspace", className)} data-active-tab={activeTab}>
    <nav className="document-editor-tabs" aria-label="Protocol editor areas" data-print-hidden>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return <button key={tab.id} type="button" className="document-editor-tab" data-active={activeTab === tab.id ? "true" : undefined} aria-selected={activeTab === tab.id} role="tab" onClick={() => setActiveTab(tab.id)}><Icon aria-hidden /><span>{tab.label}</span></button>;
      })}
    </nav>
    <section className="document-editor-tab-panel document-editor-document-panel" role="tabpanel" hidden={activeTab !== "document"}>{document}</section>
    <section className="document-editor-tab-panel document-editor-properties-panel" role="tabpanel" hidden={activeTab !== "metadata"}>{metadata}</section>
    <section className="document-editor-tab-panel document-editor-properties-panel" role="tabpanel" hidden={activeTab !== "relations"}>{relations}</section>
  </div>;
}
