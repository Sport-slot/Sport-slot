"use client";

import { useEffect, useState } from "react";
import { ArrowClockwise, CaretLeft, CaretRight } from "@phosphor-icons/react";
import { ApiError, type DayOfWeek } from "@/lib/api";
import { addDays, type CourtAvailability, type CourtSlot, getCourtAvailability, hourRange, pragueToday } from "@/lib/courts";
import { formatPrice, listPriceRules, type PriceRule } from "@/lib/priceRules";
import type { Court } from "@/lib/venues";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "done"; days: CourtAvailability[]; rules: PriceRule[] };

const visibleDays = 7;
const shortDayNames: Record<DayOfWeek, string> = { 1: "Po", 2: "Út", 3: "St", 4: "Čt", 5: "Pá", 6: "So", 7: "Ne" };

function dayLabel(date: string): string {
  const [, month, day] = date.split("-").map(Number);
  return `${day}. ${month}.`;
}

function rangeLabel(from: string, to: string): string {
  const [, fromMonth, fromDay] = from.split("-").map(Number);
  const [, toMonth, toDay] = to.split("-").map(Number);
  return fromMonth === toMonth ? `${fromDay}.–${toDay}. ${toMonth}.` : `${fromDay}. ${fromMonth}. – ${toDay}. ${toMonth}.`;
}

