"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowClockwise, ArrowLeft, CaretRight, CheckCircle, CircleNotch, MapPin, Plus, WarningCircle } from "@phosphor-icons/react";
import { ErrorBanner, FieldError, inputClass, labelClass } from "@/components/form/fields";
import { ApiError, type DayOfWeek } from "@/lib/api";
import {
  createPriceRule,
  findOverlap,
  formatPrice,
  listPriceRules,
  parsePrice,
  priceGaps,
  sortPriceRules,
  toMinutes,
  validatePriceRule,
  type PriceRule,
  type PriceRuleFormValues,
} from "@/lib/priceRules";
import { dayNames, daysOfWeek } from "@/lib/venueForm";
import { getVenue, type Court, type VenueDetail } from "@/lib/venues";
import { hourRange } from "@/lib/courts";

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

function firstGap(venue: VenueDetail, rules: PriceRule[]): { day: DayOfWeek; startTime: string; endTime: string } | null {
  for (const hours of [...venue.openingHours].sort((a, b) => a.dayOfWeek - b.dayOfWeek)) {
    const gap = priceGaps(hours.openTime, hours.closeTime, rules.filter((rule) => rule.dayOfWeek === hours.dayOfWeek))[0];
    if (gap) return { day: hours.dayOfWeek, ...gap };
  }
  return null;
}

function initialValues(venue: VenueDetail, rules: PriceRule[]): PriceRuleFormValues {
  if (rules.length === 0) return { days: [...weekdays], ...defaultHours(venue), price: "" };
  const gap = firstGap(venue, rules);
  return gap ? { days: [gap.day], startTime: gap.startTime, endTime: gap.endTime, price: "" } : { days: [], ...defaultHours(venue), price: "" };
}

