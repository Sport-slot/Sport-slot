"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowClockwise,
  ArrowDown,
  ArrowLeft,
  ArrowUpRight,
  CaretRight,
  Clock,
  House,
  Info,
  MapPin,
  Plus,
  Sun,
  WarningCircle,
} from "@phosphor-icons/react";
import { ApiError } from "@/lib/api";
import { dayNames, daysOfWeek } from "@/lib/venueForm";
import { isOptimizableImage, venueImageSrc } from "@/lib/venueImages";
import { capitalize, imageForSports } from "@/lib/venueVisuals";
import { getVenue, type VenueDetail as Venue } from "@/lib/venues";
import { DeactivatedNotice, VenueManagement } from "@/components/VenueManagement";

type LoadState =
  | { status: "loading" }
  | { status: "notFound" }
  | { status: "error"; message: string }
  | { status: "done"; venue: Venue };

function todayDayOfWeek(): number {
  const day = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Prague", weekday: "short" }).format(new Date());
  return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(day) + 1;
}

function sportsOf(venue: Venue): string[] {
  return [
    ...new Set(
      venue.courts.flatMap((court) =>
        court.sport.split(",").map((sport) => sport.trim()).filter(Boolean),
      ),
    ),
  ];
}

export function VenueDetail({ id, backHref = "/venues" }: { id: string; backHref?: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setState({ status: "loading" });
    getVenue(id)
      .then((venue) => {
        if (active) setState({ status: "done", venue });
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof ApiError && (error.status === 404 || error.status === 400)) {
          setState({ status: "notFound" });
          return;
        }
        setState({
          status: "error",
          message:
            error instanceof ApiError
              ? error.message
              : "Server teď neodpovídá. Pokud byl delší dobu nečinný, probouzí se – zkuste to za chvíli znovu.",
        });
      });
    return () => {
      active = false;
    };
  }, [id, attempt]);

  return (
    <main id="main-content" className="section-wrap pt-8 pb-20 md:pt-10">
      <nav aria-label="Drobečková navigace">
        <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
          <li>
            <Link href={backHref} className="inline-flex min-h-11 items-center gap-2 rounded-md font-medium hover:text-foreground hover:underline">
              <ArrowLeft size={16} aria-hidden="true" /> Zpět na sportoviště
            </Link>
          </li>
          <li aria-hidden="true">
            <CaretRight size={12} />
          </li>
          <li aria-current="page" className="max-w-[60vw] truncate font-medium text-foreground">
            {state.status === "done" ? state.venue.name : "Detail"}
          </li>
        </ol>
      </nav>

      {state.status === "loading" && <><p role="status" className="sr-only">Načítání sportoviště…</p><DetailSkeleton /></>}

      {state.status === "notFound" && (
        <div className="mt-8 flex flex-col items-center rounded-2xl border border-dashed border-line px-6 py-16 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-surface text-muted">
            <MapPin size={26} aria-hidden="true" />
          </span>
          <h1 className="mt-5 font-display text-2xl font-semibold text-foreground">
            Sportoviště nenalezeno
          </h1>
          <p className="mt-2 max-w-md text-muted">
            Odkaz je neplatný nebo sportoviště už neexistuje.
          </p>
          <Link href={backHref} className="button button-dark mt-6">
            Prohlédnout sportoviště
          </Link>
        </div>
      )}

      {state.status === "error" && (
        <div role="alert" className="mt-8 flex flex-col items-start gap-4 rounded-2xl border border-line bg-surface/60 p-6 sm:flex-row sm:items-center">
          <WarningCircle size={28} aria-hidden="true" className="shrink-0 text-red-700 dark:text-red-400" />
          <div className="flex-1">
            <p className="font-semibold text-foreground">Sportoviště se nepodařilo načíst</p>
            <p className="mt-1 text-sm text-muted">{state.message}</p>
          </div>
          <button type="button" onClick={() => setAttempt(attempt + 1)} className="button button-outline">
            Zkusit znovu <ArrowClockwise size={18} aria-hidden="true" />
          </button>
        </div>
      )}

      {state.status === "done" && (
        <VenueContent
          key={state.venue.id}
          venue={state.venue}
          onChange={(patch) => setState({ status: "done", venue: { ...state.venue, ...patch } })}
        />
      )}
    </main>
  );
}

