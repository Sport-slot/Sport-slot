"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowClockwise, CaretRight, CheckCircle, CircleNotch, CurrencyCircleDollar, MapPin, Plus, WarningCircle } from "@phosphor-icons/react";
import { ErrorBanner, FieldError, inputClass, labelClass } from "@/components/form/fields";
import { ApiError, type DayOfWeek } from "@/lib/api";
import {
  createPriceRule,
  findOverlap,
  formatPrice,
  listPriceRules,
  parsePrice,
  rulesByDay,
  validatePriceRule,
  type PriceRule,
  type PriceRuleFormValues,
} from "@/lib/priceRules";
import { dayNames, daysOfWeek } from "@/lib/venueForm";
import { getVenue, type Court, type VenueDetail } from "@/lib/venues";

type LoadState =
  | { status: "loading" }
  | { status: "notFound" }
  | { status: "notOwner" }
  | { status: "error"; message: string }
  | { status: "done"; venue: VenueDetail; court: Court; rules: PriceRule[] };

const shortDayNames: Record<DayOfWeek, string> = { 1: "Po", 2: "Út", 3: "St", 4: "Čt", 5: "Pá", 6: "So", 7: "Ne" };
const weekdays: DayOfWeek[] = [1, 2, 3, 4, 5];
const weekend: DayOfWeek[] = [6, 7];

function sameDays(a: DayOfWeek[], b: DayOfWeek[]): boolean {
  return a.length === b.length && b.every((day) => a.includes(day));
}

function defaultHours(venue: VenueDetail): Pick<PriceRuleFormValues, "startTime" | "endTime"> {
  if (venue.openingHours.length === 0) return { startTime: "08:00", endTime: "22:00" };
  return {
    startTime: venue.openingHours.map((hours) => hours.openTime).sort()[0],
    endTime: venue.openingHours.map((hours) => hours.closeTime).sort().at(-1) ?? "22:00",
  };
}

export function CourtPricing({ venueId, courtId }: { venueId: string; courtId: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setState({ status: "loading" });
    Promise.all([getVenue(venueId), listPriceRules(courtId)])
      .then(([venue, rules]) => {
        if (!active) return;
        const court = venue.courts.find((item) => item.id === courtId);
        if (!court) setState({ status: "notFound" });
        else if (!venue.isOwner) setState({ status: "notOwner" });
        else setState({ status: "done", venue, court, rules });
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
  }, [venueId, courtId, attempt]);

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
          <li aria-current="page" className="font-medium text-foreground">Ceník kurtu</li>
        </ol>
      </nav>

      {state.status === "loading" && (
        <div aria-hidden="true" className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="h-[28rem] animate-pulse rounded-3xl bg-surface" />
          <div className="h-80 animate-pulse rounded-3xl bg-surface" />
        </div>
      )}

      {(state.status === "notFound" || state.status === "notOwner") && (
        <div className="mt-8 flex flex-col items-center rounded-2xl border border-dashed border-line px-6 py-16 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-surface text-muted"><MapPin size={26} aria-hidden="true" /></span>
          <h1 className="mt-5 font-display text-2xl font-semibold">{state.status === "notFound" ? "Kurt nenalezen" : "Ceník nemůžete upravit"}</h1>
          <p className="mt-2 max-w-md text-muted">
            {state.status === "notFound"
              ? "Odkaz je neplatný nebo kurt už ve sportovišti není."
              : "Ceník kurtu může nastavit jen správce, kterému sportoviště patří."}
          </p>
          <Link href={`/venues/${venueId}`} className="button button-dark mt-6">Zpět na sportoviště</Link>
        </div>
      )}

      {state.status === "error" && (
        <div role="alert" className="mt-8 flex flex-col items-start gap-4 rounded-2xl border border-line bg-surface/60 p-6 sm:flex-row sm:items-center">
          <WarningCircle size={28} aria-hidden="true" className="shrink-0 text-red-700 dark:text-red-400" />
          <div className="flex-1">
            <p className="font-semibold">Ceník se nepodařilo načíst</p>
            <p className="mt-1 text-sm text-muted">{state.message}</p>
          </div>
          <button type="button" onClick={() => setAttempt(attempt + 1)} className="button button-outline gap-2">
            Zkusit znovu <ArrowClockwise size={18} aria-hidden="true" />
          </button>
        </div>
      )}

      {state.status === "done" && <PricingEditor venue={state.venue} court={state.court} initialRules={state.rules} />}
    </main>
  );
}

