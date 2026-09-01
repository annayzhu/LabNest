"use client";

import { createContext, useContext } from "react";
import type { Editor } from "@tiptap/core";

type DocumentToolbarTarget = {
  activate: (editor: Editor) => void;
  release: (editor: Editor) => void;
};

export const DocumentToolbarTargetContext = createContext<DocumentToolbarTarget | null>(null);

export function useDocumentToolbarTarget() {
  return useContext(DocumentToolbarTargetContext);
}