function DetailSkeleton() {
  return (
    <div aria-hidden="true" className="mt-6">
      <div className="h-12 w-2/3 animate-pulse rounded-lg bg-surface" />
      <div className="mt-4 h-5 w-1/3 animate-pulse rounded bg-surface" />
      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="aspect-[2/1] animate-pulse rounded-2xl bg-surface" />
        <div className="h-96 animate-pulse rounded-2xl bg-surface" />
      </div>
    </div>
  );
}

function VenueContent({
  venue,
  onChange,
}: {
  venue: Venue;
  onChange: (patch: Pick<Venue, "active" | "deactivatedAt">) => void;
}) {
  const [selectedSport, setSelectedSport] = useState("");
  const sports = sportsOf(venue);
  const today = todayDayOfWeek();
  const hoursByDay = new Map(venue.openingHours.map((hours) => [hours.dayOfWeek, hours]));
  const todayHours = hoursByDay.get(today as Venue["openingHours"][number]["dayOfWeek"]);
  const mapHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${venue.name}, ${venue.address}, ${venue.city}`)}`;
  const courts = selectedSport
    ? venue.courts.filter((court) => court.sport.split(",").some((sport) => sport.trim().toLocaleLowerCase("cs") === selectedSport.toLocaleLowerCase("cs")))
    : venue.courts;

  return (
    <>
      <header className="mt-5">
        <div className="flex flex-wrap gap-2">
          {sports.map((sport) => <span key={sport} className="rounded-md bg-surface px-2.5 py-1 text-xs font-semibold">{capitalize(sport)}</span>)}
        </div>
        <h1 className="mt-4 max-w-4xl text-balance font-display text-[clamp(2rem,4.5vw,3.5rem)] leading-[1.08] font-semibold tracking-[-.045em]">
          {venue.name}
        </h1>
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted">
          <a href={mapHref} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-md underline decoration-line underline-offset-4 hover:text-foreground">
            <MapPin size={18} className="shrink-0" aria-hidden="true" />
            {venue.address}, {venue.city}
            <ArrowUpRight size={15} className="shrink-0" aria-hidden="true" /><span className="sr-only"> (mapa v novém okně)</span>
          </a>
          <a href="#oteviraci-doba" className="inline-flex min-h-11 items-center gap-2 rounded-md hover:text-foreground">
            <Clock size={18} aria-hidden="true" />
            {todayHours ? `Dnes ${todayHours.openTime}–${todayHours.closeTime}` : "Dnes zavřeno"}
          </a>
        </div>
      </header>

      <DeactivatedNotice venue={venue} />

      <div className="mt-6 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10">
        <div className="min-w-0">
          <figure className="relative aspect-[16/9] overflow-hidden rounded-2xl bg-surface sm:aspect-[2.3/1]">
            <Image src={venue.imageUrl ? venueImageSrc(venue.imageUrl) : imageForSports(sports)} unoptimized={venue.imageUrl ? !isOptimizableImage(venueImageSrc(venue.imageUrl)) : false} alt={venue.imageUrl ? venue.name : ""} fill priority sizes="(min-width: 1360px) 900px, (min-width: 1024px) 65vw, 100vw" className="object-cover" />
            {!venue.imageUrl && <figcaption className="absolute right-3 bottom-3 rounded-md bg-brand-900/75 px-2.5 py-1.5 text-xs text-white">Ilustrační fotografie</figcaption>}
          </figure>
          <nav aria-label="Na této stránce" className="mt-4 flex flex-wrap gap-x-5 border-b border-line text-sm font-medium sm:gap-x-7">
            <a href="#kurty" className="inline-flex min-h-13 items-center gap-2 border-b-2 border-foreground">Kurty a hřiště <span className="text-muted">{venue.courts.length}</span></a>
            {venue.description && <a href="#o-sportovisti" className="inline-flex min-h-13 items-center text-muted hover:text-foreground">O sportovišti</a>}
            <a href="#oteviraci-doba" className="inline-flex min-h-13 items-center text-muted hover:text-foreground">Otevírací doba</a>
          </nav>

          <section id="kurty" className="scroll-mt-28 pt-8" aria-labelledby="courts-title">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="courts-title" className="font-display text-2xl font-semibold tracking-tight">Kurty a hřiště</h2>
              {venue.isOwner && <Link href={`/venues/${venue.id}/courts/new`} className="button button-outline min-h-11 gap-2 px-4 py-2"><Plus size={16} aria-hidden="true" /> Přidat kurt</Link>}
            </div>
            {sports.length > 1 && (
              <div className="mt-4 flex flex-wrap gap-2" aria-label="Filtrovat kurty podle sportu">
                {["", ...sports].map((sport) => <button key={sport} type="button" onClick={() => setSelectedSport(sport)} aria-pressed={selectedSport === sport} className={`min-h-11 rounded-full border px-4 text-sm transition-colors ${selectedSport === sport ? "border-foreground bg-foreground text-page" : "border-line hover:bg-surface"}`}>{sport ? capitalize(sport) : "Všechny kurty"}</button>)}
              </div>
            )}
            {venue.courts.length === 0 ? (
              <div className="mt-5 rounded-xl bg-surface p-6"><p className="font-medium">Nabídku kurtů připravujeme</p><p className="mt-1 text-sm leading-relaxed text-muted">Správce zatím nepřidal žádné kurty ani hřiště.</p></div>
            ) : (
              <>
                <p role="status" className="sr-only">Zobrazeno {courts.length} z {venue.courts.length} kurtů a hřišť</p>
                <ul className="mt-5 divide-y divide-line border-y border-line">
                  {courts.map((court, index) => (
                    <li key={court.id} className="flex items-start gap-4 py-5">
                      <span aria-hidden="true" className="hidden size-11 shrink-0 items-center justify-center rounded-xl bg-surface font-display text-sm font-semibold text-muted sm:flex">{String(index + 1).padStart(2, "0")}</span>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold">{court.name}</h3>
                        <p className="mt-1.5 text-sm leading-relaxed text-muted">{capitalize(court.sport)}{court.surface && <> <span aria-hidden="true">·</span> {court.surface}</>}</p>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-surface px-2.5 py-1.5 text-xs font-medium">
                        {court.indoor ? <House size={14} aria-hidden="true" /> : <Sun size={14} aria-hidden="true" />}{court.indoor ? "V hale" : "Venku"}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 flex items-start gap-2 text-sm leading-relaxed text-muted"><Info size={17} className="mt-0.5 shrink-0" aria-hidden="true" />Online rezervace připravujeme. Zatím si můžete prohlédnout nabídku kurtů.</p>
              </>
            )}
          </section>

          {venue.description && (
            <section id="o-sportovisti" className="scroll-mt-28 pt-10" aria-labelledby="about-title">
              <h2 id="about-title" className="font-display text-2xl font-semibold tracking-tight">O sportovišti</h2>
              <p className="mt-4 max-w-prose leading-7 whitespace-pre-line text-muted">{venue.description}</p>
            </section>
          )}
        </div>

        <aside id="oteviraci-doba" className="scroll-mt-28 rounded-2xl border border-line bg-surface/50 p-5 sm:p-6 lg:sticky lg:top-26" aria-labelledby="hours-title">
          <h2 id="hours-title" className="flex items-center gap-2 font-display text-xl font-semibold"><Clock size={21} aria-hidden="true" /> Otevírací doba</h2>
          <p className="mt-3 text-sm text-muted">Naplánujte si návštěvu.</p>
          <dl className="mt-5 grid gap-1">
            {daysOfWeek.map((day) => {
              const hours = hoursByDay.get(day);
              const isToday = day === today;
              return (
                <div key={day} className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm ${isToday ? "bg-page font-semibold" : "text-muted"}`}>
                  <dt>{dayNames[day]}{isToday && <span className="ml-1.5 text-xs font-normal text-muted">dnes</span>}</dt>
                  <dd className="whitespace-nowrap tabular-nums">{hours ? `${hours.openTime}–${hours.closeTime}` : "Zavřeno"}</dd>
                </div>
              );
            })}
          </dl>
          <div className="mt-5 border-t border-line pt-5">
            <p className="flex items-start gap-2 text-sm leading-relaxed"><MapPin size={18} className="mt-0.5 shrink-0" aria-hidden="true" /><span>{venue.address}<br /><span className="text-muted">{venue.city}</span></span></p>
            <a href={mapHref} target="_blank" rel="noopener noreferrer" className="button button-dark mt-5 w-full gap-2">Otevřít v mapách <ArrowUpRight size={18} aria-hidden="true" /><span className="sr-only"> (nové okno)</span></a>
            {venue.courts.length > 0 && <a href="#kurty" className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg text-sm font-medium hover:bg-page">Prohlédnout kurty <ArrowDown size={16} aria-hidden="true" /></a>}
          </div>
          {venue.isOwner && <VenueManagement venue={venue} onChange={onChange} />}
        </aside>
      </div>
    </>
  );
}