function PricingEditor({ venue, court, initialRules }: { venue: VenueDetail; court: Court; initialRules: PriceRule[] }) {
  const [rules, setRules] = useState<PriceRule[]>(initialRules);
  const [values, setValues] = useState<PriceRuleFormValues>(() => initialValues(venue, initialRules));
  const [touched, setTouched] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [addedIds, setAddedIds] = useState<string[]>([]);
  const formRef = useRef<HTMLFormElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);
  const errors = showErrors ? validatePriceRule(values) : {};
  const timeValid = !validatePriceRule({ ...values, days: [1], price: "0" }).time;
  const overlaps = (touched || showErrors) && timeValid ? values.days.flatMap((day) => {
    const rule = findOverlap(rules, day, values.startTime, values.endTime);
    return rule ? [rule] : [];
  }) : [];
  const gapCount = venue.openingHours.reduce((count, hours) => count + priceGaps(hours.openTime, hours.closeTime, rules.filter((rule) => rule.dayOfWeek === hours.dayOfWeek)).length, 0);

  function update(patch: Partial<PriceRuleFormValues>) {
    setValues((current) => ({ ...current, ...patch }));
    setTouched(true);
    setSubmitError(null);
  }

  function toggleDay(day: DayOfWeek) {
    update({ days: values.days.includes(day) ? values.days.filter((item) => item !== day) : [...values.days, day].sort() });
  }

  function pickGap(day: DayOfWeek, startTime: string, endTime: string) {
    update({ days: [day], startTime, endTime });
    setAnnouncement("");
    requestAnimationFrame(() => {
      priceRef.current?.focus({ preventScroll: true });
      formRef.current?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
    });
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
    const blocking = values.days.some((day) => findOverlap(rules, day, values.startTime, values.endTime));
    if (blocking) return;
    const pricePerHour = parsePrice(values.price) ?? 0;
    setSubmitting(true);
    const created: PriceRule[] = [];
    try {
      for (const dayOfWeek of values.days) {
        created.push(await createPriceRule({ courtId: court.id, dayOfWeek, startTime: values.startTime, endTime: values.endTime, pricePerHour }));
      }
      const nextRules = [...rules, ...created];
      setShowErrors(false);
      setTouched(false);
      setAnnouncement(`Uloženo: ${values.days.map((day) => shortDayNames[day]).join(", ")} ${values.startTime}–${values.endTime} za ${formatPrice(pricePerHour)} / hod.`);
      const gap = firstGap(venue, nextRules);
      setValues(gap ? { days: [gap.day], startTime: gap.startTime, endTime: gap.endTime, price: values.price } : { ...values, days: [] });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Pravidlo se nepodařilo uložit. Zkontrolujte připojení a zkuste to znovu.";
      const savedDays = created.map((rule) => shortDayNames[rule.dayOfWeek]).join(", ");
      setSubmitError(savedDays ? `${message} Pro ${savedDays} se pravidlo uložilo, ostatní dny zůstaly beze změny.` : message);
      if (created.length > 0) setValues((current) => ({ ...current, days: current.days.filter((day) => !created.some((rule) => rule.dayOfWeek === day)) }));
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
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[clamp(2rem,4.5vw,3.25rem)] leading-[1.08] font-semibold tracking-[-.045em]">Ceník kurtu</h1>
          <p className="mt-2 text-base text-muted md:text-lg">{venue.name}</p>
        </div>
        <p className="text-sm text-muted">
          {rules.length === 0 ? "Zatím bez ceníku" : gapCount === 0 ? "Celá otevírací doba má cenu" : `${gapCount} ${gapCount === 1 ? "úsek" : gapCount <= 4 ? "úseky" : "úseků"} bez ceny`}
        </p>
      </div>

      {venue.courts.length > 1 && (
        <nav aria-label="Kurty sportoviště" className="-mx-5 mt-6 flex gap-2 overflow-x-auto px-5 pb-1 md:mx-0 md:flex-wrap md:px-0">
          {venue.courts.map((item) => {
            const current = item.id === court.id;
            return (
              <Link key={item.id} href={`/venues/${venue.id}/courts/${item.id}/prices`} aria-current={current ? "page" : undefined} className={`inline-flex min-h-10 shrink-0 items-center rounded-full border px-4 text-sm font-medium whitespace-nowrap transition-colors ${current ? "border-foreground bg-foreground text-page" : "border-line hover:border-muted"}`}>
                {item.name}
              </Link>
            );
          })}
        </nav>
      )}

      <div className="mt-8 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-12">
        <section aria-labelledby="price-calendar-title" className="min-w-0">
          <h2 id="price-calendar-title" className="sr-only">Týdenní ceník {court.name}</h2>
          <PriceCalendar venue={venue} rules={rules} addedIds={addedIds} selected={values} onPickGap={pickGap} />
        </section>

        <aside className="lg:sticky lg:top-28">
          <form ref={formRef} onSubmit={handleSubmit} noValidate aria-busy={submitting} aria-labelledby="price-form-title" className="scroll-mt-28 rounded-2xl border border-line bg-surface/40 p-5">
            <h2 id="price-form-title" className="font-display text-lg font-semibold">Přidat cenu</h2>
            <p className="mt-1 text-sm text-muted">Nebo klikněte v kalendáři na úsek bez ceny.</p>

            <p role="status" className={announcement ? "mt-4 flex items-start gap-2 rounded-xl bg-brand-50 px-3 py-2.5 text-sm text-brand-900 dark:bg-brand-900/40 dark:text-brand-100" : "sr-only"}>
              {announcement && <CheckCircle size={18} weight="fill" className="mt-px shrink-0 text-brand-500" aria-hidden="true" />}
              {announcement}
            </p>

            <fieldset disabled={submitting} className="mt-5 grid min-w-0 gap-6">
              <legend className="sr-only">Nové cenové pravidlo</legend>

              <fieldset aria-describedby={errors.days ? "price-days-error" : undefined}>
                <legend className={labelClass}>Dny</legend>
                <div className="mt-2.5 grid grid-cols-7 gap-1">
                  {daysOfWeek.map((day) => {
                    const checked = values.days.includes(day);
                    return (
                      <label key={day} className={`flex min-h-10 cursor-pointer items-center justify-center rounded-lg border text-sm font-semibold transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-foreground ${checked ? "border-foreground bg-foreground text-page" : "border-line text-muted hover:border-muted hover:text-foreground"}`}>
                        <input type="checkbox" className="sr-only" checked={checked} onChange={() => toggleDay(day)} aria-label={dayNames[day]} />
                        <span aria-hidden="true">{shortDayNames[day]}</span>
                      </label>
                    );
                  })}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-3 text-sm">
                  {[{ label: "Pracovní dny", days: weekdays }, { label: "Víkend", days: weekend }, { label: "Celý týden", days: daysOfWeek }].map((preset) => (
                    <button key={preset.label} type="button" aria-pressed={sameDays(values.days, preset.days)} onClick={() => update({ days: [...preset.days] })} className={`inline-flex min-h-9 items-center underline-offset-4 hover:underline ${sameDays(values.days, preset.days) ? "font-semibold text-foreground" : "text-muted"}`}>
                      {preset.label}
                    </button>
                  ))}
                </div>
                <FieldError id="price-days-error">{errors.days}</FieldError>
              </fieldset>

              <div className="grid gap-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <label htmlFor="price-start" className={labelClass}>Od</label>
                    <input id="price-start" type="time" step={900} className={inputClass} value={values.startTime} aria-invalid={Boolean(errors.time) || overlaps.length > 0} aria-describedby="price-time-error" onChange={(event) => update({ startTime: event.target.value })} />
                  </div>
                  <div className="grid gap-1.5">
                    <label htmlFor="price-end" className={labelClass}>Do</label>
                    <input id="price-end" type="time" step={900} className={inputClass} value={values.endTime} aria-invalid={Boolean(errors.time) || overlaps.length > 0} aria-describedby="price-time-error" onChange={(event) => update({ endTime: event.target.value })} />
                  </div>
                </div>
                <FieldError id="price-time-error">
                  {errors.time ?? (overlaps.length > 0
                    ? `Překrývá se s ${overlaps.map((rule) => `${shortDayNames[rule.dayOfWeek]} ${rule.startTime}–${rule.endTime}`).join(", ")}. Navazující časy jsou v pořádku.`
                    : undefined)}
                </FieldError>
              </div>

              <div className="grid gap-1.5">
                <label htmlFor="price-amount" className={labelClass}>Cena za hodinu</label>
                <div className="relative">
                  <input ref={priceRef} id="price-amount" type="text" inputMode="decimal" autoComplete="off" placeholder="např. 400" className={`${inputClass} pr-12 text-lg font-semibold tabular-nums`} value={values.price} aria-invalid={Boolean(errors.price)} aria-describedby={errors.price ? "price-amount-error" : undefined} onChange={(event) => update({ price: event.target.value })} />
                  <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-muted">Kč</span>
                </div>
                <FieldError id="price-amount-error">{errors.price}</FieldError>
              </div>
            </fieldset>

            {submitError && (
              <div className="mt-5">
                <ErrorBanner title="Pravidlo se nepodařilo uložit">{submitError}</ErrorBanner>
              </div>
            )}

            <button type="submit" disabled={submitting} className="button button-primary mt-6 w-full gap-2 disabled:cursor-wait disabled:opacity-70">
              {submitting ? <><CircleNotch size={18} className="animate-spin" aria-hidden="true" /><span role="status">Ukládáme…</span></> : <><Plus size={18} aria-hidden="true" /> Přidat do ceníku</>}
            </button>
            <p className="mt-3 text-xs leading-relaxed text-muted">Změna ceníku neovlivní cenu už vytvořených rezervací.</p>
          </form>

          <Link href={`/venues/${venue.id}`} className="mt-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-muted hover:text-foreground">
            <ArrowLeft size={16} aria-hidden="true" /> Zpět na sportoviště
          </Link>
        </aside>
      </div>
    </>
  );
}

