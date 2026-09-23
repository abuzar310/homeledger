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

export function notifyIfAllowed(title: string, body: string) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    new Notification(title, { body });
  } catch {
    /* ignore blocked/unsupported */
  }
}
