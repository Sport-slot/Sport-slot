"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowClockwise, ArrowRight, Buildings, MapPin, Plus, WarningCircle } from "@phosphor-icons/react";
import { ApiError } from "@/lib/api";
import { isOptimizableImage, venueImageSrc } from "@/lib/venueImages";
import { capitalize, imageForSports } from "@/lib/venueVisuals";
import { listMyVenues, type MyVenue } from "@/lib/venues";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "done"; venues: MyVenue[] };

function courtsLabel(count: number): string {
  if (count === 1) return "1 kurt";
  if (count >= 2 && count <= 4) return `${count} kurty`;
  return `${count} kurtů`;
}

function statusOf(venue: MyVenue): { label: string; hint: string; className: string } {
  if (!venue.active) {
    return { label: "Deaktivované", hint: "Hráči ho nevidí. Na detailu ho můžete znovu aktivovat.", className: "bg-surface text-muted" };
  }
  if (venue.courtCount === 0) {
    return { label: "Bez kurtů", hint: "Ve vyhledávání se ukáže po přidání prvního kurtu.", className: "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-100" };
  }
  return { label: "Aktivní", hint: "Hráči ho najdou ve vyhledávání.", className: "bg-ball text-brand-900" };
}

export function MyVenues() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setState({ status: "loading" });
    listMyVenues()
      .then((venues) => {
        if (active) setState({ status: "done", venues });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setState({
          status: "error",
          message: error instanceof ApiError ? error.message : "Server teď neodpovídá. Pokud byl delší dobu nečinný, probouzí se. Zkuste to za chvíli znovu.",
        });
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  return (
    <main id="main-content" className="section-wrap pt-8 pb-20 md:pt-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[clamp(2rem,4.5vw,3.25rem)] leading-[1.08] font-semibold tracking-[-.045em]">Moje sportoviště</h1>
          <p className="mt-3 text-muted">
            {state.status === "done" && state.venues.length > 0
              ? `Spravujete ${state.venues.length} ${state.venues.length === 1 ? "sportoviště" : "sportovišť"}.`
              : "Všechna sportoviště, která jste založili, na jednom místě."}
          </p>
        </div>
        <Link href="/venues/new" className="button button-primary gap-2">
          <Plus size={18} aria-hidden="true" /> Založit sportoviště
        </Link>
      </div>

      {state.status === "loading" && (
        <>
          <p role="status" className="sr-only">Načítání sportovišť…</p>
          <ul aria-hidden="true" className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((key) => (
              <li key={key} className="overflow-hidden rounded-2xl border border-line">
                <div className="aspect-[16/9] animate-pulse bg-surface" />
                <div className="grid gap-3 p-5">
                  <div className="h-4 w-1/3 animate-pulse rounded bg-surface" />
                  <div className="h-6 w-2/3 animate-pulse rounded bg-surface" />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {state.status === "error" && (
        <div role="alert" className="mt-10 flex flex-col items-start gap-4 rounded-2xl border border-line bg-surface/60 p-6 sm:flex-row sm:items-center">
          <WarningCircle size={28} aria-hidden="true" className="shrink-0 text-red-700 dark:text-red-400" />
          <div className="flex-1">
            <p className="font-semibold">Sportoviště se nepodařilo načíst</p>
            <p className="mt-1 text-sm text-muted">{state.message}</p>
          </div>
          <button type="button" onClick={() => setAttempt(attempt + 1)} className="button button-outline gap-2">
            Zkusit znovu <ArrowClockwise size={18} aria-hidden="true" />
          </button>
        </div>
      )}

      {state.status === "done" && state.venues.length === 0 && (
        <div className="mt-10 flex flex-col items-center rounded-2xl border border-dashed border-line px-6 py-16 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-surface text-muted">
            <Buildings size={26} aria-hidden="true" />
          </span>
          <h2 className="mt-5 font-display text-2xl font-semibold">Zatím nemáte žádné sportoviště</h2>
          <p className="mt-2 max-w-md text-muted">Založte první sportoviště, přidejte kurty a hráči si u vás budou moci rezervovat.</p>
          <Link href="/venues/new" className="button button-dark mt-6 gap-2">
            Založit první sportoviště <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>
      )}

      {state.status === "done" && state.venues.length > 0 && (
        <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {state.venues.map((venue) => {
            const status = statusOf(venue);
            const src = venue.imageUrl ? venueImageSrc(venue.imageUrl) : imageForSports(venue.sports);
            return (
              <li key={venue.id}>
                <Link
                  href={`/venues/${venue.id}`}
                  className={`group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-page transition-[border-color,box-shadow] duration-200 hover:border-muted/50 hover:shadow-[0_16px_36px_-24px_rgba(23,59,43,.35)] ${venue.active ? "" : "opacity-80"}`}
                >
                  <div className="relative aspect-[16/9] overflow-hidden bg-surface">
                    <Image src={src} unoptimized={!isOptimizableImage(src)} alt="" fill sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className={`object-cover transition duration-500 group-hover:scale-[1.04] ${venue.active ? "" : "grayscale"}`} />
                    <span className={`absolute top-3 left-3 rounded-full px-2.5 py-1 text-xs font-semibold ${status.className}`}>{status.label}</span>
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <p className="flex items-center gap-1.5 text-sm text-muted"><MapPin size={15} aria-hidden="true" />{venue.city}</p>
                    <h2 className="mt-1.5 font-display text-xl leading-snug font-semibold tracking-[-.02em]">{venue.name}</h2>
                    <p className="mt-2 text-sm text-muted">
                      {courtsLabel(venue.courtCount)}
                      {venue.sports.length > 0 && `: ${venue.sports.slice(0, 3).map(capitalize).join(", ")}`}
                    </p>
                    <p className="mt-auto pt-5 text-sm leading-relaxed text-muted">{status.hint}</p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
