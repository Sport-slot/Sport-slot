"use client";

import { useEffect, useState } from "react";
import { ArrowClockwise, CaretLeft, CaretRight, CheckCircle, CircleNotch, WarningCircle } from "@phosphor-icons/react";
import { ApiError, type DayOfWeek } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { addDays, dayOfWeekOf, getCourtAvailability, pragueToday, selectSlot, type CourtAvailability, type CourtSlot, type SlotRange } from "@/lib/courts";
import { formatPrice, listPriceRules, type PriceRule } from "@/lib/priceRules";
import { createReservation, formatReservationDate, formatTimeRange, type CreatedReservation } from "@/lib/reservations";
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
const loginReason = "Rezervaci potvrdíte po přihlášení. Po přihlášení budete pokračovat tady.";

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
  const [range, setRange] = useState<SlotRange | null>(null);

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

  function pickCourt(id: string) {
    setCourtId(id);
    setRange(null);
  }

  function pickDate(day: string) {
    setDate(day);
    setRange(null);
  }

  function reload() {
    setRange(null);
    setAttempt((count) => count + 1);
  }

  function shiftStrip(days: number) {
    const next = addDays(stripStart, days);
    const start = next < today ? today : next;
    setStripStart(start);
    pickDate(start);
  }

  const dates = Array.from({ length: stripDays }, (_, index) => addDays(stripStart, index));
  const priceRules = rules?.courtId === courtId ? rules.items : [];
  const court = courts.find((item) => item.id === courtId) ?? courts[0];
  const availability = state.status === "done" ? state.availability : null;
  const navButton = "hidden size-11 shrink-0 items-center justify-center rounded-full border border-line transition-colors hover:border-foreground disabled:pointer-events-none disabled:opacity-35 sm:flex";

  return (
    <section aria-labelledby="free-slots-title" className="mt-16 md:mt-20">
      <h3 id="free-slots-title" className="font-display text-xl leading-snug font-semibold tracking-[-.02em] md:text-2xl">Volné termíny</h3>

      {courts.length > 1 && (
        <div role="group" aria-label="Kurt" className="-mx-5 mt-5 flex gap-2 overflow-x-auto px-5 pb-1 md:mx-0 md:flex-wrap md:px-0">
          {courts.map((item) => {
            const selected = item.id === courtId;
            return (
              <button key={item.id} type="button" aria-pressed={selected} onClick={() => pickCourt(item.id)} className={`inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium whitespace-nowrap transition-colors ${selected ? "border-foreground bg-foreground text-page" : "border-line hover:border-muted"}`}>
                {item.name}
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
                onClick={() => pickDate(day)}
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
            <button type="button" onClick={reload} className="button button-outline min-h-11 gap-2 px-4 py-2">
              Zkusit znovu <ArrowClockwise size={16} aria-hidden="true" />
            </button>
          </div>
        )}
        {state.status === "done" && (
          <DaySlots
            availability={state.availability}
            rules={priceRules}
            range={range}
            onSelect={(index) => setRange(selectSlot(state.availability.slotList, range, index))}
          />
        )}
      </div>

      <ReservationSummary
        key={`${courtId}-${date}`}
        court={court}
        availability={availability}
        rules={priceRules}
        range={range}
        onClear={() => setRange(null)}
        onBooked={reload}
      />
    </section>
  );
}

function slotState(slot: CourtSlot, now: number): "free" | "taken" | "past" {
  if (slot.free) return "free";
  return Date.parse(slot.startAt) <= now ? "past" : "taken";
}

function DaySlots({
  availability,
  rules,
  range,
  onSelect,
}: {
  availability: CourtAvailability;
  rules: PriceRule[];
  range: SlotRange | null;
  onSelect: (index: number) => void;
}) {
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
                const index = availability.slotList.indexOf(slot);
                const current = slotState(slot, now);
                const price = priceAt(rules, availability.dayOfWeek, slot.startTime);
                const selected = range !== null && index >= range.from && index <= range.to;
                const tone = selected
                  ? "border-foreground bg-foreground text-page"
                  : current === "free"
                    ? "border-brand-500 bg-ball text-brand-900"
                    : current === "taken"
                      ? "border-line bg-surface text-muted"
                      : "border-dashed border-line text-muted/70";
                const content = (
                  <>
                    <span>
                      <span className="block font-semibold tabular-nums">{slot.startTime}–{slot.endTime}</span>
                      <span className="block text-xs">{current === "free" ? "Volné" : current === "taken" ? "Obsazeno" : "Proběhlo"}</span>
                    </span>
                    {current === "free" && price !== undefined && <span className="font-semibold tabular-nums">{formatPrice(price)}</span>}
                  </>
                );
                return (
                  <li key={slot.startAt}>
                    {current === "free" ? (
                      <button type="button" aria-pressed={selected} onClick={() => onSelect(index)} className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors ${tone}`}>
                        {content}
                      </button>
                    ) : (
                      <div className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${tone}`}>{content}</div>
                    )}
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

function ReservationSummary({
  court,
  availability,
  rules,
  range,
  onClear,
  onBooked,
}: {
  court: Court;
  availability: CourtAvailability | null;
  rules: PriceRule[];
  range: SlotRange | null;
  onClear: () => void;
  onBooked: () => void;
}) {
  const { user, loading, openLogin } = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booked, setBooked] = useState<CreatedReservation | null>(null);

  const slots = availability && range ? availability.slotList.slice(range.from, range.to + 1) : [];
  const dayOfWeek = availability?.dayOfWeek;
  const prices = dayOfWeek === undefined ? [] : slots.map((slot) => priceAt(rules, dayOfWeek, slot.startTime));
  const total = prices.every((price): price is number => price !== undefined) ? prices.reduce((sum, price) => sum + price, 0) : undefined;

  async function book() {
    if (!user) {
      openLogin(loginReason);
      return;
    }
    setPending(true);
    setError(null);
    try {
      const result = await createReservation({ courtId: court.id, startAt: slots[0].startAt, endAt: slots[slots.length - 1].endAt });
      setBooked(result);
      onBooked();
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        openLogin(loginReason);
      } else if (caught instanceof ApiError && caught.code.endsWith("slotNotAvailable")) {
        setError("Tenhle termín už není volný. Výběr jsme zrušili a termíny aktualizujeme.");
        onBooked();
      } else if (caught instanceof ApiError && caught.status === 404) {
        setError("Kurt už není k dispozici. Termíny aktualizujeme.");
        onBooked();
      } else if (caught instanceof ApiError && caught.status < 500) {
        setError(caught.message);
      } else {
        setError("Rezervaci se nepodařilo vytvořit. Zkuste to znovu.");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-6 grid gap-4">
      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-300">
          <WarningCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />{error}
        </p>
      )}

      {booked && (
        <div role="status" className="flex gap-3 rounded-2xl border border-brand-500 bg-ball p-5 text-brand-900 sm:p-6">
          <CheckCircle size={22} className="mt-0.5 shrink-0" aria-hidden="true" />
          <div className="grid gap-1 text-sm leading-relaxed">
            <p className="font-semibold">Rezervace je vytvořená.</p>
            <p>{court.name} · {formatReservationDate(booked.startAt)}, {formatTimeRange(booked.startAt, booked.endAt)}</p>
            <p>Celková cena: {formatPrice(booked.totalPrice)}</p>
            <p className="break-all text-xs">Číslo rezervace: {booked.id}</p>
          </div>
        </div>
      )}

      {availability && slots.length > 0 && (
        <div className="rounded-2xl border border-line p-5 sm:p-6">
          <p className="text-sm text-muted">{court.name} · {longDate(availability.date)}</p>
          <p className="mt-1 font-semibold tabular-nums">
            {slots[0].startTime}–{slots[slots.length - 1].endTime} <span className="text-sm font-normal text-muted">({slots.length} h)</span>
          </p>
          <p className="mt-2 text-sm text-muted">
            {total !== undefined ? `Orientační cena: ${formatPrice(total)}` : "Pro některou hodinu chybí cena v ceníku. Rezervaci nelze potvrdit."}
          </p>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" disabled={pending} onClick={onClear} className="button button-outline">
              Zrušit výběr
            </button>
            <button type="button" disabled={pending || loading || total === undefined} onClick={() => void book()} className="button button-primary gap-2 disabled:cursor-wait disabled:opacity-70">
              {pending && <CircleNotch size={17} className="animate-spin" aria-hidden="true" />}
              {pending ? "Rezervujeme…" : "Potvrdit rezervaci"}
            </button>
          </div>
        </div>
      )}

      {availability && slots.length === 0 && !booked && (
        <p className="text-sm text-muted">Vyberte volné hodiny za sebou. Kliknutím na sousední volnou hodinu výběr prodloužíte.</p>
      )}
    </div>
  );
}
