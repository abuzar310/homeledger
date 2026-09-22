import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export const controlClass =
  "min-h-12 w-full rounded-xl border border-line bg-surface px-3.5 text-base text-ink outline-none placeholder:text-muted focus:border-primary";

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[15px] font-medium text-ink">{label}</span>
      {children}
    </label>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${controlClass} ${props.className ?? ""}`} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${controlClass} py-3 ${props.className ?? ""}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${controlClass} ${props.className ?? ""}`} />;
}

export function PrimaryButton({
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`press inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-primary px-4 text-[16px] font-semibold text-on-primary disabled:opacity-45 ${className}`}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`press inline-flex min-h-12 items-center justify-center rounded-xl border border-line bg-surface px-4 text-[16px] font-semibold text-ink disabled:opacity-45 ${className}`}
    >
      {children}
    </button>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-line bg-surface p-4 ${className}`}>{children}</section>;
}

export function ScreenTitle({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-3">
      <h1 className="text-[22px] font-semibold tracking-tight text-ink [text-wrap:balance]">{title}</h1>
      {action}
    </div>
  );
}
