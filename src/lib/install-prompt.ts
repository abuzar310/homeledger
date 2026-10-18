/**
 * Chrome and Edge fire `beforeinstallprompt` once per page load, often before any screen asks for
 * it. This module catches it the moment it is first imported and keeps it for the Install card.
 * Import it early (for example from PwaRegister) so the event is never missed.
 */

export type InstallOutcome = "accepted" | "dismissed";
export type InstallPromptEvent = Event & {
  prompt: () => Promise<unknown>;
  userChoice: Promise<{ outcome: InstallOutcome; platform?: string }>;
};
export type InstallState = { prompt: InstallPromptEvent | null; installed: boolean };

export function createInstallStore(target?: EventTarget) {
  let state: InstallState = { prompt: null, installed: false };
  const listeners = new Set<() => void>();
  const set = (next: Partial<InstallState>) => {
    state = { ...state, ...next };
    for (const listener of listeners) listener();
  };

  if (target) {
    target.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault(); // offer it from our own card instead of the browser's banner
      set({ prompt: event as InstallPromptEvent });
    });
    target.addEventListener("appinstalled", () => set({ prompt: null, installed: true }));
  }

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => state,
    /** Shows the browser's install dialog. Call straight from a tap: browsers need the gesture. */
    async prompt(): Promise<InstallOutcome | null> {
      const event = state.prompt;
      if (!event) return null;
      try {
        await event.prompt();
        const { outcome } = await event.userChoice;
        if (outcome === "accepted") set({ installed: true });
        return outcome;
      } finally {
        set({ prompt: null }); // each event can prompt only once
      }
    },
  };
}

const SERVER_STATE: InstallState = { prompt: null, installed: false };
export const getServerInstallState = () => SERVER_STATE;

export const installStore = createInstallStore(typeof window === "undefined" ? undefined : window);

type NavigatorLike = { userAgent: string; maxTouchPoints?: number; standalone?: boolean };
type MatchMedia = (query: string) => { matches: boolean };

/** True when running as the installed app rather than in a browser tab. */
export function isInstalledDisplay(matchMedia: MatchMedia | undefined, nav: NavigatorLike): boolean {
  if (nav.standalone === true) return true; // iOS home-screen apps
  if (!matchMedia) return false;
  return ["standalone", "fullscreen", "minimal-ui", "window-controls-overlay"].some(
    (mode) => matchMedia(`(display-mode: ${mode})`).matches,
  );
}

/**
 * iPhone and iPad browsers have no install prompt; there it is Share, then Add to Home Screen.
 * In-app browsers (Instagram, Facebook, Google app…) have no such option, so they get no tip.
 */
export function needsIosInstallTip(nav: NavigatorLike): boolean {
  const ua = nav.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && (nav.maxTouchPoints ?? 0) > 1);
  if (!ios || !/Safari\//.test(ua)) return false;
  return !/FBAN|FBAV|Instagram|Line\/|GSA\/|Snapchat|LinkedInApp|Twitter/.test(ua);
}
