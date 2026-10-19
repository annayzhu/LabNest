"use client";

import { useEffect, useRef, type RefObject } from "react";
import type { Editor } from "@tiptap/core";
import { usePortalFormPending } from "./usePortalFormPending";

/** Editor menus live under body, so inherit the form's save lock explicitly. */
export function useEditorPortalPending(editor: Editor, portal: RefObject<HTMLElement | null>) {
  const anchor = useRef<HTMLElement | null>(null);
  useEffect(() => { anchor.current = editor.view.dom; }, [editor]);
  return usePortalFormPending(anchor, portal, true);
}
