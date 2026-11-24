"use client";

import { useEffect, useState } from "react";
import { ArrowClockwise, CaretLeft, CaretRight } from "@phosphor-icons/react";
import { ApiError, type DayOfWeek } from "@/lib/api";
import { addDays, dayOfWeekOf, type CourtAvailability, type CourtSlot, getCourtAvailability, pragueToday } from "@/lib/courts";
import { formatPrice, listPriceRules, type PriceRule } from "@/lib/priceRules";
import type { Court } from "@/lib/venues";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "done"; availability: CourtAvailability };

const stripDays = 14;
const shortDayNames: Record<DayOfWeek, string> = { 1: "Po", 2: "Út", 3: "St", 4: "Čt", 5: "Pá", 6: "So", 7: "Ne" };
const longDayNames: Record<DayOfWeek, string> = { 1: "Pondělí", 2: "Úterý", 3: "Středa", 4: "Čtvrtek", 5: "Pátek", 6: "Sobota", 7: "Neděle" };
const monthNames = ["ledna", "února", "března", "dubna", "května", "června", "července", "srpna", "září", "října", "listopadu", "prosince"];
const partsOfDay = [
  { label: "Dopoledne", from: 0, to: 12 },
  { label: "Odpoledne", from: 12, to: 17 },
  { label: "Večer", from: 17, to: 24 },
];

function dateParts(date: string): { day: number; month: number } {
  const [, month, day] = date.split("-").map(Number);
  return { day, month };
}

function longDate(date: string): string {
  const { day, month } = dateParts(date);
  return `${longDayNames[dayOfWeekOf(date)]} ${day}. ${monthNames[month - 1]}`;
}

function priceAt(rules: PriceRule[], dayOfWeek: DayOfWeek, startTime: string): number | undefined {
  return rules.find((rule) => rule.dayOfWeek === dayOfWeek && rule.startTime <= startTime && startTime < rule.endTime)?.pricePerHour;
}

