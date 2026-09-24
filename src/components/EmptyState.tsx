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
    <div className="px-2 py-12 text-center">
      <IconWell icon={icon} className="mx-auto size-14" />
      <h2 className="mt-4 text-[20px] font-semibold tracking-tight text-ink">{title}</h2>
      <p className="mx-auto mt-2 max-w-[18rem] text-[15px] leading-relaxed text-muted">{body}</p>
      {action ? <div className="mx-auto mt-6 max-w-xs">{action}</div> : null}
    </div>
  );
}
