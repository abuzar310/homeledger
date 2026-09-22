import type { ReactNode } from "react";
import { Wallet, type LucideIcon } from "lucide-react";
import { IconWell } from "./ui";

export function EmptyState({
  title,
  body,
  action,
  icon = Wallet,
}: {
  title: string;
  body: string;
  action?: ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className="px-1 py-10 text-center">
      <IconWell icon={icon} className="mx-auto size-14" />
      <h2 className="mt-4 text-lg font-semibold text-ink">{title}</h2>
      <p className="mx-auto mt-2 max-w-xs text-[15px] text-muted">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
