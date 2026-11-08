"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowClockwise,
  ArrowRight,
  CaretRight,
  CheckCircle,
  CircleNotch,
  House,
  MapPin,
  Plus,
  Sun,
  WarningCircle,
} from "@phosphor-icons/react";
import { ErrorBanner, FieldError, inputClass, labelClass, TextField } from "@/components/form/fields";
import { ApiError } from "@/lib/api";
import { courtLimits, createCourt, nextCourtName, splitSports, surfacesForSports } from "@/lib/courts";
import { capitalize } from "@/lib/venueVisuals";
import { getVenue, type Court, type VenueDetail } from "@/lib/venues";
import { SportPicker } from "./SportPicker";

type FormValues = { name: string; sports: string[]; surface: string; indoor: boolean };
type FormErrors = Partial<Record<"name" | "sports" | "surface", string>>;
type LoadState =
  | { status: "loading" }
  | { status: "notFound" }
  | { status: "error"; message: string }
  | { status: "done"; venue: VenueDetail };

function validate(values: FormValues, existing: Court[]): FormErrors {
  const errors: FormErrors = {};
  const name = values.name.trim();
  if (!name) errors.name = "Vyplňte název kurtu.";
  else if (name.length > courtLimits.name) errors.name = `Maximálně ${courtLimits.name} znaků.`;
  else if (existing.some((court) => court.name.trim().toLocaleLowerCase("cs") === name.toLocaleLowerCase("cs"))) {
    errors.name = "Kurt s tímto názvem už ve sportovišti máte.";
  }
  const sport = values.sports.join(", ");
  if (values.sports.length === 0) errors.sports = "Vyberte alespoň jeden sport.";
  else if (sport.length > courtLimits.sport) errors.sports = `Sporty se nevejdou do ${courtLimits.sport} znaků. Vyberte jich méně.`;
  const surface = values.surface.trim();
  if (!surface) errors.surface = "Vyplňte povrch kurtu.";
  else if (surface.length > courtLimits.surface) errors.surface = `Maximálně ${courtLimits.surface} znaků.`;
  return errors;
}

