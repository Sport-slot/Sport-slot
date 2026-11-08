"use client";

import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowClockwise,
  ArrowLeft,
  ArrowRight,
  Check,
  MagnifyingGlass,
  MapPin,
  Plus,
  TennisBall,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { isOptimizableImage, venueImageSrc } from "@/lib/venueImages";
import { capitalize, imageForSports, popularSports } from "@/lib/venueVisuals";
import { listVenues, venuePageSize, type VenueList, type VenueListItem } from "@/lib/venues";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "done"; list: VenueList };

const fieldClass =
  "h-12 w-full rounded-xl border border-line bg-page pr-10 pl-11 text-base text-foreground placeholder:text-muted/70 transition focus:border-brand-500 focus:ring-3 focus:ring-brand-500/20 focus:outline-none";

function pageIndexFrom(value: string | null): number {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : 0;
}

function venuesLabel(count: number): string {
  if (count === 1) return "1 sportoviště";
  if (count >= 2 && count <= 4) return `${count} sportoviště`;
  return `${count} sportovišť`;
}

export function VenueSearchSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="h-[280px] animate-pulse rounded-2xl bg-surface md:h-[174px]" />
      <div className="mt-10 h-5 w-40 animate-pulse rounded bg-surface" />
      <ResultSkeleton />
    </div>
  );
}

