"use client";

import { useState } from "react";
import { BottomSheet } from "./BottomSheet";
import { PrimaryButton, SecondaryButton } from "./ui";

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  busyLabel,
  danger,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  busyLabel?: string;
  danger?: boolean;
  /** May be async. The dialog stays open with an error if it throws, and closes when it resolves. */
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  function close() {
    if (pending) return;
    setFailed(false);
    onClose();
  }

  async function confirm() {
    if (pending) return;
    setPending(true);
    setFailed(false);
    try {
      await onConfirm();
    } catch {
      setPending(false);
      setFailed(true);
      return;
    }
    setPending(false);
    onClose();
  }

  return (
    <BottomSheet open={open} title={title} onClose={close}>
      <p className="text-[15px] text-muted">{body}</p>
      {failed ? (
        <p className="mt-3 text-[15px] text-danger" role="alert">
          Could not {confirmLabel.toLowerCase()}. Check your connection and try again.
        </p>
      ) : null}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <SecondaryButton onClick={close} disabled={pending}>
          Cancel
        </SecondaryButton>
        <PrimaryButton className={danger ? "bg-danger" : ""} onClick={() => void confirm()} disabled={pending}>
          {pending ? busyLabel ?? `${confirmLabel}…` : confirmLabel}
        </PrimaryButton>
      </div>
    </BottomSheet>
  );
}
