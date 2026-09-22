"use client";

import { useRef, useState, type ReactNode, type TouchEvent } from "react";

export function PullRefresh({
  onRefresh,
  children,
}: {
  onRefresh: () => Promise<void> | void;
  children: ReactNode;
}) {
  const startY = useRef(0);
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);

  function onStart(e: TouchEvent) {
    if (window.scrollY > 0 || busy) return;
    startY.current = e.touches[0].clientY;
  }

  function onMove(e: TouchEvent) {
    if (window.scrollY > 0 || busy || !startY.current) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) setPull(Math.min(72, dy * 0.45));
  }

  async function onEnd() {
    const should = pull > 48 && !busy;
    setPull(0);
    startY.current = 0;
    if (!should) return;
    setBusy(true);
    try {
      await onRefresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={() => void onEnd()}>
      <p
        className="overflow-hidden text-center text-[13px] text-muted"
        style={{ height: busy ? 28 : pull, opacity: busy || pull > 12 ? 1 : 0 }}
        aria-hidden={!busy}
      >
        {busy ? "Refreshing…" : "Pull to refresh"}
      </p>
      {children}
    </div>
  );
}
