"use client";

import { Download, Share } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { getServerInstallState, installStore, isInstalledDisplay, needsIosInstallTip } from "@/lib/install-prompt";
import { Card, IconWell, PrimaryButton, SecondaryButton } from "./ui";

const DISMISS_KEY = "hl-install-dismissed";

type Env = { installed: boolean; iosTip: boolean; dismissed: boolean };

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function readInstalled(): boolean {
  return isInstalledDisplay(window.matchMedia?.bind(window), navigator as Navigator & { standalone?: boolean });
}

/** "Install HomeLedger" on Android / desktop Chrome, a Share tip on iPhone, nothing once installed. */
export function InstallApp() {
  const install = useSyncExternalStore(installStore.subscribe, installStore.getSnapshot, getServerInstallState);
  // null on the server and the first client render, so both render nothing.
  const [env, setEnv] = useState<Env | null>(null);
  const [prompting, setPrompting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEnv({ installed: readInstalled(), iosTip: needsIosInstallTip(navigator), dismissed: readDismissed() });
    const media = window.matchMedia?.("(display-mode: standalone)");
    const onChange = () => setEnv((cur) => (cur ? { ...cur, installed: readInstalled() } : cur));
    media?.addEventListener?.("change", onChange);
    return () => media?.removeEventListener?.("change", onChange);
  }, []);

  if (!env || env.installed || env.dismissed || install.installed) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* storage blocked: hide it for this visit only */
    }
    setEnv((cur) => (cur ? { ...cur, dismissed: true } : cur));
  }

  async function onInstall() {
    if (prompting) return;
    setPrompting(true);
    setError(null);
    try {
      await installStore.prompt();
    } catch {
      setError("Could not open the install window. Use your browser menu and choose Install app.");
    } finally {
      setPrompting(false);
    }
  }

  if (install.prompt || error) {
    return (
      <Card className="flex items-start gap-3">
        <IconWell icon={Download} />
        <div className="min-w-0 flex-1">
          <h2 className="text-[16px] font-semibold">Install HomeLedger</h2>
          <p className="mt-0.5 text-[15px] text-muted">Open it from your home screen like any other app, even offline.</p>
          {error ? (
            <p className="mt-2 text-[15px] text-danger" role="alert">
              {error}
            </p>
          ) : null}
          <div className={`mt-3 grid gap-3 ${install.prompt ? "grid-cols-2" : ""}`}>
            <SecondaryButton onClick={dismiss} disabled={prompting}>
              Not now
            </SecondaryButton>
            {install.prompt ? (
              <PrimaryButton onClick={() => void onInstall()} disabled={prompting}>
                {prompting ? "Opening…" : "Install"}
              </PrimaryButton>
            ) : null}
          </div>
        </div>
      </Card>
    );
  }

  if (!env.iosTip) return null;
  return (
    <Card className="flex items-center gap-3">
      <IconWell icon={Share} className="size-9" />
      <p className="min-w-0 flex-1 text-[15px]">On iPhone: tap Share, then Add to Home Screen.</p>
      <button type="button" className="press min-h-11 shrink-0 rounded-xl px-3 text-[15px] font-semibold text-primary" onClick={dismiss}>
        Not now
      </button>
    </Card>
  );
}
