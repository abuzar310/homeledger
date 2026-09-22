import { AppShell } from "@/components/AppShell";
import { HouseholdProvider } from "@/components/HouseholdProvider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <HouseholdProvider>
      <AppShell>{children}</AppShell>
    </HouseholdProvider>
  );
}
