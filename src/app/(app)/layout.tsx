import { AppShell } from "@/components/AppShell";
import { HouseholdProvider } from "@/components/HouseholdProvider";
import { OfflineFlush } from "@/components/OfflineFlush";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <HouseholdProvider>
      <OfflineFlush />
      <AppShell>{children}</AppShell>
    </HouseholdProvider>
  );
}
