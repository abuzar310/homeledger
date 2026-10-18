"use client";

import { useEffect } from "react";
// Catches Chrome's one-per-load install offer on any screen, for the Install card on More.
import "@/lib/install-prompt";

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
