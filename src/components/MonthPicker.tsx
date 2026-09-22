"use client";

import { ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";
import { formatMonthLabel, monthKey } from "@/lib/dates";
import { BottomSheet } from "./BottomSheet";

export function MonthPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const months = useMemo(() => {
    const current = monthKey();
    const [y, m] = current.split("-").map(Number);
    return Array.from({ length: 18 }, (_, i) => {
      const d = new Date(Date.UTC(y, m - 1 - i, 1));
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    });
  }, []);

  return (
    <>
      <button
        className="inline-flex min-h-11 items-center gap-1 rounded-lg text-[16px] font-medium text-ink"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        {formatMonthLabel(value)}
        <ChevronDown className="size-4" aria-hidden />
      </button>
      <BottomSheet open={open} title="Choose month" onClose={() => setOpen(false)}>
        <ul className="space-y-1">
          {months.map((key) => (
            <li key={key}>
              <button
                className={`flex min-h-12 w-full items-center rounded-xl px-3 text-left text-[16px] ${
                  key === value ? "bg-green-soft font-semibold text-green-deep" : "text-ink"
                }`}
                onClick={() => {
                  onChange(key);
                  setOpen(false);
                }}
              >
                {formatMonthLabel(key)}
              </button>
            </li>
          ))}
        </ul>
      </BottomSheet>
    </>
  );
}
