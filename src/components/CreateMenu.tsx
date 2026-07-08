"use client";

import { useEffect, useRef, useState } from "react";
import {
  Beaker,
  BookOpen,
  Boxes,
  ChevronDown,
  ClipboardList,
  Database,
  FlaskConical,
  FolderKanban,
  ImagePlus,
  Paperclip,
  Plus,
  ShoppingCart,
  Sparkles,
  TestTube2,
  Upload,
} from "lucide-react";
import { Button } from "./ui/Button";
import { cn } from "@/lib/cn";

const groups = [
  {
    title: "Entry",
    items: [
      { label: "Text Entry", icon: BookOpen },
      { label: "Photo Entry", icon: ImagePlus },
      { label: "Voice Entry placeholder", icon: Sparkles },
      { label: "File Entry", icon: Paperclip },
    ],
  },
  {
    title: "Experiment",
    items: [
      { label: "Blank Experiment", icon: Beaker },
      { label: "From Protocol", icon: ClipboardList },
      { label: "From Entry", icon: BookOpen },
    ],
  },
  {
    title: "Lab Objects",
    items: [
      { label: "Blank Protocol", icon: FlaskConical },
      { label: "Project", icon: FolderKanban },
      { label: "Entity / Sample", icon: TestTube2 },
      { label: "Inventory Item", icon: Boxes },
      { label: "Result", icon: Database },
      { label: "Purchase", icon: ShoppingCart },
      { label: "Import / Attachment", icon: Upload },
    ],
  },
];

const mobileItems = [
  "Quick Entry",
  "Start from Protocol",
  "Photo Entry",
  "Add Result",
  "Add Inventory",
  "Add Sample",
];

export function CreateMenu() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointer(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointer);
    return () => document.removeEventListener("mousedown", handlePointer);
  }, []);

  return (
    <div ref={menuRef} className="relative">
      <Button
        type="button"
        variant="primary"
        className="hidden sm:inline-flex"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((current) => !current)}
      >
        <Plus className="h-4 w-4" aria-hidden />
        Create
        <ChevronDown className="h-4 w-4" aria-hidden />
      </Button>
      <Button
        type="button"
        variant="primary"
        size="icon"
        className="sm:hidden"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((current) => !current)}
      >
        <Plus className="h-5 w-5" aria-hidden />
        <span className="sr-only">Create</span>
      </Button>

      {open ? (
        <div
          role="menu"
          className={cn(
            "fixed inset-x-3 bottom-20 z-50 rounded-[16px] border border-hairline bg-surface p-3 shadow-soft sm:absolute sm:inset-auto sm:right-0 sm:top-12 sm:w-[520px]",
          )}
        >
          <div className="hidden grid-cols-3 gap-3 sm:grid">
            {groups.map((group) => (
              <div key={group.title} className="rounded-[10px] bg-warm p-2">
                <p className="px-2 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-muted">
                  {group.title}
                </p>
                <div className="mt-1 space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.label}
                        className="focus-ring flex w-full items-center gap-2 rounded-[8px] px-2 py-2 text-left text-sm text-graphite transition hover:bg-sage-surface/70 hover:text-ink"
                        role="menuitem"
                        type="button"
                        onClick={() => setOpen(false)}
                      >
                        <Icon className="h-4 w-4 text-moss" aria-hidden />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:hidden">
            {mobileItems.map((item) => (
              <button
                key={item}
                className="focus-ring rounded-[10px] border border-hairline bg-warm px-3 py-3 text-left text-sm font-medium text-ink"
                role="menuitem"
                type="button"
                onClick={() => setOpen(false)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