function PricingEditor({ venue, court, initialRules }: { venue: VenueDetail; court: Court; initialRules: PriceRule[] }) {
  const [rules, setRules] = useState<PriceRule[]>(initialRules);
  const [values, setValues] = useState<PriceRuleFormValues>(() => ({ days: [...weekdays], ...defaultHours(venue), price: "" }));
  const [showErrors, setShowErrors] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [addedIds, setAddedIds] = useState<string[]>([]);
  const formRef = useRef<HTMLFormElement>(null);
  const errors = showErrors ? validatePriceRule(values) : {};
  const overlaps = errors.time ? [] : values.days.flatMap((day) => {
    const rule = findOverlap(rules, day, values.startTime, values.endTime);
    return rule ? [rule] : [];
  });

  function update(patch: Partial<PriceRuleFormValues>) {
    setValues((current) => ({ ...current, ...patch }));
    setSubmitError(null);
  }

  function toggleDay(day: DayOfWeek) {
    update({ days: values.days.includes(day) ? values.days.filter((item) => item !== day) : [...values.days, day].sort() });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const nextErrors = validatePriceRule(values);
    setShowErrors(true);
    setSubmitError(null);
    setAnnouncement("");
    if (Object.keys(nextErrors).length > 0) {
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    if (overlaps.length > 0) return;
    const pricePerHour = parsePrice(values.price) ?? 0;
    setSubmitting(true);
    const created: PriceRule[] = [];
    try {
      for (const dayOfWeek of values.days) {
        created.push(await createPriceRule({ courtId: court.id, dayOfWeek, startTime: values.startTime, endTime: values.endTime, pricePerHour }));
      }
      setShowErrors(false);
      setAnnouncement(`Uloženo: ${values.days.map((day) => shortDayNames[day]).join(", ")} ${values.startTime}–${values.endTime} za ${formatPrice(pricePerHour)} / hod.`);
      update({ price: "" });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Pravidlo se nepodařilo uložit. Zkontrolujte připojení a zkuste to znovu.";
      const savedDays = created.map((rule) => shortDayNames[rule.dayOfWeek]).join(", ");
      setSubmitError(savedDays ? `${message} Pro ${savedDays} se pravidlo uložilo, ostatní dny zůstaly beze změny.` : message);
      if (created.length > 0) update({ days: values.days.filter((day) => !created.some((rule) => rule.dayOfWeek === day)) });
    } finally {
      if (created.length > 0) {
        setRules((current) => [...current, ...created]);
        setAddedIds((ids) => [...ids, ...created.map((rule) => rule.id)]);
      }
      setSubmitting(false);
    }
  }

  return (
    <>
      <h1 className="mt-4 font-display text-[clamp(2rem,4.5vw,3.25rem)] leading-[1.08] font-semibold tracking-[-.045em]">
        Ceník: {court.name}
      </h1>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted md:text-lg">
        Nastavte cenu za hodinu pro jednotlivé dny a časy. Rezervace se počítá podle ceníku platného v době rezervace, takže změna nemění cenu už vytvořených rezervací.
      </p>

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-12">
        <form ref={formRef} onSubmit={handleSubmit} noValidate aria-busy={submitting} className="min-w-0">
          <p role="status" className={announcement ? "mb-6 flex items-center gap-2 rounded-xl bg-brand-50 px-4 py-3 text-sm font-medium text-brand-900 dark:bg-brand-900/40 dark:text-brand-100" : "sr-only"}>
            {announcement && <CheckCircle size={19} weight="fill" className="shrink-0 text-brand-500" aria-hidden="true" />}
            {announcement}
          </p>

          <fieldset disabled={submitting} className="grid min-w-0 gap-8">
            <legend className="sr-only">Nové cenové pravidlo</legend>

            <fieldset aria-describedby={errors.days ? "price-days-error" : undefined}>
              <legend className={labelClass}>Dny</legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {[{ label: "Pracovní dny", days: weekdays }, { label: "Víkend", days: weekend }, { label: "Celý týden", days: daysOfWeek }].map((preset) => (
                  <button key={preset.label} type="button" aria-pressed={sameDays(values.days, preset.days)} onClick={() => update({ days: [...preset.days] })} className={`min-h-11 rounded-full border px-4 text-sm font-medium transition-colors ${sameDays(values.days, preset.days) ? "border-foreground bg-foreground text-page" : "border-line hover:bg-surface"}`}>
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-7 gap-1.5 sm:max-w-md">
                {daysOfWeek.map((day) => {
                  const checked = values.days.includes(day);
                  return (
                    <label key={day} className={`flex min-h-11 cursor-pointer items-center justify-center rounded-xl border-2 text-sm font-semibold transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-foreground ${checked ? "border-brand-500 bg-brand-50/60 dark:bg-brand-900/25" : "border-line text-muted hover:bg-surface/60"}`}>
                      <input type="checkbox" className="sr-only" checked={checked} onChange={() => toggleDay(day)} aria-label={dayNames[day]} />
                      <span aria-hidden="true">{shortDayNames[day]}</span>
                    </label>
                  );
                })}
              </div>
              <div className="mt-2"><FieldError id="price-days-error">{errors.days}</FieldError></div>
            </fieldset>

            <div className="grid gap-2">
              <div className="grid max-w-md grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <label htmlFor="price-start" className={labelClass}>Od</label>
                  <input id="price-start" type="time" step={900} className={inputClass} value={values.startTime} aria-invalid={Boolean(errors.time) || overlaps.length > 0} aria-describedby="price-time-error" onChange={(event) => update({ startTime: event.target.value })} />
                </div>
                <div className="grid gap-2">
                  <label htmlFor="price-end" className={labelClass}>Do</label>
                  <input id="price-end" type="time" step={900} className={inputClass} value={values.endTime} aria-invalid={Boolean(errors.time) || overlaps.length > 0} aria-describedby="price-time-error" onChange={(event) => update({ endTime: event.target.value })} />
                </div>
              </div>
              <FieldError id="price-time-error">
                {errors.time ?? (overlaps.length > 0
                  ? `Překrývá se s pravidlem ${overlaps.map((rule) => `${shortDayNames[rule.dayOfWeek]} ${rule.startTime}–${rule.endTime}`).join(", ")}. Navazující časy (např. do 16:00 a od 16:00) jsou v pořádku.`
                  : undefined)}
              </FieldError>
            </div>

            <div className="grid max-w-xs gap-2">
              <label htmlFor="price-amount" className={labelClass}>Cena za hodinu</label>
              <div className="relative">
                <input id="price-amount" type="text" inputMode="decimal" autoComplete="off" placeholder="např. 400" className={`${inputClass} pr-12`} value={values.price} aria-invalid={Boolean(errors.price)} aria-describedby={errors.price ? "price-amount-error" : undefined} onChange={(event) => update({ price: event.target.value })} />
                <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-muted">Kč</span>
              </div>
              <FieldError id="price-amount-error">{errors.price}</FieldError>
            </div>
          </fieldset>

          {submitError && (
            <div className="mt-6">
              <ErrorBanner title="Pravidlo se nepodařilo uložit">{submitError}</ErrorBanner>
            </div>
          )}

          <div className="mt-10 flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
            <Link href={`/venues/${venue.id}`} className="inline-flex min-h-12 items-center justify-center rounded-full px-2 text-sm font-semibold text-muted hover:text-foreground">
              Zpět na sportoviště
            </Link>
            <button type="submit" disabled={submitting} className="button button-primary gap-2 disabled:cursor-wait disabled:opacity-70">
              {submitting ? <><CircleNotch size={18} className="animate-spin" aria-hidden="true" /><span role="status">Ukládáme…</span></> : <><Plus size={18} aria-hidden="true" /> Přidat do ceníku</>}
            </button>
          </div>
        </form>

        <aside className="border-t border-line pt-6 lg:sticky lg:top-28 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8" aria-labelledby="price-list-title">
          <h2 id="price-list-title" className="font-display text-lg font-semibold">Aktuální ceník</h2>
          {rules.length === 0 ? (
            <div className="mt-3 flex items-start gap-3 text-sm leading-relaxed text-muted">
              <CurrencyCircleDollar size={22} className="shrink-0" aria-hidden="true" />
              <p>Zatím žádná pravidla. Hráč si může rezervovat jen čas, pro který je v ceníku nastavená cena.</p>
            </div>
          ) : (
            <dl className="mt-3 divide-y divide-line">
              {rulesByDay(rules).map(({ dayOfWeek, rules: dayRules }) => (
                <div key={dayOfWeek} className="grid grid-cols-[6rem_minmax(0,1fr)] gap-3 py-3 text-sm">
                  <dt className="font-semibold text-foreground">{dayNames[dayOfWeek]}</dt>
                  <dd>
                    {dayRules.length === 0 ? (
                      <span className="text-muted">Bez ceny, nelze rezervovat</span>
                    ) : (
                      <ul className="grid gap-1">
                        {dayRules.map((rule) => (
                          <li key={rule.id} className="flex justify-between gap-3 tabular-nums">
                            <span className="flex items-center gap-2">
                              {rule.startTime}–{rule.endTime}
                              {addedIds.includes(rule.id) && <span className="rounded-full bg-ball px-2 py-0.5 text-[11px] font-semibold text-brand-900">Nové</span>}
                            </span>
                            <span className="font-medium text-foreground">{formatPrice(rule.pricePerHour)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </aside>
      </div>
    </>
  );
}
