import type { ReactNode } from "react";
import { WarningCircle } from "@phosphor-icons/react";

export const inputClass =
  "min-h-12 w-full min-w-0 rounded-xl border border-line bg-page px-3.5 py-3 text-base text-foreground transition-[border-color,box-shadow] placeholder:text-muted/65 focus:border-brand-500 focus:ring-3 focus:ring-brand-500/20 focus:outline-none aria-invalid:border-red-600 aria-invalid:focus:ring-red-600/20 disabled:cursor-wait disabled:opacity-60";
export const labelClass = "text-sm font-semibold text-foreground";
export const errorTextClass = "flex items-start gap-1.5 text-sm text-red-700 dark:text-red-300";

export function FieldError({ id, children }: { id: string; children?: ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} className={errorTextClass}>
      <WarningCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

export function TextField({
  id,
  label,
  hint,
  placeholder,
  value,
  maxLength,
  error,
  autoComplete,
  optional,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  placeholder?: string;
  value: string;
  maxLength: number;
  error?: string;
  autoComplete?: string;
  optional?: boolean;
  onChange: (value: string) => void;
}) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="grid min-w-0 content-start gap-2">
      <label htmlFor={id} className={labelClass}>
        {label}
        {optional && <span className="font-normal text-muted"> (nepovinné)</span>}
      </label>
      <input
        id={id}
        name={id}
        type="text"
        className={inputClass}
        placeholder={placeholder}
        value={value}
        maxLength={maxLength}
        autoComplete={autoComplete}
        required={!optional}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint && <p id={hintId} className="text-xs text-muted">{hint}</p>}
      <FieldError id={errorId}>{error}</FieldError>
    </div>
  );
}

export function ErrorBanner({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 sm:flex-row sm:items-start dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
      <WarningCircle size={20} className="shrink-0" aria-hidden="true" />
      <div className="flex-1">
        <p className="font-semibold">{title}</p>
        {children && <div className="mt-1 leading-relaxed">{children}</div>}
      </div>
      {action}
    </div>
  );
}