export function CourtCreator({ venueId }: { venueId: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setState({ status: "loading" });
    getVenue(venueId)
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
          message: error instanceof ApiError ? error.message : "Server teď neodpovídá. Pokud byl delší dobu nečinný, probouzí se. Zkuste to za chvíli znovu.",
        });
      });
    return () => {
      active = false;
    };
  }, [venueId, attempt]);

  return (
    <main id="main-content" className="section-wrap pt-7 pb-16 md:pt-10 md:pb-24">
      <nav aria-label="Drobečková navigace">
        <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
          <li>
            <Link href="/venues" className="inline-flex min-h-11 items-center font-medium hover:text-foreground hover:underline">Sportoviště</Link>
          </li>
          <li aria-hidden="true"><CaretRight size={12} /></li>
          <li className="max-w-[45vw] truncate">
            <Link href={`/venues/${venueId}`} className="inline-flex min-h-11 items-center font-medium hover:text-foreground hover:underline">
              {state.status === "done" ? state.venue.name : "Detail"}
            </Link>
          </li>
          <li aria-hidden="true"><CaretRight size={12} /></li>
          <li aria-current="page" className="font-medium text-foreground">Nový kurt</li>
        </ol>
      </nav>

      {state.status === "loading" && (
        <div aria-hidden="true" className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="h-[32rem] animate-pulse rounded-3xl bg-surface" />
          <div className="h-64 animate-pulse rounded-3xl bg-surface" />
        </div>
      )}

      {state.status === "notFound" && (
        <div className="mt-8 flex flex-col items-center rounded-2xl border border-dashed border-line px-6 py-16 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-surface text-muted"><MapPin size={26} aria-hidden="true" /></span>
          <h1 className="mt-5 font-display text-2xl font-semibold">Sportoviště nenalezeno</h1>
          <p className="mt-2 max-w-md text-muted">Kurt nejde přidat, protože odkaz je neplatný nebo sportoviště už neexistuje.</p>
          <Link href="/venues" className="button button-dark mt-6">Prohlédnout sportoviště</Link>
        </div>
      )}

      {state.status === "error" && (
        <div role="alert" className="mt-8 flex flex-col items-start gap-4 rounded-2xl border border-line bg-surface/60 p-6 sm:flex-row sm:items-center">
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

      {state.status === "done" && <CourtForm venue={state.venue} />}
    </main>
  );
}

function CourtForm({ venue }: { venue: VenueDetail }) {
  const [courts, setCourts] = useState<Court[]>(venue.courts);
  const [addedIds, setAddedIds] = useState<string[]>([]);
  const [values, setValues] = useState<FormValues>(() => ({
    name: nextCourtName(venue.courts.map((court) => court.name)),
    sports: [],
    surface: "",
    indoor: false,
  }));
  const [showErrors, setShowErrors] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLDivElement>(null);
  const errors = showErrors ? validate(values, courts) : {};
  const surfaces = surfacesForSports(values.sports);

  function update(patch: Partial<FormValues>) {
    setValues((current) => ({ ...current, ...patch }));
    setSubmitError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const nextErrors = validate(values, courts);
    setShowErrors(true);
    setSubmitError(null);
    if (Object.keys(nextErrors).length > 0) {
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"], fieldset[aria-describedby*="error"] button')?.focus());
      return;
    }
    setSubmitting(true);
    try {
      const created = await createCourt({
        venueId: venue.id,
        name: values.name.trim(),
        sport: values.sports.join(", "),
        surface: values.surface.trim(),
        indoor: values.indoor,
      });
      const nextCourts = [...courts, created];
      setCourts(nextCourts);
      setAddedIds((ids) => [...ids, created.id]);
      setValues((current) => ({ ...current, name: nextCourtName(nextCourts.map((court) => court.name)) }));
      setShowErrors(false);
      setAnnouncement(`Přidáno: ${created.name}. Můžete rovnou přidat další.`);
      requestAnimationFrame(() => nameRef.current?.querySelector("input")?.focus());
    } catch (error) {
      setSubmitError(error instanceof ApiError ? error.message : "Kurt se nepodařilo uložit. Zkontrolujte připojení a zkuste to znovu.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <h1 className="mt-4 font-display text-[clamp(2rem,4.5vw,3.25rem)] leading-[1.08] font-semibold tracking-[-.045em]">
        Přidat kurt
      </h1>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted md:text-lg">
        Kurt nebo hřiště ve sportovišti <span className="font-medium text-foreground">{venue.name}</span>. Po uložení můžete rovnou přidat další.
      </p>

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-12">
        <form ref={formRef} onSubmit={handleSubmit} noValidate aria-busy={submitting} className="min-w-0">
          <p role="status" className={announcement ? "mb-6 flex items-center gap-2 rounded-xl bg-brand-50 px-4 py-3 text-sm font-medium text-brand-900 dark:bg-brand-900/40 dark:text-brand-100" : "sr-only"}>
            {announcement && <CheckCircle size={19} weight="fill" className="shrink-0 text-brand-500" aria-hidden="true" />}
            {announcement}
          </p>

          <fieldset disabled={submitting} className="grid min-w-0 gap-8">
            <legend className="sr-only">Údaje kurtu</legend>
            <div ref={nameRef} className="max-w-md">
              <TextField
                id="court-name"
                label="Název kurtu"
                hint="Jak kurt označujete na místě, např. Kurt 1 nebo Centrkurt."
                value={values.name}
                maxLength={courtLimits.name}
                error={errors.name}
                onChange={(name) => update({ name })}
              />
            </div>

            <SportPicker value={values.sports} error={errors.sports} maxLength={courtLimits.sport} onChange={(sports) => update({ sports })} />

            <div className="grid gap-2">
              <label htmlFor="court-surface" className={labelClass}>Povrch</label>
              <div className="flex flex-wrap gap-2" aria-label="Časté povrchy">
                {surfaces.map((surface) => {
                  const selected = values.surface.trim().toLocaleLowerCase("cs") === surface.toLocaleLowerCase("cs");
                  return (
                    <button key={surface} type="button" aria-pressed={selected} onClick={() => update({ surface })} className={`min-h-11 rounded-full border px-4 text-sm font-medium transition-colors ${selected ? "border-foreground bg-foreground text-page" : "border-line hover:bg-surface"}`}>
                      {surface}
                    </button>
                  );
                })}
              </div>
              <input
                id="court-surface"
                type="text"
                className={`${inputClass} max-w-md`}
                placeholder="Nebo napište vlastní povrch"
                value={values.surface}
                maxLength={courtLimits.surface}
                aria-invalid={Boolean(errors.surface)}
                aria-describedby={errors.surface ? "court-surface-error" : undefined}
                onChange={(event) => update({ surface: event.target.value })}
              />
              <FieldError id="court-surface-error">{errors.surface}</FieldError>
            </div>

            <fieldset>
              <legend className="text-sm font-semibold text-foreground">Umístění</legend>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {[
                  { indoor: false, label: "Venkovní", hint: "Pod širým nebem, závisí na počasí", Icon: Sun },
                  { indoor: true, label: "Krytý", hint: "V hale nebo v nafukovací hale", Icon: House },
                ].map(({ indoor, label, hint, Icon }) => {
                  const checked = values.indoor === indoor;
                  return (
                    <label key={label} className={`flex min-h-20 cursor-pointer items-center gap-4 rounded-2xl border-2 p-4 transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-foreground ${checked ? "border-brand-500 bg-brand-50/60 dark:bg-brand-900/25" : "border-line hover:bg-surface/60"}`}>
                      <input type="radio" name="court-indoor" className="sr-only" checked={checked} onChange={() => update({ indoor })} />
                      <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${checked ? "bg-brand-500 text-white" : "bg-surface text-foreground"}`}>
                        <Icon size={22} aria-hidden="true" />
                      </span>
                      <span>
                        <span className="block font-semibold text-foreground">{label}</span>
                        <span className="block text-sm text-muted">{hint}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </fieldset>

          {submitError && (
            <div className="mt-6">
              <ErrorBanner title="Kurt se nepodařilo uložit">{submitError}</ErrorBanner>
            </div>
          )}

          <div className="mt-10 flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
            <Link href={`/venues/${venue.id}`} className={addedIds.length > 0 ? "button button-outline gap-2" : "inline-flex min-h-12 items-center justify-center rounded-full px-2 text-sm font-semibold text-muted hover:text-foreground"}>
              {addedIds.length > 0 ? <>Hotovo, zobrazit sportoviště <ArrowRight size={17} aria-hidden="true" /></> : "Zrušit"}
            </Link>
            <button type="submit" disabled={submitting} className="button button-primary gap-2 disabled:cursor-wait disabled:opacity-70">
              {submitting ? <><CircleNotch size={18} className="animate-spin" aria-hidden="true" /><span role="status">Ukládáme kurt…</span></> : <><Plus size={18} aria-hidden="true" /> {addedIds.length > 0 ? "Přidat další kurt" : "Přidat kurt"}</>}
            </button>
          </div>
        </form>

        <aside className="border-t border-line pt-6 lg:sticky lg:top-28 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8" aria-labelledby="existing-courts-title">
          <h2 id="existing-courts-title" className="flex items-baseline justify-between gap-2 font-display text-lg font-semibold">
            Kurty ve sportovišti <span className="text-sm font-normal text-muted tabular-nums">{courts.length}</span>
          </h2>
          {courts.length === 0 ? (
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Zatím žádný. Hráči sportoviště ve vyhledávání uvidí, jakmile přidáte první kurt.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {courts.map((court) => {
                const isNew = addedIds.includes(court.id);
                return (
                  <li key={court.id} className="flex items-start justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 truncate text-sm font-semibold text-foreground">
                        {court.name}
                        {isNew && <span className="rounded-full bg-ball px-2 py-0.5 text-[11px] font-semibold text-brand-900">Nový</span>}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted">
                        {splitSports(court.sport).map(capitalize).join(", ")}, {court.surface.toLocaleLowerCase("cs")}
                      </p>
                    </div>
                    <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-xs text-muted">
                      {court.indoor ? <House size={13} aria-hidden="true" /> : <Sun size={13} aria-hidden="true" />}
                      {court.indoor ? "Krytý" : "Venkovní"}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>
      </div>
    </>
  );
}
