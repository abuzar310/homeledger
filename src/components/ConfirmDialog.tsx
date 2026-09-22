"use client";

import { BottomSheet } from "./BottomSheet";
import { PrimaryButton, SecondaryButton } from "./ui";

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  danger,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <BottomSheet open={open} title={title} onClose={onClose}>
      <p className="text-[15px] text-muted">{body}</p>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
        <PrimaryButton className={danger ? "bg-danger" : ""} onClick={onConfirm}>
          {confirmLabel}
        </PrimaryButton>
      </div>
    </BottomSheet>
  );
}
