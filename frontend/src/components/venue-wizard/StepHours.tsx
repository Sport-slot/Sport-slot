import { useState } from "react";
import { Check, Copy } from "@phosphor-icons/react";
import { FieldError, inputClass } from "@/components/form/fields";
import type { DayOfWeek } from "@/lib/api";
import {
  dayNames,
  daysOfWeek,
  hoursPresets,
  sameHours,
  type DayHours,
  type VenueFormErrors,
  type VenueFormValues,
} from "@/lib/venueForm";

const timeInputClass = `${inputClass} min-h-11 px-2 py-2 text-sm tabular-nums sm:px-3`;

export function StepHours({
  values,
  errors,
  onDayChange,
  onHoursChange,
}: {
  values: VenueFormValues;
  errors: VenueFormErrors;
  onDayChange: (day: DayOfWeek, patch: Partial<DayHours>) => void;
  onHoursChange: (hours: Record<DayOfWeek, DayHours>) => void;
}) {
  const [notice, setNotice] = useState("");

  function copyToOpenDays(source: DayOfWeek) {
    const { openTime, closeTime } = values.hours[source];
    const hours = { ...values.hours };
    for (const day of daysOfWeek) {
      if (hours[day].open) hours[day] = { ...hours[day], openTime, closeTime };
    }
    onHoursChange(hours);
    setNotice(`Časy ${openTime} až ${closeTime} jsou nastavené pro všechny otevřené dny.`);
  }

  return (
    <div className="grid gap-6">
      <fieldset>
        <legend className="text-sm font-semibold text-foreground">Rychlé nastavení</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {hoursPresets.map((preset) => {
            const active = sameHours(values.hours, preset.hours);
            return (
              <button
                key={preset.id}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  onHoursChange(preset.hours);
                  setNotice(`Nastaveno: ${preset.label}.`);
                }}
                className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors ${
                  active ? "border-foreground bg-foreground text-page" : "border-line hover:bg-surface"
                }`}
              >
                {active && <Check size={15} weight="bold" aria-hidden="true" />}
                {preset.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <p role="status" className={notice ? "text-sm text-muted" : "sr-only"}>{notice}</p>

      <fieldset aria-describedby={errors.hours ? "venue-hours-error" : undefined}>
        <legend className="text-sm font-semibold text-foreground">Jednotlivé dny</legend>
        <FieldError id="venue-hours-error">{errors.hours}</FieldError>
        <ul className="mt-2 divide-y divide-line rounded-2xl border border-line">
          {daysOfWeek.map((day) => {
            const hours = values.hours[day];
            const dayError = errors.days?.[day];
            const errorId = `venue-hours-${day}-error`;
            const canCopy = hours.open && hours.openTime && hours.closeTime > hours.openTime;
            return (
              <li key={day} className="grid items-center gap-x-4 gap-y-2 px-4 py-3 sm:grid-cols-[10rem_minmax(0,1fr)_auto] sm:px-5">
                <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium">
                  <span className="relative flex shrink-0 items-center">
                    <input
                      id={`venue-day-${day}`}
                      type="checkbox"
                      role="switch"
                      className="peer absolute inset-0 z-10 size-full cursor-pointer opacity-0"
                      checked={hours.open}
                      aria-invalid={Boolean(errors.hours)}
                      onChange={(event) => onDayChange(day, { open: event.target.checked })}
                    />
                    <span aria-hidden="true" className="h-6 w-10 rounded-full bg-line transition-colors peer-checked:bg-brand-500 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-foreground" />
                    <span aria-hidden="true" className="absolute left-1 size-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-4" />
                  </span>
                  {dayNames[day]}
                </label>
                {hours.open ? (
                  <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:max-w-80">
                    <input type="time" step={900} className={timeInputClass} aria-label={`${dayNames[day]}, otevírá`} value={hours.openTime} aria-invalid={Boolean(dayError)} aria-describedby={dayError ? errorId : undefined} onChange={(event) => onDayChange(day, { openTime: event.target.value })} />
                    <span aria-hidden="true" className="text-muted">-</span>
                    <input type="time" step={900} className={timeInputClass} aria-label={`${dayNames[day]}, zavírá`} value={hours.closeTime} aria-invalid={Boolean(dayError)} aria-describedby={dayError ? errorId : undefined} onChange={(event) => onDayChange(day, { closeTime: event.target.value })} />
                  </div>
                ) : (
                  <p className="flex min-h-11 items-center text-sm text-muted">Zavřeno</p>
                )}
                {hours.open ? (
                  <button
                    type="button"
                    disabled={!canCopy}
                    onClick={() => copyToOpenDays(day)}
                    className="inline-flex min-h-11 items-center gap-1.5 justify-self-start rounded-lg px-2 text-xs font-semibold text-muted transition-colors hover:bg-surface hover:text-foreground disabled:opacity-40 sm:justify-self-end"
                  >
                    <Copy size={15} aria-hidden="true" />
                    Použít pro všechny<span className="sr-only"> otevřené dny ({dayNames[day]})</span>
                  </button>
                ) : (
                  <span className="hidden sm:block" />
                )}
                {dayError && (
                  <div className="sm:col-span-3">
                    <FieldError id={errorId}>{dayError}</FieldError>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </fieldset>
    </div>
  );
}
