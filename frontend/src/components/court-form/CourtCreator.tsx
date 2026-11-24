"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowClockwise,
  ArrowRight,
  CaretRight,
  Check,
  CheckCircle,
  CircleNotch,
  Copy,
  House,
  MapPin,
  Plus,
  Sun,
  WarningCircle,
} from "@phosphor-icons/react";
import { ErrorBanner, FieldError, inputClass, labelClass, TextField } from "@/components/form/fields";
import { ApiError } from "@/lib/api";
import { courtLimits, createCourt, nextCourtName, splitSports, suggestCourtName, surfacesForSports } from "@/lib/courts";
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

function sameText(a: string, b: string): boolean {
  return a.trim().toLocaleLowerCase("cs") === b.trim().toLocaleLowerCase("cs");
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
  const [nameTouched, setNameTouched] = useState(false);
  const [customSurface, setCustomSurface] = useState(false);
  const [copiedFrom, setCopiedFrom] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const errors = showErrors ? validate(values, courts) : {};
  const surfaces = surfacesForSports(values.sports);
  const surfaceIsSuggested = surfaces.some((surface) => sameText(surface, values.surface));
  const templates = courts.filter((court, index) => courts.findIndex((other) => other.sport === court.sport && other.surface === court.surface && other.indoor === court.indoor) === index).slice(0, 4);

  function update(patch: Partial<FormValues>) {
    setValues((current) => {
      const next = { ...current, ...patch };
      if (!nameTouched && patch.sports) next.name = suggestCourtName(next.sports, courts.map((court) => court.name));
      return next;
    });
    setSubmitError(null);
    setCopiedFrom(null);
  }

  function copyCourt(court: Court) {
    const sports = splitSports(court.sport);
    const surfaceKnown = surfacesForSports(sports).some((surface) => sameText(surface, court.surface));
    setValues((current) => ({
      sports,
      surface: court.surface,
      indoor: court.indoor,
      name: nameTouched ? current.name : suggestCourtName(sports, courts.map((item) => item.name)),
    }));
    setCustomSurface(!surfaceKnown);
    setCopiedFrom(court.id);
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
      setValues((current) => ({ ...current, name: suggestCourtName(current.sports, nextCourts.map((court) => court.name)) }));
      setNameTouched(false);
      setShowErrors(false);
      setAnnouncement(`${created.name} je přidaný. Další kurt má předvyplněné stejné údaje, stačí ho uložit.`);
    } catch (error) {
      setSubmitError(error instanceof ApiError ? error.message : "Kurt se nepodařilo uložit. Zkontrolujte připojení a zkuste to znovu.");
    } finally {
      setSubmitting(false);
    }
  }

  const preview: Court = {
    id: "preview",
    name: values.name.trim() || "Bez názvu",
    sport: values.sports.join(", "),
    surface: values.surface.trim(),
    indoor: values.indoor,
  };

  return (
    <>
      <h1 className="mt-4 font-display text-[clamp(2rem,4.5vw,3.25rem)] leading-[1.08] font-semibold tracking-[-.045em]">
        Přidat kurt
      </h1>
      <p className="mt-2 text-base text-muted md:text-lg">{venue.name}</p>

      <div className="mt-8 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)] lg:gap-14">
        <form ref={formRef} onSubmit={handleSubmit} noValidate aria-busy={submitting} className="min-w-0">
          <p role="status" className={announcement ? "mb-8 flex items-start gap-2.5 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-900 dark:bg-brand-900/40 dark:text-brand-100" : "sr-only"}>
            {announcement && <CheckCircle size={19} weight="fill" className="mt-px shrink-0 text-brand-500" aria-hidden="true" />}
            {announcement}
          </p>

          <fieldset disabled={submitting} className="grid min-w-0 gap-9">
            <legend className="sr-only">Údaje kurtu</legend>

            {templates.length > 0 && (
              <div>
                <p className={labelClass}>Stejný jako existující kurt</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {templates.map((court) => {
                    const active = copiedFrom === court.id;
                    return (
                      <button key={court.id} type="button" aria-pressed={active} onClick={() => copyCourt(court)} className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-3.5 text-left text-sm transition-colors active:scale-[.98] ${active ? "border-foreground bg-foreground text-page" : "border-line hover:border-muted"}`}>
                        <Copy size={15} aria-hidden="true" className={active ? "" : "text-muted"} />
                        <span className="font-medium">{court.name}</span>
                        <span className={active ? "text-page/60" : "text-muted"}>{court.surface.toLocaleLowerCase("cs")}, {court.indoor ? "krytý" : "venku"}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <SportPicker value={values.sports} error={errors.sports} maxLength={courtLimits.sport} onChange={(sports) => update({ sports })} />

            <fieldset aria-describedby={errors.surface ? "court-surface-error" : undefined}>
              <legend className={labelClass}>Povrch</legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {surfaces.map((surface) => {
                  const selected = !customSurface && sameText(values.surface, surface);
                  return (
                    <button key={surface} type="button" aria-pressed={selected} onClick={() => { setCustomSurface(false); update({ surface }); }} className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors ${selected ? "border-foreground bg-foreground text-page" : "border-line hover:bg-surface"} ${errors.surface ? "border-red-600" : ""}`}>
                      {selected && <Check size={14} weight="bold" aria-hidden="true" />}
                      {surface}
                    </button>
                  );
                })}
                <button type="button" aria-pressed={customSurface} onClick={() => { setCustomSurface(true); if (surfaceIsSuggested) update({ surface: "" }); requestAnimationFrame(() => document.getElementById("court-surface")?.focus()); }} className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors ${customSurface ? "border-foreground text-foreground" : "border-dashed border-line text-muted hover:border-foreground hover:text-foreground"}`}>
                  <Plus size={14} aria-hidden="true" /> Jiný povrch
                </button>
              </div>
              {customSurface && (
                <div className="mt-3 max-w-md">
                  <label htmlFor="court-surface" className="sr-only">Vlastní povrch</label>
                  <input
                    id="court-surface"
                    type="text"
                    className={inputClass}
                    placeholder="např. Tartan"
                    value={values.surface}
                    maxLength={courtLimits.surface}
                    aria-invalid={Boolean(errors.surface)}
                    aria-describedby={errors.surface ? "court-surface-error" : undefined}
                    onChange={(event) => update({ surface: event.target.value })}
                  />
                </div>
              )}
              <div className="mt-2"><FieldError id="court-surface-error">{errors.surface}</FieldError></div>
            </fieldset>

            <fieldset>
              <legend className={labelClass}>Prostředí</legend>
              <div className="mt-3 inline-grid grid-cols-2 rounded-full border border-line p-1">
                {[
                  { indoor: false, label: "Venku", Icon: Sun },
                  { indoor: true, label: "V hale", Icon: House },
                ].map(({ indoor, label, Icon }) => {
                  const checked = values.indoor === indoor;
                  return (
                    <label key={label} className={`flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-full px-5 text-sm font-medium transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-foreground ${checked ? "bg-foreground text-page" : "text-muted hover:text-foreground"}`}>
                      <input type="radio" name="court-indoor" className="sr-only" checked={checked} onChange={() => update({ indoor })} />
                      <Icon size={17} aria-hidden="true" />
                      {label}
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div className="max-w-md">
              <TextField
                id="court-name"
                label="Název kurtu"
                hint="Předvyplňujeme podle sportu. Přepište ho, pokud kurt na místě značíte jinak."
                value={values.name}
                maxLength={courtLimits.name}
                error={errors.name}
                onChange={(name) => {
                  setNameTouched(true);
                  setValues((current) => ({ ...current, name }));
                  setSubmitError(null);
                }}
              />
            </div>
          </fieldset>

          {submitError && (
            <div className="mt-8">
              <ErrorBanner title="Kurt se nepodařilo uložit">{submitError}</ErrorBanner>
            </div>
          )}

          <div className="sticky bottom-0 z-10 -mx-5 mt-10 flex flex-col-reverse gap-3 border-t border-line bg-page/90 px-5 py-4 backdrop-blur-md sm:mx-0 sm:flex-row sm:items-center sm:justify-between sm:px-0">
            <Link href={`/venues/${venue.id}`} className={addedIds.length > 0 ? "button button-outline gap-2" : "inline-flex min-h-12 items-center justify-center rounded-full px-2 text-sm font-semibold text-muted hover:text-foreground"}>
              {addedIds.length > 0 ? <>Hotovo <ArrowRight size={17} aria-hidden="true" /></> : "Zrušit"}
            </Link>
            <button type="submit" disabled={submitting} className="button button-primary gap-2 disabled:cursor-wait disabled:opacity-70">
              {submitting ? <><CircleNotch size={18} className="animate-spin" aria-hidden="true" /><span role="status">Ukládáme kurt…</span></> : <><Plus size={18} aria-hidden="true" /> {addedIds.length > 0 ? "Přidat další kurt" : "Přidat kurt"}</>}
            </button>
          </div>
        </form>

        <aside className="lg:sticky lg:top-28" aria-labelledby="existing-courts-title">
          <h2 id="existing-courts-title" className="flex items-baseline justify-between gap-2 text-sm font-semibold text-foreground">
            Kurty ve sportovišti <span className="font-normal text-muted tabular-nums">{courts.length} + nový</span>
          </h2>
          <ul className="mt-3 overflow-hidden rounded-2xl border border-line">
            {courts.map((court) => (
              <CourtLine key={court.id} court={court} badge={addedIds.includes(court.id) ? "Přidáno" : undefined} />
            ))}
            <CourtLine court={preview} preview />
          </ul>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            {courts.length === 0
              ? "Hráči sportoviště ve vyhledávání uvidí, jakmile přidáte první kurt."
              : "Poslední řádek je náhled kurtu, který právě přidáváte."}
          </p>
        </aside>
      </div>
    </>
  );
}

function CourtLine({ court, badge, preview = false }: { court: Court; badge?: string; preview?: boolean }) {
  const sports = splitSports(court.sport).map(capitalize);
  return (
    <li className={`flex items-start justify-between gap-3 border-line px-4 py-3 not-last:border-b ${preview ? "bg-ball/15 dark:bg-ball/10" : ""}`}>
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <span className="truncate">{court.name}</span>
          {badge && <span className="rounded-md bg-ball px-1.5 py-0.5 text-[11px] font-semibold text-brand-900">{badge}</span>}
          {preview && <span className="rounded-md border border-brand-500/50 px-1.5 py-0.5 text-[11px] font-semibold text-brand-700 dark:text-brand-100">Nový</span>}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted">
          {sports.length > 0 ? sports.join(", ") : preview ? "Vyberte sport" : ""}
          {court.surface ? `, ${court.surface.toLocaleLowerCase("cs")}` : preview ? ", povrch" : ""}
        </p>
      </div>
      <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-xs text-muted">
        {court.indoor ? <House size={13} aria-hidden="true" /> : <Sun size={13} aria-hidden="true" />}
        {court.indoor ? "V hale" : "Venku"}
      </span>
    </li>
  );
}
