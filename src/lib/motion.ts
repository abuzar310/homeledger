import { useState } from "react";

export function useSessionOnce(key: string) {
  const [play] = useState(() => {
    if (typeof sessionStorage === "undefined") return true;
    if (sessionStorage.getItem(key)) return false;
    sessionStorage.setItem(key, "1");
    return true;
  });
  return play;
}

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