function hourKey(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

function priceAt(rules: PriceRule[], dayOfWeek: DayOfWeek, startTime: string): number | undefined {
  return rules.find((rule) => rule.dayOfWeek === dayOfWeek && rule.startTime <= startTime && startTime < rule.endTime)?.pricePerHour;
}

export function FreeSlots({ courts }: { courts: Court[] }) {
  const [today] = useState(pragueToday);
  const [courtId, setCourtId] = useState(courts[0].id);
  const [start, setStart] = useState(today);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let active = true;
    setState({ status: "loading" });
    const dates = Array.from({ length: visibleDays }, (_, index) => addDays(start, index));
    Promise.all([Promise.all(dates.map((date) => getCourtAvailability(courtId, date))), listPriceRules(courtId).catch(() => [])])
      .then(([days, rules]) => {
        if (active) setState({ status: "done", days, rules });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setState({
          status: "error",
          message: error instanceof ApiError ? error.message : "Termíny se nepodařilo načíst. Zkuste to za chvíli znovu.",
        });
      });
    return () => {
      active = false;
    };
  }, [courtId, start, attempt]);

  const end = addDays(start, visibleDays - 1);
  const navButton = "flex size-10 items-center justify-center rounded-full border border-line transition-colors hover:border-foreground disabled:pointer-events-none disabled:opacity-35";

  return (
    <section aria-labelledby="free-slots-title" className="mt-16 md:mt-20">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h3 id="free-slots-title" className="font-display text-xl leading-snug font-semibold tracking-[-.02em] md:text-2xl">Volné termíny</h3>
          <p className="mt-1 text-sm text-muted">Hodinové termíny na týden dopředu. Cena je za hodinu podle ceníku kurtu.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setStart(addDays(start, -visibleDays))} disabled={start <= today} aria-label="Předchozí týden" className={navButton}>
            <CaretLeft size={16} aria-hidden="true" />
          </button>
          <p className="min-w-32 text-center text-sm font-semibold tabular-nums" aria-live="polite">{rangeLabel(start, end)}</p>
          <button type="button" onClick={() => setStart(addDays(start, visibleDays))} aria-label="Další týden" className={navButton}>
            <CaretRight size={16} aria-hidden="true" />
          </button>
          {start !== today && (
            <button type="button" onClick={() => setStart(today)} className="ml-1 inline-flex min-h-10 items-center rounded-full px-3 text-sm font-semibold underline-offset-4 hover:underline">
              Dnes
            </button>
          )}
        </div>
      </div>

      {courts.length > 1 && (
        <div role="tablist" aria-label="Kurt" className="-mx-5 mt-6 flex gap-2 overflow-x-auto px-5 pb-1 md:mx-0 md:flex-wrap md:px-0">
          {courts.map((court) => {
            const selected = court.id === courtId;
            return (
              <button key={court.id} type="button" role="tab" aria-selected={selected} onClick={() => setCourtId(court.id)} className={`inline-flex min-h-10 shrink-0 items-center rounded-full border px-4 text-sm font-medium whitespace-nowrap transition-colors ${selected ? "border-foreground bg-foreground text-page" : "border-line hover:border-muted"}`}>
                {court.name}
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-6">
        {state.status === "loading" && (
          <>
            <p role="status" className="sr-only">Načítám termíny…</p>
            <div aria-hidden="true" className="h-[22rem] animate-pulse rounded-2xl bg-surface" />
          </>
        )}
        {state.status === "error" && (
          <div role="alert" className="flex flex-wrap items-center gap-4 rounded-xl border border-line p-4 text-sm">
            <p className="flex-1">{state.message}</p>
            <button type="button" onClick={() => setAttempt((count) => count + 1)} className="button button-outline min-h-11 gap-2 px-4 py-2">
              Zkusit znovu <ArrowClockwise size={16} aria-hidden="true" />
            </button>
          </div>
        )}
        {state.status === "done" && <WeekCalendar days={state.days} rules={state.rules} today={today} />}
      </div>
    </section>
  );
}

function WeekCalendar({ days, rules, today }: { days: CourtAvailability[]; rules: PriceRule[]; today: string }) {
  const now = Date.now();
  const hours = hourRange(days.filter((day) => day.openTime && day.closeTime).map((day) => ({ start: day.openTime ?? "", end: day.closeTime ?? "" })));
  const freeCount = days.reduce((count, day) => count + day.slotList.filter((slot) => slot.free).length, 0);

  if (hours.length === 0 || days.every((day) => !day.openTime)) {
    return <p className="rounded-2xl border border-dashed border-line px-6 py-10 text-center text-muted">Kurt je tento týden zavřený.</p>;
  }

  return (
    <>
      <p role="status" className="sr-only">{freeCount === 0 ? "Tento týden nejsou volné termíny." : `Tento týden je volných ${freeCount} hodin.`}</p>
      <div className="-mx-5 overflow-x-auto px-5 md:mx-0 md:px-0">
        <table className="w-full min-w-[640px] table-fixed border-separate border-spacing-1 text-sm">
          <caption className="sr-only">Volné a obsazené hodiny kurtu po dnech</caption>
          <thead>
            <tr>
              <th scope="col" className="w-14"><span className="sr-only">Čas</span></th>
              {days.map((day) => {
                const isToday = day.date === today;
                return (
                  <th key={day.date} scope="col" className="pb-2 text-center font-normal">
                    <span className={`block text-xs ${isToday ? "font-semibold text-foreground" : "text-muted"}`}>{isToday ? "Dnes" : shortDayNames[day.dayOfWeek]}</span>
                    <span className={`mt-0.5 inline-flex min-w-11 justify-center rounded-full px-2 py-0.5 font-semibold tabular-nums ${isToday ? "bg-foreground text-page" : "text-foreground"}`}>{dayLabel(day.date)}</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {hours.map((hour) => (
              <tr key={hour}>
                <th scope="row" className="pr-2 text-right align-top text-xs font-normal text-muted tabular-nums">{hourKey(hour)}</th>
                {days.map((day) => (
                  <SlotCell key={day.date} slot={day.slotList.find((item) => item.startTime === hourKey(hour))} price={priceAt(rules, day.dayOfWeek, hourKey(hour))} now={now} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul aria-label="Legenda" className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted">
        <li className="flex items-center gap-2"><span aria-hidden="true" className="size-3 rounded-[4px] bg-brand-50 shadow-[inset_2px_0_0_var(--color-brand-500)] dark:bg-ball/15 dark:shadow-[inset_2px_0_0_var(--color-ball)]" />Volné, s cenou za hodinu</li>
        <li className="flex items-center gap-2"><span aria-hidden="true" className="size-3 rounded-[4px] bg-[repeating-linear-gradient(135deg,var(--color-surface)_0_3px,transparent_3px_6px)] ring-1 ring-line" />Obsazené</li>
        <li className="flex items-center gap-2"><span aria-hidden="true" className="size-3 rounded-[4px] border border-dashed border-line" />Zavřeno nebo proběhlo</li>
      </ul>
    </>
  );
}

function SlotCell({ slot, price, now }: { slot?: CourtSlot; price?: number; now: number }) {
  if (!slot || (!slot.free && Date.parse(slot.startAt) <= now)) {
    return (
      <td className="h-10 rounded-lg border border-dashed border-line/60">
        <span className="sr-only">{slot ? `${slot.startTime}–${slot.endTime} proběhlo` : "Zavřeno"}</span>
      </td>
    );
  }
  if (!slot.free) {
    return (
      <td className="h-10 rounded-lg bg-[repeating-linear-gradient(135deg,var(--color-surface)_0_6px,transparent_6px_12px)] px-2 text-center text-xs text-muted">
        <span className="sr-only">{slot.startTime}–{slot.endTime} </span>Obsazeno
      </td>
    );
  }
  return (
    <td className="h-10 rounded-lg bg-brand-50 px-2 text-center text-brand-700 shadow-[inset_3px_0_0_var(--color-brand-500)] dark:bg-ball/10 dark:text-ball dark:shadow-[inset_3px_0_0_var(--color-ball)]">
      <span className="sr-only">{slot.startTime}–{slot.endTime} volné </span>
      <span className="text-xs font-semibold tabular-nums">{price !== undefined ? formatPrice(price) : "Volné"}</span>
    </td>
  );
}
