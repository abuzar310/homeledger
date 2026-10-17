const KEY = "hl-notify-prefs";

export type NotifyPrefs = {
  recurringReminders: boolean;
  monthlySummary: boolean;
};

const DEFAULTS: NotifyPrefs = { recurringReminders: true, monthlySummary: true };

export function readNotifyPrefs(): NotifyPrefs {
  try {
    return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) || "{}") as Partial<NotifyPrefs>) };
  } catch {
    return DEFAULTS;
  }
}

export function writeNotifyPrefs(prefs: NotifyPrefs) {
  localStorage.setItem(KEY, JSON.stringify(prefs));
}

export async function requestNotifyPermission(): Promise<boolean> {
  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const next = await Notification.requestPermission();
  return next === "granted";
}

async function serviceWorkerReady(timeoutMs = 3000): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  // `ready` never settles when no worker is registered, so don't wait on it forever.
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => window.setTimeout(() => resolve(null), timeoutMs)),
  ]).catch(() => null);
}

/** Android Chrome only shows notifications through the service worker; `new Notification` throws there. */
export async function notifyIfAllowed(title: string, body: string) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  const registration = await serviceWorkerReady();
  if (registration) {
    try {
      await registration.showNotification(title, { body, icon: "/icon-192.png" });
      return;
    } catch {
      /* fall back below */
    }
  }
  try {
    new Notification(title, { body });
  } catch {
    /* ignore blocked/unsupported */
  }
}
