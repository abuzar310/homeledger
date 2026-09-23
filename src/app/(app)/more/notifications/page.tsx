"use client";

import { useEffect, useState } from "react";
import { Card, PrimaryButton, ScreenTitle } from "@/components/ui";
import { readNotifyPrefs, requestNotifyPermission, writeNotifyPrefs, type NotifyPrefs } from "@/lib/notify";

export default function NotificationsPage() {
  const [prefs, setPrefs] = useState<NotifyPrefs>({ recurringReminders: true, monthlySummary: true });
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    setPrefs(readNotifyPrefs());
  }, []);

  function save(next: NotifyPrefs) {
    setPrefs(next);
    writeNotifyPrefs(next);
  }

  return (
    <div className="space-y-4">
      <ScreenTitle title="Notifications" />
      <p className="text-[15px] text-muted">Quiet reminders only. Nothing about balances or investments.</p>
      <Card className="space-y-4">
        <label className="flex min-h-12 items-center justify-between gap-3">
          <span>Recurring bill reminders</span>
          <input
            type="checkbox"
            checked={prefs.recurringReminders}
            onChange={(e) => save({ ...prefs, recurringReminders: e.target.checked })}
          />
        </label>
        <label className="flex min-h-12 items-center justify-between gap-3">
          <span>Monthly summary</span>
          <input
            type="checkbox"
            checked={prefs.monthlySummary}
            onChange={(e) => save({ ...prefs, monthlySummary: e.target.checked })}
          />
        </label>
      </Card>
      <PrimaryButton
        onClick={async () => {
          const ok = await requestNotifyPermission();
          setStatus(ok ? "Reminders can appear on this phone." : "This browser blocked notifications.");
        }}
      >
        Allow reminders
      </PrimaryButton>
      {status ? <p className="text-[15px] text-muted">{status}</p> : null}
    </div>
  );
}
