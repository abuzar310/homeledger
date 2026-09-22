import { AddExpenseForm } from "@/components/AddExpenseForm";
import { ScreenTitle } from "@/components/ui";

export default function AddPage() {
  return (
    <div className="space-y-4">
      <ScreenTitle title="Add expense" />
      <AddExpenseForm />
    </div>
  );
}
