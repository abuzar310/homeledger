"use client";

import type { ReactNode } from "react";
import { useEffect, useEffectEvent, useRef, useState } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

function focusables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.getClientRects().length > 0);
}

export function BottomSheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const [shown, setShown] = useState(open);
  const [leaving, setLeaving] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const active = open && shown;
  const close = useEffectEvent(() => onClose());

  // Remember what had focus before the sheet opened, so closing can hand it back.
  useEffect(() => {
    if (!open) return;
    const current = document.activeElement;
    if (current instanceof HTMLElement && current !== document.body && !panel.current?.contains(current)) {
      opener.current = current;
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      setShown(true);
      setLeaving(false);
      return;
    }
    if (!shown) return;
    setLeaving(true);
    const t = window.setTimeout(() => {
      setShown(false);
      setLeaving(false);
    }, 200);
    return () => window.clearTimeout(t);
  }, [open, shown]);

  useEffect(() => {
    const node = panel.current;
    if (!active || !node) return;
    // Move focus in unless a field inside already took it (autoFocus).
    if (!node.contains(document.activeElement)) (focusables(node)[0] ?? node).focus();

    const body = document.body.style;
    const before = { overflow: body.overflow, paddingRight: body.paddingRight };
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    body.overflow = "hidden";
    if (scrollbar > 0) body.paddingRight = `${scrollbar}px`;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables(node);
      const first = items[0];
      const last = items[items.length - 1];
      const at = document.activeElement;
      if (!first || !last) {
        e.preventDefault();
        node.focus();
      } else if (e.shiftKey && (at === first || !node.contains(at))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (at === last || !node.contains(at))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
      body.overflow = before.overflow;
      body.paddingRight = before.paddingRight;
      const back = opener.current;
      opener.current = null;
      if (back?.isConnected) back.focus({ preventScroll: true });
    };
  }, [active]);

  if (!shown) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
      <button
        className={`sheet-scrim absolute inset-0 ${leaving ? "leaving" : ""}`}
        aria-label="Close"
        tabIndex={-1}
        onClick={onClose}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`sheet-panel relative z-10 max-h-[88vh] w-full max-w-lg overflow-auto rounded-t-2xl border border-line bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] md:rounded-2xl ${leaving ? "leaving" : ""}`}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button className="press min-h-11 min-w-11 rounded-lg text-[15px] font-medium text-muted" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
