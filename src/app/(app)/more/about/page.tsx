import { Card, ScreenTitle } from "@/components/ui";

export default function AboutPage() {
  return (
    <div className="space-y-4">
      <ScreenTitle title="About" />
      <Card>
        <p className="text-lg font-semibold">HomeLedger</p>
        <p className="mt-1 text-muted">Simple spending. A better home.</p>
        <p className="mt-4 text-[15px] text-muted">Version 1</p>
      </Card>
    </div>
  );
}
