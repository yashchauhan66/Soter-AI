"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { DocsSidebar } from "@/components/docs/DocsSidebar";
import { findDocsPage, findDocsSection } from "@/lib/docs/navigation";

/** A compact toolbar trigger; native modal semantics keep the background inert. */
export function DocsMobileNav() {
  const pathname = usePathname() ?? "/docs";
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const page = findDocsPage(pathname);
  const section = findDocsSection(pathname);

  if (lastPath !== pathname) {
    setLastPath(pathname);
    if (open) setOpen(false);
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <div className="docs-mobile-navigation">
      <button type="button" onClick={() => setOpen(true)} aria-expanded={open}
        aria-controls="docs-mobile-nav" aria-haspopup="dialog" className="docs-mobile-trigger">
        <Menu size={16} aria-hidden="true" /> Guides
      </button>
      <dialog ref={dialogRef} id="docs-mobile-nav" aria-label="Documentation navigation"
        className="docs-mobile-dialog" onCancel={() => setOpen(false)} onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget || (event.target instanceof Element && event.target.closest("a[href]"))) setOpen(false);
        }}>
        <div className="docs-mobile-dialog-header">
          <div>
            <p>Documentation</p>
            <p className="docs-mobile-current">{section?.label ?? "All services"} / {page?.label ?? "Service guide"}</p>
          </div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close navigation" className="docs-mobile-close">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="docs-mobile-dialog-body"><DocsSidebar /></div>
      </dialog>
    </div>
  );
}
