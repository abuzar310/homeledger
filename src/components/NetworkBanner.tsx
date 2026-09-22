"use client";

import { useEffect, useState } from "react";

export function NetworkBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  if (!offline) return null;
  return (
    <p className="offline-bar bg-warn/15 px-3 py-2 text-center text-[13px] font-medium text-warn" role="status">
      Offline
    </p>
  );
}
