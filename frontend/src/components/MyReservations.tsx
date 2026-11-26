"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowClockwise, ArrowRight, CalendarBlank, CheckCircle, CircleNotch, Clock, WarningCircle } from "@phosphor-icons/react";
import { ApiError } from "@/lib/api";
import { formatPrice } from "@/lib/priceRules";
import {
  canCancel,
  formatReservationDate,
  formatTimeRange,
  listMyReservations,
  reservationStatus,
  type Reservation,
  type ReservationPeriod,
} from "@/lib/reservations";
import { CancelReservationButton } from "@/components/CancelReservationButton";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "done"; period: ReservationPeriod; reservations: Reservation[]; total: number; pageIndex: number; loadingMore: boolean; moreError: string | null };

const tabs: { period: ReservationPeriod; label: string }[] = [
  { period: "upcoming", label: "Nadcházející" },
  { period: "past", label: "Proběhlé" },
];

const fallbackError = "Server teď neodpovídá. Pokud byl delší dobu nečinný, probouzí se. Zkuste to za chvíli znovu.";

function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : fallbackError;
}

export function MyReservations() {
  const [period, setPeriod] = useState<ReservationPeriod>("upcoming");
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [cancelledIds, setCancelledIds] = useState<string[]>([]);
  const [focusCancelledId, setFocusCancelledId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setState({ status: "loading" });
    listMyReservations({ period, pageIndex: 0 })
      .then((page) => {
        if (active) setState({ status: "done", period, reservations: page.itemList, total: page.pageInfo.total, pageIndex: 0, loadingMore: false, moreError: null });
      })
      .catch((error: unknown) => {
        if (active) setState({ status: "error", message: errorMessage(error) });
      });
    return () => {
      active = false;
    };
  }, [period, attempt]);

  // The cancel button disappears with its dialog, so focus moves to the confirmation instead of the page start.
  useEffect(() => {
    if (focusCancelledId) document.getElementById(`reservation-cancelled-${focusCancelledId}`)?.focus();
  }, [focusCancelledId]);

  async function loadMore() {
    if (state.status !== "done" || state.loadingMore) return;
    const requestPeriod = state.period;
    const nextIndex = state.pageIndex + 1;
    setState({ ...state, loadingMore: true, moreError: null });
    // A tab switch while this request runs must not mix the old tab's page into the new list.
    const isSameList = (current: LoadState): current is Extract<LoadState, { status: "done" }> =>
      current.status === "done" && current.period === requestPeriod;
    try {
      const page = await listMyReservations({ period: requestPeriod, pageIndex: nextIndex });
      setState((current) => isSameList(current)
        ? { ...current, reservations: [...current.reservations, ...page.itemList], total: page.pageInfo.total, pageIndex: nextIndex, loadingMore: false, moreError: null }
        : current);
    } catch (error) {
      setState((current) => isSameList(current) ? { ...current, loadingMore: false, moreError: errorMessage(error) } : current);
    }
  }

  function patchReservation(id: string, patch: Pick<Reservation, "status" | "cancelledAt">) {
    setState((current) => current.status === "done"
      ? { ...current, reservations: current.reservations.map((reservation) => (reservation.id === id ? { ...reservation, ...patch } : reservation)) }
      : current);
    setCancelledIds((ids) => [...ids, id]);
    setFocusCancelledId(id);
  }

  const now = new Date();

  return (
    <main id="main-content" className="section-wrap pt-8 pb-20 md:pt-12">
      <h1 className="font-display text-[clamp(2rem,4.5vw,3.25rem)] leading-[1.08] font-semibold tracking-[-.045em]">Moje rezervace</h1>
      <p className="mt-3 text-muted">Nadcházející i odehrané rezervace na jednom místě.</p>

      <div className="mt-8 flex gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.period}
            type="button"
            aria-pressed={period === tab.period}
            onClick={() => setPeriod(tab.period)}
            className={`min-h-11 rounded-full px-5 text-sm font-semibold transition-colors ${period === tab.period ? "bg-foreground text-page" : "border border-line text-muted hover:bg-surface hover:text-foreground"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {state.status === "loading" && (
        <>
          <p role="status" className="sr-only">Načítání rezervací…</p>
          <ul aria-hidden="true" className="mt-8 grid gap-4">
            {[0, 1, 2].map((key) => (
              <li key={key} className="grid gap-3 rounded-2xl border border-line p-5">
                <div className="h-4 w-1/4 animate-pulse rounded bg-surface" />
                <div className="h-6 w-1/2 animate-pulse rounded bg-surface" />
                <div className="h-4 w-1/3 animate-pulse rounded bg-surface" />
              </li>
            ))}
          </ul>
        </>
      )}

      {state.status === "error" && (
        <div role="alert" className="mt-8 flex flex-col items-start gap-4 rounded-2xl border border-line bg-surface/60 p-6 sm:flex-row sm:items-center">
          <WarningCircle size={28} aria-hidden="true" className="shrink-0 text-red-700 dark:text-red-400" />
          <div className="flex-1">
            <p className="font-semibold">Rezervace se nepodařilo načíst</p>
            <p className="mt-1 text-sm text-muted">{state.message}</p>
          </div>
          <button type="button" onClick={() => setAttempt(attempt + 1)} className="button button-outline gap-2">
            Zkusit znovu <ArrowClockwise size={18} aria-hidden="true" />
          </button>
        </div>
      )}

      {state.status === "done" && state.reservations.length === 0 && (
        <div className="mt-8 flex flex-col items-center rounded-2xl border border-dashed border-line px-6 py-16 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-surface text-muted">
            <CalendarBlank size={26} aria-hidden="true" />
          </span>
          <h2 className="mt-5 font-display text-2xl font-semibold">
            {period === "upcoming" ? "Zatím nemáte žádné nadcházející rezervace" : "Zatím nemáte žádné proběhlé rezervace"}
          </h2>
          <p className="mt-2 max-w-md text-muted">Najděte sportoviště a rezervujte si první kurt.</p>
          <Link href="/venues" className="button button-dark mt-6 gap-2">
            Najít sportoviště <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>
      )}

      {state.status === "done" && state.reservations.length > 0 && (
        <>
          <ul className="mt-8 grid gap-4">
            {state.reservations.map((reservation) => {
              const status = reservationStatus(reservation, now);
              const venueLabel = reservation.venueName ?? "Sportoviště";
              const courtLabel = reservation.courtName ?? "Kurt byl odstraněn";
              const dateLabel = formatReservationDate(reservation.startAt);
              const timeLabel = formatTimeRange(reservation.startAt, reservation.endAt);
              const upcoming = reservation.status === "ACTIVE" && now.getTime() < new Date(reservation.startAt).getTime();
              return (
                <li key={reservation.id}>
                  <article className={`rounded-2xl border border-line p-5 ${reservation.status === "CANCELLED" ? "bg-surface/40" : "bg-page"}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="font-display text-xl leading-snug font-semibold tracking-[-.02em]">
                          <Link href={`/venues/${reservation.venueId}`} className="hover:underline">{venueLabel}</Link>
                        </h2>
                        <p className="mt-1 text-sm text-muted">{courtLabel}</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${status.className}`}>{status.label}</span>
                    </div>
                    <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                      <span className="flex items-center gap-1.5"><CalendarBlank size={16} aria-hidden="true" />{dateLabel}</span>
                      <span className="flex items-center gap-1.5"><Clock size={16} aria-hidden="true" />{timeLabel}</span>
                      <span className="font-semibold">{formatPrice(reservation.totalPrice)}</span>
                    </p>
                    {cancelledIds.includes(reservation.id) && (
                      <p id={`reservation-cancelled-${reservation.id}`} tabIndex={-1} role="status" className="mt-3 flex items-center gap-2 text-sm text-brand-900 outline-none dark:text-ball">
                        <CheckCircle size={16} aria-hidden="true" />Rezervace byla zrušena.
                      </p>
                    )}
                    {canCancel(reservation, now) && (
                      <div className="mt-3 -ml-3 border-t border-line pt-2 pl-3">
                        <CancelReservationButton
                          reservation={reservation}
                          venueLabel={venueLabel}
                          courtLabel={courtLabel}
                          dateLabel={dateLabel}
                          timeLabel={timeLabel}
                          onCancelled={(patch) => patchReservation(reservation.id, patch)}
                        />
                      </div>
                    )}
                    {upcoming && !canCancel(reservation, now) && (
                      <p className="mt-3 border-t border-line pt-3 text-sm text-muted">Zrušit lze nejpozději 24 h před začátkem.</p>
                    )}
                  </article>
                </li>
              );
            })}
          </ul>
          {state.moreError && (
            <p role="alert" className="mt-4 flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
              <WarningCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />{state.moreError}
            </p>
          )}
          {state.reservations.length < state.total && (
            <div className="mt-6 flex justify-center">
              <button type="button" disabled={state.loadingMore} onClick={() => void loadMore()} className="button button-outline gap-2">
                {state.loadingMore && <CircleNotch size={17} className="animate-spin" aria-hidden="true" />}
                Načíst další
              </button>
            </div>
          )}
        </>
      )}
    </main>
  );
}
