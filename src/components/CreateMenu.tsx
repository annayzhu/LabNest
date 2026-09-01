"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  Beaker,
  BookOpen,
  Boxes,
  ChevronDown,
  ClipboardList,
  Database,
  Dna,
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
      { label: "Text Entry", icon: BookOpen, href: "/entries/new?source=text" },
      { label: "Photo Entry", icon: ImagePlus, href: "/entries/new?source=photo" },
      { label: "Voice Entry placeholder", icon: Sparkles, href: "/entries/new?source=voice" },
      { label: "File Entry", icon: Paperclip, href: "/entries/new?source=file" },
    ],
  },
  {
    title: "Experiment",
    items: [
      { label: "Blank Experiment", icon: Beaker, href: "/entries/new" },
      { label: "From Protocol", icon: ClipboardList, href: "/entries/new" },
      { label: "From Entry", icon: BookOpen, href: "/entries" },
    ],
  },
  {
    title: "Sequences",
    items: [
      { label: "Primer", icon: Dna, href: "/sequences/new?category=primer" },
      { label: "DNA / RNA sequence", icon: Dna, href: "/sequences/new?category=dna-rna" },
      { label: "AA sequence", icon: Dna, href: "/sequences/new?category=amino-acid" },
      { label: "Probe / oligo", icon: Dna, href: "/sequences/new?category=probe-oligo" },
      { label: "siRNA duplex", icon: Dna, href: "/sequences/new?category=sirna-duplex" },
      { label: "CRISPR guide", icon: Sparkles, href: "/sequences/new?category=crispr-guide" },
      { label: "shRNA", icon: Dna, href: "/sequences/new?category=shrna" },
      { label: "Alignment", icon: Dna, href: "/sequences/workflows/new?type=alignment" },
      { label: "Assembly", icon: FlaskConical, href: "/sequences/workflows/new?type=assembly" },
      { label: "CRISPR design", icon: Sparkles, href: "/sequences/workflows/new?type=crispr" },
    ],
  },
  {
    title: "Lab Objects",
    items: [
      { label: "Blank Protocol", icon: FlaskConical, href: "/protocols/new" },
      { label: "Project", icon: FolderKanban, href: "/projects" },
      { label: "Entity from schema", icon: TestTube2, href: "/entities/new" },
      { label: "Mixture recipe", icon: FlaskConical, href: "/entities/new?type=mixture&mixtureKind=recipe" },
      { label: "Mixture preparation", icon: FlaskConical, href: "/entities/new?type=mixture&mixtureKind=preparation" },
      { label: "Inventory Item", icon: Boxes, href: "/inventory" },
      { label: "Result", icon: Database, href: "/results" },
      { label: "Purchase", icon: ShoppingCart, href: "/purchases" },
      { label: "Import / Attachment", icon: Upload, href: "/attachments" },
    ],
  },
];

const mobileItems = [
  { label: "Quick Entry", href: "/entries/new?source=text" },
  { label: "Start from Protocol", href: "/entries/new" },
  { label: "Photo Entry", href: "/entries/new?source=photo" },
  { label: "Add Result", href: "/results" },
  { label: "Add Inventory", href: "/inventory" },
  { label: "Primer", href: "/sequences/new?category=primer" },
  { label: "DNA / RNA", href: "/sequences/new?category=dna-rna" },
  { label: "AA sequence", href: "/sequences/new?category=amino-acid" },
  { label: "Probe / oligo", href: "/sequences/new?category=probe-oligo" },
  { label: "siRNA duplex", href: "/sequences/new?category=sirna-duplex" },
  { label: "CRISPR guide", href: "/sequences/new?category=crispr-guide" },
  { label: "shRNA", href: "/sequences/new?category=shrna" },
  { label: "Alignment", href: "/sequences/workflows/new?type=alignment" },
  { label: "Assembly", href: "/sequences/workflows/new?type=assembly" },
  { label: "CRISPR design", href: "/sequences/workflows/new?type=crispr" },
  { label: "Entity from schema", href: "/entities/new" },
  { label: "Mixture recipe", href: "/entities/new?type=mixture&mixtureKind=recipe" },
  { label: "Mixture preparation", href: "/entities/new?type=mixture&mixtureKind=preparation" },
  { label: "Add Sample", href: "/samples" },
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
            "fixed inset-x-3 bottom-20 z-50 max-h-[72vh] overflow-y-auto rounded-[16px] border border-hairline bg-surface p-3 shadow-soft sm:absolute sm:inset-auto sm:right-0 sm:top-12 sm:w-[760px] sm:max-w-[calc(100vw-2rem)]",
          )}
        >
          <div className="hidden grid-cols-4 gap-3 sm:grid">
            {groups.map((group) => (
              <div key={group.title} className="rounded-[10px] bg-warm p-2">
                <p className="px-2 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-muted">
                  {group.title}
                </p>
                <div className="mt-1 space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.label}
                        href={item.href}
                        className="focus-ring flex w-full items-center gap-2 rounded-[8px] px-2 py-2 text-left text-sm text-graphite transition hover:bg-sage-surface/70 hover:text-ink"
                        role="menuitem"
                        onClick={() => setOpen(false)}
                      >
                        <Icon className="h-4 w-4 text-moss" aria-hidden />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:hidden">
            {mobileItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="focus-ring rounded-[10px] border border-hairline bg-warm px-3 py-3 text-left text-sm font-medium text-ink"
                role="menuitem"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
