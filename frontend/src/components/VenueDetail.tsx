"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowClockwise,
  ArrowLeft,
  ArrowUpRight,
  ArrowsOutSimple,
  Check,
  House,
  MapPin,
  NavigationArrow,
  Plus,
  ShareNetwork,
  Sun,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { ApiError, type DayOfWeek } from "@/lib/api";
import { dayNames, daysOfWeek } from "@/lib/venueForm";
import { isOptimizableImage, stockVenuePhotos, venueImageSrc } from "@/lib/venueImages";
import { capitalize, imageForSports } from "@/lib/venueVisuals";
import { getVenue, type Court, type VenueDetail as Venue } from "@/lib/venues";
import { DeactivatedNotice, VenueManagement } from "@/components/VenueManagement";

type LoadState =
  | { status: "loading" }
  | { status: "notFound" }
  | { status: "error"; message: string }
  | { status: "done"; venue: Venue };

type PragueNow = { day: DayOfWeek; minutes: number };

const weekdayIndex: Record<string, DayOfWeek> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
const onDay: Record<DayOfWeek, string> = {
  1: "v pondělí",
  2: "v úterý",
  3: "ve středu",
  4: "ve čtvrtek",
  5: "v pátek",
  6: "v sobotu",
  7: "v neděli",
};

function courtSports(court: Court): string[] {
  return court.sport.split(",").map((sport) => sport.trim().toLocaleLowerCase("cs")).filter(Boolean);
}

function sportsOf(venue: Venue): { sport: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const court of venue.courts) {
    for (const sport of new Set(courtSports(court))) counts.set(sport, (counts.get(sport) ?? 0) + 1);
  }
  return [...counts].map(([sport, count]) => ({ sport, count }));
}

function settingOf(courts: Court[]): string {
  if (courts.length === 0) return "Neuvedeno";
  if (courts.every((court) => court.indoor)) return "V hale";
  if (courts.every((court) => !court.indoor)) return "Venku";
  return "Hala i venku";
}

function courtCountLabel(count: number): string {
  if (count === 1) return "kurt";
  if (count >= 2 && count <= 4) return "kurty";
  return "kurtů";
}

function at(time: string): string {
  return [2, 3, 4, 12, 14, 20, 21, 22, 23].includes(Number(time.split(":")[0])) ? `ve ${time}` : `v ${time}`;
}

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function pragueNow(): PragueNow {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Prague",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "0";
  return { day: weekdayIndex[part("weekday")] ?? 1, minutes: Number(part("hour")) * 60 + Number(part("minute")) };
}

function usePragueNow(): PragueNow | null {
  const [now, setNow] = useState<PragueNow | null>(null);
  useEffect(() => {
    setNow(pragueNow());
    const interval = window.setInterval(() => setNow(pragueNow()), 60_000);
    return () => window.clearInterval(interval);
  }, []);
  return now;
}

function openStatus(venue: Venue, now: PragueNow): { open: boolean; label: string } | null {
  const hoursByDay = new Map(venue.openingHours.map((hours) => [hours.dayOfWeek, hours]));
  if (hoursByDay.size === 0) return null;
  const today = hoursByDay.get(now.day);
  if (today && now.minutes >= toMinutes(today.openTime) && now.minutes < toMinutes(today.closeTime)) {
    return { open: true, label: `Zavírá ${at(today.closeTime)}` };
  }
  if (today && now.minutes < toMinutes(today.openTime)) {
    return { open: false, label: `Otevírá ${at(today.openTime)}` };
  }
  for (let offset = 1; offset <= 7; offset += 1) {
    const day = (((now.day - 1 + offset) % 7) + 1) as DayOfWeek;
    const next = hoursByDay.get(day);
    if (next) return { open: false, label: `Otevírá ${offset === 1 ? "zítra" : onDay[day]} ${at(next.openTime)}` };
  }
  return null;
}

