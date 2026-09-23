import { Card, ScreenTitle } from "@/components/ui";

export default function HelpPage() {
  return (
    <div className="space-y-4">
      <ScreenTitle title="Help & support" />
      <Card className="space-y-3 text-[16px] leading-7 text-ink">
        <p>Sign in with Google or email so your household stays separate from a friend&apos;s.</p>
        <p>To add an expense, tap Add, type what you bought, enter the amount, and save. Tap Speak to fill the form from your voice. Scan a receipt to review the totals, then save yourself.</p>
        <p>HomeLedger organises the expense for you from local rules first, then Google AI if the name is unfamiliar. If something looks wrong, open it and change the category.</p>
        <p>Use Reports for the month summary. More has recurring bills, household members, notifications, and export or import.</p>
        <p>If you are offline, the expense stays on this phone and syncs when you are back.</p>
      </Card>
    </div>
  );
}
