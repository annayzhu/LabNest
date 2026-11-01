"use client";

import { Paperclip } from "lucide-react";
import { useState, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { buttonStyles } from "./Button";

type FilePickerProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "className"> & {
  label?: string;
  className?: string;
  onFiles?: (files: File[]) => void;
};

/**
 * A file input shown as a quiet button that names what was chosen, in place of the browser's own "Choose File, no file
 * chosen", which never follows the interface language (Q198). Remount it with a new `key` to clear it.
 */
export function FilePicker({ label = "Choose a file", className, onFiles, onChange, ...input }: FilePickerProps) {
  const [names, setNames] = useState<string[]>([]);
  return (
    <label className={buttonStyles({ size: "sm", className: cn("min-w-0 max-w-full cursor-pointer focus-within:ring-2 focus-within:ring-[var(--action)]", className) })}>
      <Paperclip className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="truncate">{names.length ? names.join(" · ") : label}</span>
      <input
        {...input}
        type="file"
        className="sr-only"
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          setNames(files.map((file) => file.name));
          onFiles?.(files);
          onChange?.(event);
        }}
      />
    </label>
  );
}
