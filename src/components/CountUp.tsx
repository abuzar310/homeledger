"use client";

import { useEffect, useRef, useState } from "react";
import { formatINR } from "@/lib/money";
import { prefersReducedMotion } from "@/lib/motion";

export function CountUp({
  value,
  className = "",
}: {
  value: number;
  className?: string;
}) {
  const [shown, setShown] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    if (prefersReducedMotion() || fromRef.current === value) {
      fromRef.current = value;
      setShown(value);
      return;
    }
    const from = fromRef.current;
    const start = performance.now();
    const dur = 420;
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - (1 - p) ** 3;
      setShown(from + (value - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <span className={className}>{formatINR(Math.round(shown))}</span>;
}