const hourHeight = 44;

function PriceCalendar({
  venue,
  rules,
  addedIds,
  selected,
  onPickGap,
}: {
  venue: VenueDetail;
  rules: PriceRule[];
  addedIds: string[];
  selected: PriceRuleFormValues;
  onPickGap: (day: DayOfWeek, startTime: string, endTime: string) => void;
}) {
  const hours = hourRange([
    ...venue.openingHours.map((item) => ({ start: item.openTime, end: item.closeTime })),
    ...rules.map((rule) => ({ start: rule.startTime, end: rule.endTime })),
  ]);
  const from = (hours[0] ?? 8) * 60;
  const prices = rules.map((rule) => rule.pricePerHour);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const tier = (price: number) => (max === min ? 1 : Math.min(2, Math.floor(((price - min) / (max - min)) * 3)));
  const tierClass = [
    "bg-brand-50 text-brand-900 dark:bg-ball/10 dark:text-foreground",
    "bg-brand-100 text-brand-900 dark:bg-ball/20 dark:text-foreground",
    "bg-brand-200 text-brand-900 dark:bg-ball/35 dark:text-foreground",
  ];
  const top = (time: string) => ((toMinutes(time) - from) / 60) * hourHeight;
  const height = (start: string, end: string) => ((toMinutes(end) - toMinutes(start)) / 60) * hourHeight;

  return (
    <>
      <div className="-mx-5 overflow-x-auto px-5 pb-2 md:mx-0 md:px-0">
        <div className="grid min-w-[640px] grid-cols-[3rem_repeat(7,minmax(0,1fr))] gap-x-1.5">
          <div />
          {daysOfWeek.map((day) => (
            <div key={day} className="pb-3 text-center">
              <span className="text-sm font-semibold">{shortDayNames[day]}</span>
              <span className="sr-only"> {dayNames[day]}</span>
            </div>
          ))}

          <div className="relative" style={{ height: hours.length * hourHeight }}>
            {hours.map((hour, index) => (
              <span key={hour} className="absolute right-2 -translate-y-1/2 text-xs text-muted tabular-nums" style={{ top: index * hourHeight }}>
                {String(hour).padStart(2, "0")}:00
              </span>
            ))}
          </div>

          {daysOfWeek.map((day) => {
            const opening = venue.openingHours.find((item) => item.dayOfWeek === day);
            const dayRules = sortPriceRules(rules.filter((rule) => rule.dayOfWeek === day));
            const gaps = opening ? priceGaps(opening.openTime, opening.closeTime, dayRules) : [];
            return (
              <div key={day} className="relative rounded-xl bg-[repeating-linear-gradient(135deg,var(--color-surface)_0_6px,transparent_6px_12px)]" style={{ height: hours.length * hourHeight }}>
                {opening ? (
                  <div aria-hidden="true" className="absolute inset-x-0 rounded-xl bg-page" style={{ top: top(opening.openTime), height: height(opening.openTime, opening.closeTime) }} />
                ) : (
                  <span className="absolute inset-x-0 top-3 text-center text-xs text-muted">Zavřeno</span>
                )}
                {hours.slice(1).map((hour, index) => (
                  <div key={hour} aria-hidden="true" className="absolute inset-x-0 border-t border-line/50" style={{ top: (index + 1) * hourHeight }} />
                ))}
                {dayRules.map((rule) => {
                  const blockHeight = height(rule.startTime, rule.endTime);
                  return (
                    <div key={rule.id} className={`absolute inset-x-0.5 flex flex-col justify-start overflow-hidden rounded-lg px-2 pt-1.5 ${tierClass[tier(rule.pricePerHour)]} ${addedIds.includes(rule.id) ? "ring-2 ring-brand-500 dark:ring-ball" : ""}`} style={{ top: top(rule.startTime) + 2, height: blockHeight - 4 }}>
                      <span className="text-sm font-semibold tabular-nums">{formatPrice(rule.pricePerHour)}</span>
                      {blockHeight >= 2 * hourHeight - 4 && <span className="text-xs tabular-nums opacity-70">{rule.startTime}–{rule.endTime}</span>}
                      <span className="sr-only">{dayNames[day]} {rule.startTime}–{rule.endTime}</span>
                    </div>
                  );
                })}
                {gaps.map((gap) => {
                  const active = selected.days.length === 1 && selected.days[0] === day && selected.startTime === gap.startTime && selected.endTime === gap.endTime;
                  return (
                    <button
                      key={gap.startTime}
                      type="button"
                      onClick={() => onPickGap(day, gap.startTime, gap.endTime)}
                      aria-label={`${dayNames[day]} ${gap.startTime}–${gap.endTime} bez ceny, nastavit cenu`}
                      className={`absolute inset-x-0.5 flex items-center justify-center overflow-hidden rounded-lg border border-dashed text-xs font-medium transition-colors ${active ? "border-foreground bg-surface text-foreground" : "border-amber-500/60 text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/40"}`}
                      style={{ top: top(gap.startTime) + 2, height: height(gap.startTime, gap.endTime) - 4 }}
                    >
                      <Plus size={13} aria-hidden="true" className="mr-1 shrink-0" /> Bez ceny
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      <ul aria-label="Legenda" className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted">
        {prices.length > 0 && <li className="flex items-center gap-2"><span aria-hidden="true" className="flex"><span className="size-3 rounded-l-[4px] bg-brand-50 dark:bg-ball/10" /><span className="size-3 bg-brand-100 dark:bg-ball/20" /><span className="size-3 rounded-r-[4px] bg-brand-200 dark:bg-ball/35" /></span>Od nejlevnější po nejdražší hodinu</li>}
        <li className="flex items-center gap-2"><span aria-hidden="true" className="size-3 rounded-[4px] border border-dashed border-amber-500/70" />Otevřeno, ale bez ceny. Tento čas si nikdo nezarezervuje.</li>
        <li className="flex items-center gap-2"><span aria-hidden="true" className="size-3 rounded-[4px] bg-[repeating-linear-gradient(135deg,var(--color-surface)_0_3px,transparent_3px_6px)] ring-1 ring-line" />Zavřeno</li>
      </ul>
    </>
  );
}
