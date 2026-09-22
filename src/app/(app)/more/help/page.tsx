import { Card, ScreenTitle } from "@/components/ui";

export default function HelpPage() {
  return (
    <div className="space-y-4">
      <ScreenTitle title="Help & support" />
      <Card className="space-y-3 text-[16px] leading-7 text-ink">
        <p>Sign in with Google or email so your household stays separate from a friend&apos;s.</p>
        <p>To add an expense, tap Add, type what you bought, enter the amount, and save.</p>
        <p>HomeLedger organises the expense for you. If something looks wrong, open it and change the category.</p>
        <p>Use Reports to see where money went this month.</p>
      </Card>
    </div>
  );
}
