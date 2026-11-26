"use client";

import { useRef, useState } from "react";
import { CircleNotch, WarningCircle, XCircle } from "@phosphor-icons/react";
import { ApiError } from "@/lib/api";
import { formatPrice } from "@/lib/priceRules";
import { cancelReservation, type CancelledReservation, type Reservation } from "@/lib/reservations";

export function CancelReservationButton({
  reservation,
  venueLabel,
  courtLabel,
  dateLabel,
  timeLabel,
  onCancelled,
}: {
  reservation: Reservation;
  venueLabel: string;
  courtLabel: string;
  dateLabel: string;
  timeLabel: string;
  onCancelled: (patch: Pick<CancelledReservation, "status" | "cancelledAt">) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    setPending(true);
    setError(null);
    try {
      const result = await cancelReservation(reservation.id);
      onCancelled({ status: result.status, cancelledAt: result.cancelledAt });
      dialogRef.current?.close();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Rezervaci se nepodařilo zrušit. Zkontrolujte připojení a zkuste to znovu.");
    } finally {
      setPending(false);
    }
  }

  function openDialog() {
    setError(null);
    dialogRef.current?.showModal();
  }

  return (
    <>
      <button ref={triggerRef} type="button" onClick={openDialog} aria-label={`Zrušit rezervaci: ${venueLabel}, ${courtLabel}, ${dateLabel}, ${timeLabel}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40">
        <XCircle size={16} aria-hidden="true" /> Zrušit rezervaci
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={`cancel-title-${reservation.id}`}
        aria-describedby={`cancel-description-${reservation.id}`}
        onClose={() => triggerRef.current?.focus()}
        onClick={(event) => {
          if (event.target === event.currentTarget && !pending) dialogRef.current?.close();
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-line bg-page p-0 text-left text-foreground shadow-[0_40px_120px_-40px_rgba(10,30,20,.7)] backdrop:bg-brand-900/55 backdrop:backdrop-blur-sm"
      >
        <div className="p-6 sm:p-7">
          <span className="flex size-11 items-center justify-center rounded-xl bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300">
            <XCircle size={22} aria-hidden="true" />
          </span>
          <h2 id={`cancel-title-${reservation.id}`} className="mt-4 font-display text-xl font-semibold">Zrušit rezervaci?</h2>
          <ul id={`cancel-description-${reservation.id}`} className="mt-3 grid gap-1 text-sm leading-relaxed text-muted">
            <li className="font-semibold text-foreground">{venueLabel} · {courtLabel}</li>
            <li>{dateLabel}, {timeLabel}</li>
            <li>{formatPrice(reservation.totalPrice)}</li>
          </ul>
          {error && (
            <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-300">
              <WarningCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />{error}
            </p>
          )}
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" disabled={pending} onClick={() => dialogRef.current?.close()} className="button button-outline">
              Ponechat
            </button>
            <button type="button" disabled={pending} onClick={() => void cancel()} className="button gap-2 bg-red-700 text-white hover:bg-red-800 disabled:cursor-wait disabled:opacity-70">
              {pending && <CircleNotch size={17} className="animate-spin" aria-hidden="true" />}
              {pending ? "Rušíme…" : "Zrušit rezervaci"}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
