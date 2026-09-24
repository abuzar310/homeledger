import { AddExpenseForm } from "@/components/AddExpenseForm";
import { ScreenTitle } from "@/components/ui";

export default function AddPage() {
  return (
    <div className="page-sheet space-y-5">
      <ScreenTitle title="Add expense" subtitle="Name it. The rest is organised." />
      <AddExpenseForm />
    </div>
  );
}