export function VenueDetail({ id, backHref = "/venues", initialVenue }: { id: string; backHref?: string; initialVenue?: Venue }) {
  const [state, setState] = useState<LoadState>(initialVenue ? { status: "done", venue: initialVenue } : { status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (initialVenue) return;
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
  }, [id, attempt, initialVenue]);

  if (state.status === "done") {
    return (
      <main id="main-content" className="pb-24 md:pb-32">
        <VenueContent
          key={state.venue.id}
          venue={state.venue}
          backHref={backHref}
          onChange={(patch) => setState({ status: "done", venue: { ...state.venue, ...patch } })}
        />
      </main>
    );
  }

  return (
    <main id="main-content" className="pb-24">
      {state.status === "loading" && <><p role="status" className="sr-only">Načítání sportoviště…</p><DetailSkeleton /></>}

      {state.status !== "loading" && (
        <div className="section-wrap pt-6">
          <Link href={backHref} className="-ml-1 inline-flex min-h-11 items-center gap-2 rounded-md px-1 text-sm font-medium text-muted transition-colors hover:text-foreground">
            <ArrowLeft size={16} aria-hidden="true" /> Všechna sportoviště
          </Link>

          {state.status === "notFound" && (
            <div className="mt-8 flex flex-col items-center rounded-3xl border border-dashed border-line px-6 py-20 text-center">
              <span className="flex size-14 items-center justify-center rounded-2xl bg-surface text-muted">
                <MapPin size={26} aria-hidden="true" />
              </span>
              <h1 className="mt-5 font-display text-2xl font-semibold">Sportoviště nenalezeno</h1>
              <p className="mt-2 max-w-md text-muted">Odkaz je neplatný nebo sportoviště už neexistuje.</p>
              <Link href={backHref} className="button button-dark mt-6">Prohlédnout sportoviště</Link>
            </div>
          )}

          {state.status === "error" && (
            <div role="alert" className="mt-8 flex flex-col items-start gap-4 rounded-2xl border border-line bg-surface/60 p-6 sm:flex-row sm:items-center">
              <WarningCircle size={28} aria-hidden="true" className="shrink-0 text-red-700 dark:text-red-400" />
              <div className="flex-1">
                <p className="font-semibold">Sportoviště se nepodařilo načíst</p>
                <p className="mt-1 text-sm text-muted">{state.message}</p>
              </div>
              <button type="button" onClick={() => setAttempt(attempt + 1)} className="button button-outline">
                Zkusit znovu <ArrowClockwise size={18} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      )}
    </main>
  );
}

function DetailSkeleton() {
  return (
    <div aria-hidden="true" className="motion-safe:animate-pulse">
      <div className="h-[min(72svh,680px)] min-h-[440px] bg-surface" />
      <div className="section-wrap">
        <div className="relative -mt-12 h-28 rounded-2xl border border-line bg-page" />
        <div className="mt-20 h-12 w-72 rounded-lg bg-surface" />
        <div className="mt-10 grid gap-3">
          {[0, 1, 2, 3].map((item) => <div key={item} className="h-16 rounded-lg bg-surface" />)}
        </div>
      </div>
    </div>
  );
}

function VenueHero({ venue, sports, backHref }: { venue: Venue; sports: string[]; backHref: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [failed, setFailed] = useState(false);
  const src = venue.imageUrl && !failed ? venueImageSrc(venue.imageUrl) : imageForSports(sports);
  const illustrative = !venue.imageUrl || failed || stockVenuePhotos.some((photo) => photo.src === venue.imageUrl);
  const alt = illustrative ? `Ilustrační fotografie pro sportoviště ${venue.name}` : `Fotografie sportoviště ${venue.name}`;
  const glass = "border border-white/20 bg-brand-900/35 text-white backdrop-blur-md transition-colors hover:bg-brand-900/55 focus-visible:outline-white";

  return (
    <>
      <section aria-labelledby="venue-title" className="relative isolate flex h-[min(76svh,720px)] min-h-[480px] flex-col overflow-hidden bg-brand-900">
        <div className="hero-photo absolute inset-0 -z-20">
          <Image src={src} unoptimized={!isOptimizableImage(src)} alt={alt} fill priority sizes="100vw" className="object-cover" onError={() => setFailed(true)} />
        </div>
        <div aria-hidden="true" className="absolute inset-x-0 top-0 -z-10 h-40 bg-linear-to-b from-brand-900/55 to-transparent" />
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 -z-10 h-[75%] bg-linear-to-t from-[#0c1f15] via-[#0c1f15]/55 to-transparent" />

        <div className="section-wrap flex w-full items-center justify-between gap-3 pt-5 md:pt-6">
          <Link href={backHref} className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-medium ${glass}`}>
            <ArrowLeft size={16} aria-hidden="true" /> <span>Všechna sportoviště</span>
          </Link>
          <div className="flex items-center gap-2">
            {illustrative && <span className="hidden rounded-md bg-black/30 px-2.5 py-1 text-xs text-white/80 backdrop-blur-md md:inline">Ilustrační fotografie</span>}
            <button ref={triggerRef} type="button" onClick={() => dialogRef.current?.showModal()} aria-label="Zvětšit fotografii" className={`inline-flex size-11 items-center justify-center rounded-full ${glass}`}>
              <ArrowsOutSimple size={18} aria-hidden="true" />
            </button>
            <ShareVenue className={glass} />
          </div>
        </div>

        <div className="section-wrap mt-auto w-full pb-24 md:pb-28">
          <div className="hero-copy max-w-5xl">
            {sports.length > 0 && <p className="text-sm font-medium text-white/75 md:text-[15px]">{sports.map(capitalize).join("  ·  ")}</p>}
            <h1 id="venue-title" className="mt-3 font-display text-[clamp(3rem,9vw,7.5rem)] leading-[.9] font-semibold tracking-[-.055em] text-balance text-white [overflow-wrap:anywhere]">
              {venue.name}
            </h1>
            <p className="mt-5 flex items-center gap-2 text-base text-white/85 md:text-lg">
              <MapPin size={20} weight="fill" className="shrink-0 text-ball" aria-hidden="true" />
              <span className="[overflow-wrap:anywhere]">{venue.address}, {venue.city}</span>
            </p>
            {illustrative && <p className="mt-3 text-xs text-white/60 md:hidden">Ilustrační fotografie</p>}
          </div>
        </div>

      </section>

      <dialog ref={dialogRef} aria-labelledby="venue-photo-title" onClose={() => triggerRef.current?.focus()} onClick={(event) => { if (event.target === event.currentTarget) dialogRef.current?.close(); }} className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-5xl overflow-auto rounded-2xl border border-line bg-page p-0 text-foreground shadow-xl backdrop:bg-brand-900/80 backdrop:backdrop-blur-sm">
        <div className="flex items-center justify-between gap-4 px-5 py-3">
          <h2 id="venue-photo-title" className="min-w-0 font-display font-semibold [overflow-wrap:anywhere]">{venue.name}{illustrative && <span className="block font-sans text-xs font-normal text-muted">Ilustrační fotografie</span>}</h2>
          <button type="button" autoFocus onClick={() => dialogRef.current?.close()} aria-label="Zavřít fotografii" className="flex size-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-surface"><X size={22} aria-hidden="true" /></button>
        </div>
        <div className="relative h-[min(70dvh,700px)] bg-surface">
          <Image src={src} unoptimized={!isOptimizableImage(src)} alt={alt} fill sizes="(min-width: 1024px) 1024px, 100vw" className="object-contain" />
        </div>
      </dialog>
    </>
  );
}

function ShareVenue({ className }: { className: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");

  useEffect(() => {
    if (status === "idle") return;
    const timeout = window.setTimeout(() => setStatus("idle"), 4000);
    return () => window.clearTimeout(timeout);
  }, [status]);

  async function copyLink() {
    try {
      const url = new URL(window.location.href);
      url.hash = "";
      url.searchParams.delete("from");
      await navigator.clipboard.writeText(url.toString());
      setStatus("copied");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="relative shrink-0">
      <button type="button" onClick={() => void copyLink()} aria-label="Zkopírovat odkaz na sportoviště" className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-medium ${className}`}>
        {status === "copied" ? <Check size={16} aria-hidden="true" /> : <ShareNetwork size={16} aria-hidden="true" />}
        <span className="hidden sm:inline">{status === "copied" ? "Zkopírováno" : "Sdílet"}</span>
      </button>
      <span role="status" className={status === "error" ? "absolute top-full right-0 z-10 mt-2 w-60 rounded-xl border border-line bg-page p-3 text-sm text-foreground shadow-sm" : "sr-only"}>
        {status === "copied" ? "Odkaz zkopírován." : status === "error" ? "Odkaz zkopírujte z adresního řádku prohlížeče." : ""}
      </span>
    </div>
  );
}

function VenueContent({ venue, backHref, onChange }: {
  venue: Venue;
  backHref: string;
  onChange: (patch: Pick<Venue, "active" | "deactivatedAt">) => void;
}) {
  const [selectedSport, setSelectedSport] = useState("");
  const now = usePragueNow();
  const sports = sportsOf(venue);
  const sportNames = sports.map(({ sport }) => sport);
  const mapHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${venue.name}, ${venue.address}, ${venue.city}`)}`;
  const courts = selectedSport ? venue.courts.filter((court) => courtSports(court).includes(selectedSport)) : venue.courts;

  return (
    <>
      <VenueHero venue={venue} sports={sportNames} backHref={backHref} />

      <div className="section-wrap">
        <FactsBar venue={venue} now={now} mapHref={mapHref} />
        <DeactivatedNotice venue={venue} />

        <section id="kurty" aria-labelledby="courts-title" className="mt-20 scroll-mt-28 md:mt-28">
          <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
            <div>
              <h2 id="courts-title" className="section-heading">Kurty a hřiště</h2>
              <p className="mt-3 max-w-[48ch] text-muted">
                {venue.courts.length > 0
                  ? `${venue.courts.length} ${courtCountLabel(venue.courts.length)} pro ${sportNames.length === 1 ? "jeden sport" : `${sportNames.length} ${sportNames.length <= 4 ? "sporty" : "sportů"}`}.`
                  : "Správce zatím nepřidal žádné kurty ani hřiště."}
              </p>
            </div>
            {venue.isOwner && <Link href={`/venues/${venue.id}/courts/new`} className="button button-outline min-h-11 gap-2 px-5 py-2"><Plus size={16} aria-hidden="true" /> Přidat kurt</Link>}
          </div>

          {sports.length > 1 && (
            <div role="group" aria-label="Filtrovat kurty podle sportu" className="-mx-5 mt-8 flex gap-2 overflow-x-auto px-5 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
              {[{ sport: "", count: venue.courts.length }, ...sports].map(({ sport, count }) => {
                const pressed = selectedSport === sport;
                return (
                  <button key={sport || "all"} type="button" onClick={() => setSelectedSport(sport)} aria-pressed={pressed} aria-controls="venue-court-list" className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium whitespace-nowrap transition-[background-color,border-color,color] duration-200 active:scale-[.98] ${pressed ? "border-foreground bg-foreground text-page" : "border-line hover:border-muted"}`}>
                    {sport ? capitalize(sport) : "Vše"}
                    <span className={`tabular-nums ${pressed ? "text-page/55" : "text-muted"}`}>{count}</span>
                  </button>
                );
              })}
            </div>
          )}

          {venue.courts.length > 0 && (
            <>
              <p role="status" className="sr-only">Zobrazeno {courts.length} z {venue.courts.length} kurtů a hřišť</p>
              <div aria-hidden="true" className={`mt-10 hidden gap-8 border-b border-line pb-3 text-xs font-medium text-muted md:grid ${courtColumns}`}>
                <span>#</span><span>Kurt</span><span>Sport</span><span>Povrch</span><span>Prostředí</span>
              </div>
              <ul id="venue-court-list" className="mt-8 border-t border-line md:mt-0 md:border-t-0">
                {courts.map((court) => (
                  <CourtRow key={court.id} court={court} number={venue.courts.indexOf(court) + 1} highlight={selectedSport} />
                ))}
              </ul>
            </>
          )}
        </section>

        <div className={`mt-24 grid gap-14 md:mt-32 ${venue.description ? "lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-24" : ""}`}>
          {venue.description && (
            <section aria-labelledby="about-title">
              <h2 id="about-title" className="text-sm font-semibold text-muted">O sportovišti</h2>
              <p className="mt-5 font-display text-[clamp(1.45rem,2.4vw,2rem)] leading-[1.32] font-medium tracking-[-.02em] text-pretty whitespace-pre-line [overflow-wrap:anywhere]">
                {venue.description}
              </p>
            </section>
          )}
          <OpeningHours venue={venue} now={now} />
        </div>

        <section aria-labelledby="location-title" className="mt-24 grid gap-10 rounded-3xl bg-surface px-6 py-10 md:mt-32 md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:px-12 md:py-14">
          <div className="min-w-0">
            <h2 id="location-title" className="text-sm font-semibold text-muted">Kde to je</h2>
            <address className="mt-4 font-display text-[clamp(2rem,4.5vw,3.5rem)] leading-[1.02] font-semibold tracking-[-.04em] not-italic [overflow-wrap:anywhere]">
              {venue.address}
              <span className="block text-muted">{venue.city}</span>
            </address>
          </div>
          <div className="flex flex-col gap-4 md:max-w-xs md:items-end md:text-right">
            <a href={mapHref} target="_blank" rel="noopener noreferrer" className="button button-dark gap-2.5">
              Navigovat <ArrowUpRight size={18} aria-hidden="true" /><span className="sr-only"> (mapa v novém okně)</span>
            </a>
            <p className="text-sm leading-6 text-muted">
              {venue.active ? "Online rezervace tohoto sportoviště připravujeme. Zatím se domluvte přímo na místě." : "Sportoviště je dočasně mimo provoz. Rezervace nejsou dostupné."}
            </p>
          </div>
        </section>

        {venue.isOwner && (
          <div className="mt-10 max-w-md">
            <VenueManagement venue={venue} onChange={onChange} />
          </div>
        )}
      </div>
    </>
  );
}

function FactsBar({ venue, now, mapHref }: { venue: Venue; now: PragueNow | null; mapHref: string }) {
  const status = now && venue.active ? openStatus(venue, now) : null;
  const todayHours = now ? venue.openingHours.find((hours) => hours.dayOfWeek === now.day) : undefined;

  return (
    <div className="relative z-10 -mt-14 grid grid-cols-2 gap-x-6 gap-y-5 rounded-2xl border border-line bg-page p-5 shadow-[0_30px_60px_-34px_rgb(12_31_21/.45)] md:-mt-16 md:grid-cols-[repeat(4,minmax(0,1fr))_auto] md:items-center md:gap-0 md:p-3 md:pl-0">
      <Fact label="Právě teď">
        {!venue.active ? <span className="text-muted">Mimo provoz</span>
          : status ? (
            <span className="inline-flex items-center gap-2">
              <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${status.open ? "bg-brand-500 shadow-[0_0_0_4px] shadow-brand-500/20" : "bg-muted/50"}`} />
              <span className={status.open ? "" : "text-muted"}>{status.open ? "Otevřeno" : "Zavřeno"}</span>
            </span>
          ) : <span className="text-muted">—</span>}
        {status && <span className="mt-0.5 block font-sans text-xs font-normal tracking-normal text-muted">{status.label}</span>}
      </Fact>
      <Fact label="Dnes">{now ? (todayHours ? `${todayHours.openTime}–${todayHours.closeTime}` : "Zavřeno") : "—"}</Fact>
      <Fact label="Kurty a hřiště">{venue.courts.length}</Fact>
      <Fact label="Prostředí">{settingOf(venue.courts)}</Fact>
      <a href={mapHref} target="_blank" rel="noopener noreferrer" className="button button-primary col-span-2 gap-2.5 md:col-span-1 md:ml-4">
        <NavigationArrow size={18} weight="fill" aria-hidden="true" /> Navigovat<span className="sr-only"> (mapa v novém okně)</span>
      </a>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 md:border-r md:border-line md:px-6 md:py-2">
      <p className="text-xs font-medium text-muted">{label}</p>
      <div className="mt-1.5 font-display text-lg leading-tight font-semibold tracking-[-.015em] tabular-nums md:text-xl">{children}</div>
    </div>
  );
}

const courtColumns = "md:grid-cols-[2.5rem_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1.3fr)_7rem]";

function CourtRow({ court, number, highlight }: { court: Court; number: number; highlight: string }) {
  const sports = courtSports(court);

  return (
    <li className={`grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 border-b border-line py-6 md:items-baseline md:gap-8 md:py-7 ${courtColumns}`}>
      <span aria-hidden="true" className="font-display text-sm font-semibold text-muted tabular-nums md:text-base">{String(number).padStart(2, "0")}</span>
      <h3 className="font-display text-xl leading-snug font-semibold tracking-[-.02em] [overflow-wrap:anywhere] md:text-2xl">{court.name}</h3>
      <p className="col-start-2 text-[15px] leading-6 md:col-start-auto [overflow-wrap:anywhere]">
        {sports.map((sport, index) => (
          <span key={sport}>
            {index > 0 && <span aria-hidden="true" className="text-muted"> · </span>}
            <span className={sport === highlight ? "rounded bg-ball px-1 font-semibold text-brand-900" : ""}>{capitalize(sport)}</span>
          </span>
        ))}
      </p>
      <p className="col-start-2 text-sm leading-6 text-pretty text-muted md:col-start-auto md:text-[15px] [overflow-wrap:anywhere]">
        <span className="sr-only">Povrch: </span>{court.surface || "Povrch neuveden"}
      </p>
      <p className="col-start-2 mt-1 inline-flex items-center gap-1.5 text-sm text-muted md:col-start-auto md:mt-0 md:text-[15px]">
        {court.indoor ? <House size={16} aria-hidden="true" /> : <Sun size={16} aria-hidden="true" />}
        {court.indoor ? "V hale" : "Venku"}
      </p>
    </li>
  );
}

function OpeningHours({ venue, now }: { venue: Venue; now: PragueNow | null }) {
  const hoursByDay = new Map(venue.openingHours.map((hours) => [hours.dayOfWeek, hours]));
  const opens = venue.openingHours.map((hours) => toMinutes(hours.openTime));
  const closes = venue.openingHours.map((hours) => toMinutes(hours.closeTime));
  const start = opens.length ? Math.max(0, Math.floor(Math.min(...opens) / 60) - 1) * 60 : 6 * 60;
  const end = closes.length ? Math.min(24, Math.ceil(Math.max(...closes) / 60) + 1) * 60 : 23 * 60;
  const span = end - start;
  const percent = (minutes: number) => `${((minutes - start) / span) * 100}%`;
  const ticks = Array.from({ length: 24 }, (_, hour) => hour * 60).filter((minutes) => minutes >= start && minutes <= end && (minutes / 60) % 3 === 0);

  return (
    <section id="oteviraci-doba" aria-labelledby="hours-title" className="scroll-mt-28">
      <h2 id="hours-title" className="text-sm font-semibold text-muted">Otevírací doba</h2>
      {venue.openingHours.length === 0 ? (
        <p className="mt-5 text-lg">Správce otevírací dobu zatím neuvedl.</p>
      ) : (
        <>
          <dl className="mt-5">
            {daysOfWeek.map((day) => {
              const hours = hoursByDay.get(day);
              const isToday = now?.day === day;
              return (
                <div key={day} className={`grid grid-cols-[5.5rem_minmax(0,1fr)_6.5rem] items-center gap-4 border-b border-line py-3 text-sm last:border-b-0 sm:grid-cols-[6.5rem_minmax(0,1fr)_7rem] ${isToday ? "font-semibold" : ""}`}>
                  <dt className={isToday ? "" : "text-muted"}>{dayNames[day]}</dt>
                  <div aria-hidden="true" className="relative h-1.5 rounded-full bg-line/70">
                    {hours && (
                      <span className={`absolute inset-y-0 rounded-full ${isToday ? "bg-brand-500" : "bg-foreground/30"}`} style={{ left: percent(toMinutes(hours.openTime)), right: `calc(100% - ${percent(toMinutes(hours.closeTime))})` }} />
                    )}
                    {isToday && now && now.minutes >= start && now.minutes <= end && (
                      <span className="absolute -top-1.5 h-4.5 w-0.5 -translate-x-1/2 rounded-full bg-foreground" style={{ left: percent(now.minutes) }} />
                    )}
                  </div>
                  <dd className={`text-right tabular-nums ${hours ? "" : "text-muted"}`}>{hours ? `${hours.openTime}–${hours.closeTime}` : "Zavřeno"}</dd>
                </div>
              );
            })}
          </dl>
          <div aria-hidden="true" className="grid grid-cols-[5.5rem_minmax(0,1fr)_6.5rem] gap-4 pt-1 sm:grid-cols-[6.5rem_minmax(0,1fr)_7rem]">
            <span />
            <div className="relative h-4 text-[11px] text-muted tabular-nums">
              {ticks.map((minutes) => (
                <span key={minutes} className="absolute -translate-x-1/2" style={{ left: percent(minutes) }}>{minutes / 60}</span>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
