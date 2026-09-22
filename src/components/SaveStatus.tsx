export function SaveStatus({
  state,
  onRetry,
}: {
  state: "idle" | "saving" | "saved" | "error";
  onRetry?: () => void;
}) {
  if (state === "idle") return null;
  if (state === "saving") {
    return (
      <p className="text-center text-[14px] text-muted" aria-live="polite">
        Saving…
      </p>
    );
  }
  if (state === "saved") {
    return (
      <p className="text-center text-[14px] font-medium text-accent" aria-live="polite">
        Saved
      </p>
    );
  }
  return (
    <p className="text-center text-[14px] text-danger" role="alert">
      Couldn&apos;t save —{" "}
      <button className="font-semibold underline" onClick={onRetry}>
        Retry
      </button>
    </p>
  );
}
