"use client";

import { useHousehold } from "@/components/HouseholdProvider";
import { Card, ScreenTitle } from "@/components/ui";

export default function SettingsPage() {
  const { household } = useHousehold();

  return (
    <div className="space-y-4">
      <ScreenTitle title="App settings" />
      <Card>
        <p className="text-[15px] text-muted">Home</p>
        <p className="text-lg font-semibold">{household?.name ?? "My Home"}</p>
        <p className="mt-3 text-[15px] text-muted">Expenses are saved to this household automatically. No sign-in needed.</p>
      </Card>
    </div>
  );
}
