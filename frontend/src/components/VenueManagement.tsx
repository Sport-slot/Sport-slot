"use client";

import { useRef, useState } from "react";
import { CircleNotch, EyeSlash, Power, WarningCircle } from "@phosphor-icons/react";
import { ApiError } from "@/lib/api";
import { setVenueActive, type VenueDetail } from "@/lib/venues";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Prague" }).format(new Date(value));
}

export function DeactivatedNotice({ venue }: { venue: VenueDetail }) {
  if (venue.active) return null;
  return (
    <div role="status" className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
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
  );
}

export function VenueManagement({
  venue,
  onChange,
}: {
  venue: VenueDetail;
  onChange: (patch: Pick<VenueDetail, "active" | "deactivatedAt">) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <section className="mt-5 border-t border-line pt-5" aria-labelledby="venue-management-title">
      <h2 id="venue-management-title" className="font-semibold">Správa sportoviště</h2>
      <p className="mt-1 text-sm text-muted">Tuto část vidíte jen vy jako vlastník.</p>
      <div className="mt-4 grid gap-2">
        {venue.active ? (
          <button ref={triggerRef} type="button" onClick={openDialog} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40">
            <Power size={17} aria-hidden="true" /> Deaktivovat sportoviště
          </button>
        ) : (
          <button type="button" disabled={pending} onClick={() => void apply(true)} className="button button-primary w-full gap-2 disabled:cursor-wait disabled:opacity-70">
            {pending ? <CircleNotch size={17} className="animate-spin" aria-hidden="true" /> : <Power size={17} aria-hidden="true" />}
            {pending ? "Aktivujeme…" : "Znovu aktivovat"}
          </button>
        )}
      </div>
      {error && !venue.active && (
        <p role="alert" className="mt-3 flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
          <WarningCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />{error}
        </p>
      )}

      <dialog
        ref={dialogRef}
        aria-labelledby="deactivate-title"
        aria-describedby="deactivate-description"
        onClose={() => triggerRef.current?.focus()}
        onClick={(event) => {
          if (event.target === event.currentTarget && !pending) dialogRef.current?.close();
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-line bg-page p-0 text-foreground shadow-[0_40px_120px_-40px_rgba(10,30,20,.7)] backdrop:bg-brand-900/55 backdrop:backdrop-blur-sm"
      >
        <div className="p-6 sm:p-7">
          <h2 id="deactivate-title" className="font-display text-xl font-semibold">Deaktivovat sportoviště?</h2>
          <div id="deactivate-description" className="mt-3 grid gap-2 text-sm leading-relaxed text-muted">
            <p><span className="font-medium text-foreground">{venue.name}</span> zmizí z vyhledávání a nepůjde si ho nově rezervovat.</p>
            <p>Kurty, hodnocení i existující rezervace zůstanou. Sportoviště můžete kdykoli znovu aktivovat.</p>
          </div>
          {error && (
            <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-300">
              <WarningCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />{error}
            </p>
          )}
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" disabled={pending} onClick={() => dialogRef.current?.close()} className="button button-outline">
              Zrušit
            </button>
            <button type="button" disabled={pending} onClick={() => void apply(false)} className="button gap-2 bg-red-700 text-white hover:bg-red-800 disabled:cursor-wait disabled:opacity-70">
              {pending && <CircleNotch size={17} className="animate-spin" aria-hidden="true" />}
              {pending ? "Deaktivujeme…" : "Deaktivovat"}
            </button>
          </div>
        </div>
      </dialog>
    </section>
  );
}
