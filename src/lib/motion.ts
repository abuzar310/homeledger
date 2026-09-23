import { useEffect, useState } from "react";

export function useSessionOnce(key: string) {
  const [play, setPlay] = useState(false);
  useEffect(() => {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    setPlay(true);
  }, [key]);
  return play;
}

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
