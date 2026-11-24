"use client";

import { useRef, useState } from "react";
import { CircleNotch, EyeSlash, Power, WarningCircle } from "@phosphor-icons/react";
import { ApiError } from "@/lib/api";
import { setVenueActive, type VenueDetail } from "@/lib/venues";

type ActivationVenue = { id: string; name: string; active: boolean };
type ActivationPatch = { active: boolean; deactivatedAt: string | null };

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Prague" }).format(new Date(value));
}

const variants = {
  glass: {
    deactivate: "inline-flex min-h-11 items-center gap-2 rounded-full border border-white/20 bg-brand-900/35 px-4 text-sm font-medium text-white backdrop-blur-md transition-colors hover:border-red-300/60 hover:bg-red-950/60 focus-visible:outline-white",
    activate: "inline-flex min-h-11 items-center gap-2 rounded-full bg-ball px-4 text-sm font-semibold text-brand-900 transition-transform hover:-translate-y-px active:translate-y-0 disabled:cursor-wait disabled:opacity-70",
  },
  quiet: {
    deactivate: "inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-muted transition-colors hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40 dark:hover:text-red-300",
    activate: "inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line px-3.5 text-sm font-semibold text-foreground transition-colors hover:border-foreground disabled:cursor-wait disabled:opacity-70",
  },
} as const;

export function VenueActivationButton({
  venue,
  onChange,
  variant = "quiet",
}: {
  venue: ActivationVenue;
  onChange: (patch: ActivationPatch) => void;
  variant?: keyof typeof variants;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const styles = variants[variant];

  async function apply(active: boolean) {
    setPending(true);
    setError(null);
    try {
      const result = await setVenueActive(venue.id, active);
      onChange({ active: result.active, deactivatedAt: result.deactivatedAt });
      dialogRef.current?.close();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Změnu se nepodařilo uložit. Zkontrolujte připojení a zkuste to znovu.");
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
      {venue.active ? (
        <button ref={triggerRef} type="button" onClick={openDialog} aria-label={`Deaktivovat sportoviště ${venue.name}`} className={styles.deactivate}>
          <Power size={16} aria-hidden="true" /> Deaktivovat
        </button>
      ) : (
        <span className="relative inline-flex">
          <button type="button" disabled={pending} onClick={() => void apply(true)} aria-label={pending ? undefined : `Znovu aktivovat sportoviště ${venue.name}`} className={styles.activate}>
            {pending ? <CircleNotch size={16} className="animate-spin" aria-hidden="true" /> : <Power size={16} aria-hidden="true" />}
            {pending ? "Aktivujeme…" : "Znovu aktivovat"}
          </button>
          {error && (
            <span role="alert" className="absolute top-full right-0 z-10 mt-2 flex w-64 items-start gap-2 rounded-xl border border-line bg-page p-3 text-left text-sm text-red-700 shadow-sm dark:text-red-300">
              <WarningCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />{error}
            </span>
          )}
        </span>
      )}

      <dialog
        ref={dialogRef}
        aria-labelledby={`deactivate-title-${venue.id}`}
        aria-describedby={`deactivate-description-${venue.id}`}
        onClose={() => triggerRef.current?.focus()}
        onClick={(event) => {
          if (event.target === event.currentTarget && !pending) dialogRef.current?.close();
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-line bg-page p-0 text-left text-foreground shadow-[0_40px_120px_-40px_rgba(10,30,20,.7)] backdrop:bg-brand-900/55 backdrop:backdrop-blur-sm"
      >
        <div className="p-6 sm:p-7">
          <span className="flex size-11 items-center justify-center rounded-xl bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300">
            <EyeSlash size={22} aria-hidden="true" />
          </span>
          <h2 id={`deactivate-title-${venue.id}`} className="mt-4 font-display text-xl font-semibold">Deaktivovat {venue.name}?</h2>
          <ul id={`deactivate-description-${venue.id}`} className="mt-3 grid gap-2 text-sm leading-relaxed text-muted">
            <li>Zmizí z vyhledávání a nepůjde si ho nově rezervovat.</li>
            <li>Kurty, ceníky, hodnocení i existující rezervace zůstanou beze změny.</li>
            <li>Kdykoli ho jedním kliknutím znovu aktivujete.</li>
          </ul>
          {error && (
            <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-300">
              <WarningCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />{error}
            </p>
          )}
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" disabled={pending} onClick={() => dialogRef.current?.close()} className="button button-outline">
              Ponechat aktivní
            </button>
            <button type="button" disabled={pending} onClick={() => void apply(false)} className="button gap-2 bg-red-700 text-white hover:bg-red-800 disabled:cursor-wait disabled:opacity-70">
              {pending && <CircleNotch size={17} className="animate-spin" aria-hidden="true" />}
              {pending ? "Deaktivujeme…" : "Deaktivovat"}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}

export function DeactivatedNotice({ venue, onChange }: { venue: VenueDetail; onChange: (patch: ActivationPatch) => void }) {
  if (venue.active) return null;
  return (
    <div role="status" className="mt-6 flex flex-col gap-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 sm:flex-row sm:items-center dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
      <div className="flex flex-1 items-start gap-3">
        <EyeSlash size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
        <div>
          <p className="font-semibold">
            {venue.isOwner ? "Sportoviště je deaktivované" : "Sportoviště je dočasně mimo provoz"}
          </p>
          <p className="mt-1 leading-relaxed">
            {venue.isOwner
              ? `Od ${venue.deactivatedAt ? formatDate(venue.deactivatedAt) : "nedávna"} ho hráči nevidí ve vyhledávání a nemohou si ho rezervovat. Kurty, hodnocení i existující rezervace zůstaly beze změny.`
              : "Rezervace teď nejsou možné. Zkuste to později nebo si vyberte jiné sportoviště."}
          </p>
        </div>
      </div>
      {venue.isOwner && <VenueActivationButton venue={venue} onChange={onChange} />}
    </div>
  );
}