export function VenueSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const city = searchParams.get("city") ?? "";
  const sport = searchParams.get("sport") ?? "";
  const pageIndex = pageIndexFrom(searchParams.get("page"));

  const [cityInput, setCityInput] = useState(city);
  const [sportInput, setSportInput] = useState(sport);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setCityInput(city);
    setSportInput(sport);
  }, [city, sport]);

  useEffect(() => {
    let active = true;
    setState({ status: "loading" });
    listVenues({ city, sport, pageIndex })
      .then((list) => {
        if (active) setState({ status: "done", list });
      })
      .catch((error: unknown) => {
        if (!active) return;
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
  }, [city, sport, pageIndex, attempt]);

  function hrefFor(next: { city: string; sport: string; pageIndex: number }) {
    const query = new URLSearchParams();
    if (next.city.trim()) query.set("city", next.city.trim());
    if (next.sport.trim()) query.set("sport", next.sport.trim());
    if (next.pageIndex > 0) query.set("page", String(next.pageIndex));
    const search = query.toString();
    return search ? `${pathname}?${search}` : pathname;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push(hrefFor({ city: cityInput, sport: sportInput, pageIndex: 0 }), { scroll: false });
  }

  function toggleSport(value: string) {
    const nextSport = sport.toLocaleLowerCase("cs") === value ? "" : value;
    router.push(hrefFor({ city: cityInput, sport: nextSport, pageIndex: 0 }), { scroll: false });
  }

  const filtered = Boolean(city || sport);
  const isManager = Boolean(user?.roles.includes("MANAGER"));

  return (
    <>
      <form
        role="search"
        aria-label="Vyhledat sportoviště"
        onSubmit={handleSubmit}
        className="rounded-2xl border border-line bg-surface/60 p-4 md:p-6"
      >
        <div className="grid items-end gap-4 md:grid-cols-[1fr_1fr_auto]">
          <div>
            <label htmlFor="venue-city" className="mb-2 block text-sm font-semibold">Kde chcete hrát?</label>
            <div className="relative">
            <MapPin size={20} aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted" />
            <input
              className={fieldClass}
              id="venue-city"
              name="city"
              value={cityInput}
              placeholder="Město, třeba Praha"
              autoComplete="address-level2"
              onChange={(event) => setCityInput(event.target.value)}
            />
            {cityInput && <button type="button" aria-label="Vymazat město" onClick={() => { setCityInput(""); document.getElementById("venue-city")?.focus(); }} className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-xl text-muted hover:text-foreground"><X size={16} aria-hidden="true" /></button>}
            </div>
          </div>
          <div>
            <label htmlFor="venue-sport" className="mb-2 block text-sm font-semibold">Co si zahrajete?</label>
            <div className="relative">
            <TennisBall size={20} aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted" />
            <input
              className={fieldClass}
              id="venue-sport"
              name="sport"
              list="venue-sport-options"
              value={sportInput}
              placeholder="Všechny sporty"
              onChange={(event) => setSportInput(event.target.value)}
            />
            <datalist id="venue-sport-options">{popularSports.map((value) => <option key={value} value={capitalize(value)} />)}</datalist>
            {sportInput && <button type="button" aria-label="Vymazat sport" onClick={() => { setSportInput(""); document.getElementById("venue-sport")?.focus(); }} className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-xl text-muted hover:text-foreground"><X size={16} aria-hidden="true" /></button>}
            </div>
          </div>
          <button type="submit" className="button button-primary h-12 min-h-12 gap-2.5">
            <MagnifyingGlass size={18} aria-hidden="true" /> Najít sportoviště
          </button>
        </div>
        <div className="-mx-4 mt-5 flex items-center gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0 [&>button]:shrink-0 [&>button]:whitespace-nowrap" aria-label="Rychlý výběr sportu">
          <button type="button" aria-pressed={!sport} onClick={() => router.push(hrefFor({ city: cityInput, sport: "", pageIndex: 0 }), { scroll: false })} className={`min-h-11 rounded-full border px-4 text-sm font-medium transition-colors ${!sport ? "border-foreground bg-foreground text-page" : "border-line bg-page hover:border-muted"}`}>Všechny sporty</button>
          {popularSports.map((value) => {
            const active = sport.toLocaleLowerCase("cs") === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={active}
                onClick={() => toggleSport(value)}
                className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors ${
                  active
                    ? "border-foreground bg-foreground text-page"
                    : "border-line bg-page text-foreground hover:border-muted"
                }`}
              >
                {active && <Check size={15} aria-hidden="true" />}{capitalize(value)}
              </button>
            );
          })}
        </div>
      </form>

      <section id="vysledky" aria-labelledby="venue-results-title" aria-busy={state.status === "loading"} className="mt-9 scroll-mt-28">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="venue-results-title" aria-live="polite" aria-atomic="true" className="font-display text-xl font-semibold tracking-tight">
            {state.status === "done"
              ? venuesLabel(state.list.pageInfo.total)
              : state.status === "loading"
                ? "Hledáme…"
                : "Výsledky"}
          </h2>
          {isManager && <Link href="/venues/new" className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold hover:underline"><Plus size={16} aria-hidden="true" /> Přidat sportoviště</Link>}
        </div>
        {filtered && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {city && <Link scroll={false} href={hrefFor({ city: "", sport, pageIndex: 0 })} aria-label={`Zrušit filtr města ${city}`} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-surface px-3 text-sm hover:bg-line"><MapPin size={15} aria-hidden="true" />{city}<X size={14} aria-hidden="true" /></Link>}
            {sport && <Link scroll={false} href={hrefFor({ city, sport: "", pageIndex: 0 })} aria-label={`Zrušit filtr sportu ${sport}`} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-surface px-3 text-sm hover:bg-line"><TennisBall size={15} aria-hidden="true" />{capitalize(sport)}<X size={14} aria-hidden="true" /></Link>}
            <Link
              href={pathname}
              scroll={false}
              className="inline-flex min-h-11 items-center px-2 text-sm text-muted underline underline-offset-4 hover:text-foreground"
            >
              Zrušit vše
            </Link>
          </div>
        )}

        {state.status === "loading" && <ResultSkeleton />}

        {state.status === "error" && (
          <div role="alert" className="mt-6 flex flex-col items-start gap-4 rounded-2xl border border-line bg-surface/60 p-6 sm:flex-row sm:items-center">
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

        {state.status === "done" && state.list.itemList.length === 0 && (
          <div className="mt-6 flex flex-col items-center rounded-2xl border border-dashed border-line px-6 py-14 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-surface text-muted">
              <MagnifyingGlass size={26} aria-hidden="true" />
            </span>
            <p className="mt-5 font-display text-xl font-semibold text-foreground">
              {pageIndex > 0 ? "Na této stránce už nic není" : filtered ? "Nic jsme nenašli" : "Zatím tu není žádné sportoviště"}
            </p>
            <p className="mt-2 max-w-md text-muted">
              {pageIndex > 0
                ? "Vraťte se na první stránku a projděte aktuální nabídku."
                : filtered
                ? "Zkuste jiné město nebo sport, případně zrušte filtry a projděte všechna sportoviště."
                : "Jakmile správci přidají svá sportoviště a kurty, objeví se tady."}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {pageIndex > 0 && <Link href={hrefFor({ city, sport, pageIndex: 0 })} className="button button-dark">Zpět na první stránku</Link>}
              {filtered && (
                <Link href={pathname} className="button button-outline">
                  Zrušit filtry
                </Link>
              )}
              {isManager && (
                <Link href="/venues/new" className="button button-dark">
                  Přidat sportoviště <Plus size={18} aria-hidden="true" />
                </Link>
              )}
            </div>
          </div>
        )}

        {state.status === "done" && state.list.itemList.length > 0 && (
          <>
            <ul className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {state.list.itemList.map((venue, index) => (
                <li key={venue.id}>
                  <VenueCard venue={venue} priority={index < 3} highlightedSport={sport} returnHref={hrefFor({ city, sport, pageIndex })} />
                </li>
              ))}
            </ul>
            <Pagination
              pageIndex={pageIndex}
              total={state.list.pageInfo.total}
              hrefFor={(nextPage) => `${hrefFor({ city, sport, pageIndex: nextPage })}#vysledky`}
            />
          </>
        )}
      </section>
    </>
  );
}

function ResultSkeleton() {
  return (
    <div aria-hidden="true" className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="overflow-hidden rounded-2xl border border-line">
          <div className="aspect-[16/9] animate-pulse bg-surface" />
          <div className="space-y-3 p-5">
            <div className="h-5 w-2/3 animate-pulse rounded bg-surface" />
            <div className="h-4 w-1/3 animate-pulse rounded bg-surface" />
            <div className="flex gap-2">
              <div className="h-6 w-16 animate-pulse rounded-full bg-surface" />
              <div className="h-6 w-20 animate-pulse rounded-full bg-surface" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function VenueCard({
  venue,
  priority,
  highlightedSport,
  returnHref,
}: {
  venue: VenueListItem;
  priority: boolean;
  highlightedSport: string;
  returnHref: string;
}) {
  const shown = venue.sports.slice(0, 3);
  const hidden = venue.sports.length - shown.length;
  const highlight = highlightedSport.toLocaleLowerCase("cs");

  return (
    <Link
      href={`/venues/${venue.id}${returnHref !== "/venues" ? `?from=${encodeURIComponent(returnHref)}` : ""}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-page transition-[border-color,box-shadow] duration-200 hover:border-muted/50 hover:shadow-[0_16px_36px_-24px_rgba(23,59,43,.35)]"
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-surface">
        <Image
          src={venue.imageUrl ? venueImageSrc(venue.imageUrl) : imageForSports(venue.sports)}
          unoptimized={venue.imageUrl ? !isOptimizableImage(venueImageSrc(venue.imageUrl)) : false}
          alt={venue.imageUrl ? venue.name : ""}
          fill
          priority={priority}
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition duration-500 group-hover:scale-[1.04]"
        />
        {!venue.imageUrl && <span className="absolute right-3 bottom-3 rounded-md bg-brand-900/70 px-2 py-1 text-[10px] text-white">Ilustrační foto</span>}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="mb-2 flex items-center gap-1.5 text-sm text-muted"><MapPin size={15} aria-hidden="true" />{venue.city}</p>
        <h3 className="font-display text-xl leading-snug font-semibold tracking-[-.02em] text-foreground">
          {venue.name}
        </h3>
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Sporty">
          {shown.map((value) => (
            <li
              key={value}
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                highlight && value.toLocaleLowerCase("cs").includes(highlight)
                  ? "bg-ball text-brand-900"
                  : "bg-surface text-foreground"
              }`}
            >
              {capitalize(value)}
            </li>
          ))}
          {hidden > 0 && (
            <li className="rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-muted">+{hidden}</li>
          )}
        </ul>
        {venue.sports.length === 0 && <p className="mt-2 text-sm text-muted">Nabídka sportů se připravuje</p>}
        <span className="mt-auto flex items-center justify-between gap-2 pt-6 text-sm font-semibold text-foreground">
          Detail a kurty
          <span className="flex size-9 items-center justify-center rounded-full bg-surface transition-colors group-hover:bg-ball group-hover:text-brand-900"><ArrowRight size={17} aria-hidden="true" /></span>
        </span>
      </div>
    </Link>
  );
}

function Pagination({
  pageIndex,
  total,
  hrefFor,
}: {
  pageIndex: number;
  total: number;
  hrefFor: (pageIndex: number) => string;
}) {
  const pageCount = Math.ceil(total / venuePageSize);
  if (pageCount <= 1) return null;

  return (
    <nav aria-label="Stránkování" className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6">
      {pageIndex > 0 ? (
        <Link href={hrefFor(pageIndex - 1)} className="button button-outline gap-2 px-4">
          <ArrowLeft size={16} aria-hidden="true" /> Předchozí
        </Link>
      ) : (
        <span />
      )}
      <span className="order-first w-full text-center text-sm text-muted sm:order-none sm:w-auto">
        Strana <strong className="text-foreground">{pageIndex + 1}</strong> z {pageCount}
      </span>
      {pageIndex + 1 < pageCount ? (
        <Link href={hrefFor(pageIndex + 1)} className="button button-outline gap-2 px-4">
          Další <ArrowRight size={16} aria-hidden="true" />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
