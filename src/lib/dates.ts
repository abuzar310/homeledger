const IST = "Asia/Kolkata";

export function todayISO(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: IST }).format(now);
}

export function monthKey(date = new Date()): string {
  return todayISO(date).slice(0, 7);
}

export function monthStart(key: string): string {
  return `${key}-01`;
}

export function monthEnd(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${key}-${String(last).padStart(2, "0")}`;
}

export function previousMonth(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function formatMonthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatDayHeading(iso: string, today = todayISO()): { title: string; subtitle: string } {
  const yesterday = shiftISO(today, -1);
  const pretty = new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  if (iso === today) return { title: "Today", subtitle: pretty };
  if (iso === yesterday) return { title: "Yesterday", subtitle: pretty };
  return { title: pretty, subtitle: "" };
}

export function formatTimeIST(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: IST,
  });
}

export function formatRelativeDay(iso: string, today = todayISO()): string {
  const yesterday = shiftISO(today, -1);
  if (iso === today) return "Today";
  if (iso === yesterday) return "Yesterday";
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function daysElapsedInMonth(key: string, today = todayISO()): number {
  if (!today.startsWith(key)) {
    const end = monthEnd(key);
    return Number(end.slice(8));
  }
  return Number(today.slice(8));
}

export function daysInMonth(key: string): number {
  return Number(monthEnd(key).slice(8));
}

export function shiftISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function startOfWeek(iso: string): string {
  const dow = new Date(`${iso}T00:00:00Z`).getUTCDay();
  const back = dow === 0 ? 6 : dow - 1;
  return shiftISO(iso, -back);
}

export function weekDays(monday: string): string[] {
  return Array.from({ length: 7 }, (_, i) => shiftISO(monday, i));
}

export function formatWeekRange(start: string, end: string): string {
  const a = new Date(`${start}T00:00:00Z`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  const b = new Date(`${end}T00:00:00Z`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  return `${a} – ${b}`;
}

export function weekdayShort(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", {
    weekday: "short",
    timeZone: "UTC",
  });
}
