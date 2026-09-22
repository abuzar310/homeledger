"use client";

import { useRouter } from "next/navigation";
import { useHousehold } from "@/components/HouseholdProvider";
import { Card, PrimaryButton, ScreenTitle } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

export default function SettingsPage() {
  const router = useRouter();
  const { household } = useHousehold();

  return (
    <div className="space-y-4">
      <ScreenTitle title="App settings" />
      <Card>
        <p className="text-[15px] text-muted">Home</p>
        <p className="text-lg font-semibold">{household?.name ?? "My Home"}</p>
      </Card>
      <PrimaryButton
        onClick={async () => {
          await createClient().auth.signOut();
          router.replace("/login");
        }}
      >
        Sign out
      </PrimaryButton>
    </div>
  );
}
