"use client";

import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { type CourtAvailability, type CourtSlot, getCourtAvailability, pragueToday } from "@/lib/courts";
import type { Court } from "@/lib/venues";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "done"; availability: CourtAvailability };

const fieldClass = "min-h-11 rounded-xl border border-line bg-page px-3 text-base";

export function FreeSlots({ courts }: { courts: Court[] }) {
  const [today] = useState(pragueToday);
  const [courtId, setCourtId] = useState(courts[0].id);
  const [date, setDate] = useState(today);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    if (!date) return;
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

  return (
    <div className="mt-16 md:mt-20">
      <h3 className="font-display text-xl leading-snug font-semibold tracking-[-.02em]">Volné termíny</h3>
      <div className="mt-5 flex flex-wrap gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Kurt
          <select value={courtId} onChange={(event) => setCourtId(event.target.value)} className={fieldClass}>
            {courts.map((court) => (
              <option key={court.id} value={court.id}>{court.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Den
          <input type="date" min={today} value={date} onChange={(event) => setDate(event.target.value)} className={fieldClass} />
        </label>
      </div>

      <div className="mt-6">
        {!date && <p className="text-muted">Vyberte den.</p>}
        {date && state.status === "loading" && <p role="status" className="text-muted">Načítám termíny…</p>}
        {date && state.status === "error" && (
          <div role="alert" className="flex flex-wrap items-center gap-4 rounded-xl border border-line p-4 text-sm">
            <p className="flex-1">{state.message}</p>
            <button type="button" onClick={() => setAttempt((count) => count + 1)} className="button button-outline min-h-11 px-4 py-2">Zkusit znovu</button>
          </div>
        )}
        {date && state.status === "done" && <Slots availability={state.availability} />}
      </div>
    </div>
  );
}

function slotLabel(slot: CourtSlot, now: number): string {
  if (slot.free) return "Volné";
  return Date.parse(slot.startAt) <= now ? "Proběhlo" : "Obsazeno";
}

function Slots({ availability }: { availability: CourtAvailability }) {
  const now = Date.now();
  if (availability.openTime === null) {
    return <p className="text-muted">Tento den je kurt zavřený.</p>;
  }
  if (availability.slotList.length === 0) {
    return <p className="text-muted">Pro tento den nejsou žádné celé hodiny.</p>;
  }
  return (
    <ul aria-label="Termíny" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {availability.slotList.map((slot) => (
        <li
          key={slot.startAt}
          className={`rounded-xl border px-4 py-3 text-sm ${slot.free ? "border-brand-500 bg-ball text-brand-900" : "border-line bg-surface text-muted"}`}
        >
          <span className="block font-semibold tabular-nums">{slot.startTime}–{slot.endTime}</span>
          <span className="block text-xs">{slotLabel(slot, now)}</span>
        </li>
      ))}
    </ul>
  );
}
