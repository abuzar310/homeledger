"use client";

import { useHousehold } from "@/components/HouseholdProvider";
import { Card, ScreenTitle } from "@/components/ui";

export default function PaymentMethodsPage() {
  const { catalogs } = useHousehold();
  return (
    <div className="space-y-4">
      <ScreenTitle title="Payment methods" />
      <Card>
        <ul>
          {catalogs.paymentMethods.map((method) => (
            <li key={method.id} className="min-h-12 border-b border-line py-3 last:border-0">
              {method.name}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