export function FreeSlots({ courts }: { courts: Court[] }) {
  const [today] = useState(pragueToday);
  const [courtId, setCourtId] = useState(courts[0].id);
  const [stripStart, setStripStart] = useState(today);
  const [date, setDate] = useState(today);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [rules, setRules] = useState<{ courtId: string; items: PriceRule[] } | null>(null);

  useEffect(() => {
    let active = true;
    setState({ status: "loading" });
    getCourtAvailability(courtId, date)
      .then((availability) => {
        if (active) setState({ status: "done", availability });
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
  }, [courtId, date, attempt]);

  useEffect(() => {
    let active = true;
    listPriceRules(courtId)
      .then((items) => {
        if (active) setRules({ courtId, items });
      })
      .catch(() => {
        if (active) setRules({ courtId, items: [] });
      });
    return () => {
      active = false;
    };
  }, [courtId]);

  function shiftStrip(days: number) {
    const next = addDays(stripStart, days);
    const start = next < today ? today : next;
    setStripStart(start);
    setDate(start);
  }

  const dates = Array.from({ length: stripDays }, (_, index) => addDays(stripStart, index));
  const priceRules = rules?.courtId === courtId ? rules.items : [];
  const navButton = "hidden size-11 shrink-0 items-center justify-center rounded-full border border-line transition-colors hover:border-foreground disabled:pointer-events-none disabled:opacity-35 sm:flex";

  return (
    <section aria-labelledby="free-slots-title" className="mt-16 md:mt-20">
      <h3 id="free-slots-title" className="font-display text-xl leading-snug font-semibold tracking-[-.02em] md:text-2xl">Volné termíny</h3>

      {courts.length > 1 && (
        <div role="group" aria-label="Kurt" className="-mx-5 mt-5 flex gap-2 overflow-x-auto px-5 pb-1 md:mx-0 md:flex-wrap md:px-0">
          {courts.map((court) => {
            const selected = court.id === courtId;
            return (
              <button key={court.id} type="button" aria-pressed={selected} onClick={() => setCourtId(court.id)} className={`inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium whitespace-nowrap transition-colors ${selected ? "border-foreground bg-foreground text-page" : "border-line hover:border-muted"}`}>
                {court.name}
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex items-center gap-2">
        <button type="button" onClick={() => shiftStrip(-7)} disabled={stripStart <= today} aria-label="Dřívější dny" className={navButton}>
          <CaretLeft size={16} aria-hidden="true" />
        </button>
        <div role="group" aria-label="Den" className="-mx-5 flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-5 pb-1 sm:mx-0 sm:px-0">
          {dates.map((day) => {
            const selected = day === date;
            const { day: dayNumber, month } = dateParts(day);
            return (
              <button
                key={day}
                type="button"
                aria-pressed={selected}
                aria-label={`${day === today ? "Dnes, " : ""}${longDate(day)}`}
                onClick={() => setDate(day)}
                className={`flex min-w-14 flex-1 shrink-0 flex-col items-center rounded-2xl border px-2 py-2 transition-colors ${selected ? "border-foreground bg-foreground text-page" : "border-line hover:border-muted"}`}
              >
                <span className={`text-xs ${selected ? "text-page/70" : "text-muted"}`}>{day === today ? "Dnes" : shortDayNames[dayOfWeekOf(day)]}</span>
                <span className="text-lg leading-tight font-semibold tabular-nums">{dayNumber}</span>
                <span className={`text-[11px] ${selected ? "text-page/70" : "text-muted"}`}>{month}.</span>
              </button>
            );
          })}
        </div>
        <button type="button" onClick={() => shiftStrip(7)} aria-label="Další dny" className={navButton}>
          <CaretRight size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="mt-8">
        {state.status === "loading" && (
          <>
            <p role="status" className="sr-only">Načítám termíny…</p>
            <div aria-hidden="true" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }, (_, index) => <div key={index} className="h-[4.25rem] animate-pulse rounded-xl bg-surface" />)}
            </div>
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
        {state.status === "done" && <DaySlots availability={state.availability} rules={priceRules} />}
      </div>
    </section>
  );
}

function slotState(slot: CourtSlot, now: number): "free" | "taken" | "past" {
  if (slot.free) return "free";
  return Date.parse(slot.startAt) <= now ? "past" : "taken";
}

function DaySlots({ availability, rules }: { availability: CourtAvailability; rules: PriceRule[] }) {
  const now = Date.now();
  if (availability.openTime === null) {
    return <p className="rounded-2xl border border-dashed border-line px-6 py-10 text-center text-muted">Tento den je kurt zavřený. Vyberte jiný den.</p>;
  }
  if (availability.slotList.length === 0) {
    return <p className="rounded-2xl border border-dashed border-line px-6 py-10 text-center text-muted">Pro tento den nejsou žádné celé hodiny.</p>;
  }
  const freeCount = availability.slotList.filter((slot) => slot.free).length;
  const groups = partsOfDay
    .map((part) => ({
      ...part,
      slots: availability.slotList.filter((slot) => {
        const hour = Number(slot.startTime.slice(0, 2));
        return hour >= part.from && hour < part.to;
      }),
    }))
    .filter((group) => group.slots.length > 0);

  return (
    <>
      <p role="status" className="text-sm text-muted">
        <span className="font-semibold text-foreground">{longDate(availability.date)}</span>
        {" · "}otevřeno {availability.openTime}–{availability.closeTime}
        {" · "}{freeCount === 0 ? "vše obsazeno" : `volných ${freeCount} z ${availability.slotList.length} hodin`}
      </p>
      <div className="mt-6 grid gap-8">
        {groups.map((group) => (
          <div key={group.label}>
            <h4 className="text-sm font-semibold text-muted">{group.label}</h4>
            <ul aria-label={`Termíny: ${group.label}`} className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {group.slots.map((slot) => {
                const current = slotState(slot, now);
                const price = priceAt(rules, availability.dayOfWeek, slot.startTime);
                return (
                  <li
                    key={slot.startAt}
                    className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${current === "free" ? "border-brand-500 bg-ball text-brand-900" : current === "taken" ? "border-line bg-surface text-muted" : "border-dashed border-line text-muted/70"}`}
                  >
                    <span>
                      <span className="block font-semibold tabular-nums">{slot.startTime}–{slot.endTime}</span>
                      <span className="block text-xs">{current === "free" ? "Volné" : current === "taken" ? "Obsazeno" : "Proběhlo"}</span>
                    </span>
                    {current === "free" && price !== undefined && <span className="font-semibold tabular-nums">{formatPrice(price)}</span>}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </>
  );
}
