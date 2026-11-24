"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowClockwise, CaretRight, CircleNotch, FloppyDisk, MapPin, WarningCircle } from "@phosphor-icons/react";
import { ErrorBanner } from "@/components/form/fields";
import { ApiError, type DayOfWeek } from "@/lib/api";
import { hasErrors, validateVenueForm, venueChanges, venueFormFromDetail, type DayHours, type VenueFormValues, type VenueUpdateFields } from "@/lib/venueForm";
import { stockVenuePhotos, uploadVenueImage } from "@/lib/venueImages";
import { getVenue, updateVenue, type VenueDetail } from "@/lib/venues";
import { StepDetails } from "./StepDetails";
import { StepHours } from "./StepHours";
import { StepPhoto } from "./StepPhoto";
import { VenuePreviewCard } from "./VenuePreviewCard";
import type { VenuePhoto } from "./steps";

type LoadState =
  | { status: "loading" }
  | { status: "notFound" }
  | { status: "notOwner" }
  | { status: "error"; message: string }
  | { status: "done"; venue: VenueDetail };

function photoOf(imageUrl: string | null | undefined): VenuePhoto {
  if (!imageUrl) return { kind: "none" };
  const stock = stockVenuePhotos.find((photo) => photo.src === imageUrl);
  return stock ? { kind: "stock", src: stock.src, label: stock.label } : { kind: "current", imageUrl };
}

function photoUrl(photo: VenuePhoto): string | null | undefined {
  if (photo.kind === "none") return null;
  if (photo.kind === "stock") return photo.src;
  if (photo.kind === "current") return photo.imageUrl;
  return photo.uploadedUrl;
}

function changeCount(changes: Partial<VenueUpdateFields>, photoChanged: boolean): number {
  return Object.keys(changes).length + (photoChanged ? 1 : 0);
}

function changesLabel(count: number): string {
  if (count === 1) return "1 neuložená změna";
  if (count >= 2 && count <= 4) return `${count} neuložené změny`;
  return `${count} neuložených změn`;
}

export function VenueEditor({ venueId }: { venueId: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setState({ status: "loading" });
    getVenue(venueId)
      .then((venue) => {
        if (!active) return;
        setState(venue.isOwner ? { status: "done", venue } : { status: "notOwner" });
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
            <Link href="/venues/mine" className="inline-flex min-h-11 items-center font-medium hover:text-foreground hover:underline">Moje sportoviště</Link>
          </li>
          <li aria-hidden="true"><CaretRight size={12} /></li>
          <li className="max-w-[45vw] truncate">
            <Link href={`/venues/${venueId}`} className="inline-flex min-h-11 items-center font-medium hover:text-foreground hover:underline">
              {state.status === "done" ? state.venue.name : "Detail"}
            </Link>
          </li>
          <li aria-hidden="true"><CaretRight size={12} /></li>
          <li aria-current="page" className="font-medium text-foreground">Upravit</li>
        </ol>
      </nav>

      {state.status === "loading" && (
        <div aria-hidden="true" className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="h-[36rem] animate-pulse rounded-3xl bg-surface" />
          <div className="h-80 animate-pulse rounded-3xl bg-surface" />
        </div>
      )}

      {(state.status === "notFound" || state.status === "notOwner") && (
        <div className="mt-8 flex flex-col items-center rounded-2xl border border-dashed border-line px-6 py-16 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-surface text-muted"><MapPin size={26} aria-hidden="true" /></span>
          <h1 className="mt-5 font-display text-2xl font-semibold">{state.status === "notFound" ? "Sportoviště nenalezeno" : "Sportoviště nemůžete upravit"}</h1>
          <p className="mt-2 max-w-md text-muted">
            {state.status === "notFound" ? "Odkaz je neplatný nebo sportoviště už neexistuje." : "Upravit ho může jen správce, který ho založil."}
          </p>
          <Link href="/venues/mine" className="button button-dark mt-6">Moje sportoviště</Link>
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

      {state.status === "done" && <VenueEditForm venue={state.venue} />}
    </main>
  );
}

function VenueEditForm({ venue }: { venue: VenueDetail }) {
  const router = useRouter();
  const [initial] = useState(() => venueFormFromDetail(venue));
  const [values, setValues] = useState<VenueFormValues>(initial);
  const [photo, setPhoto] = useState<VenuePhoto>(() => photoOf(venue.imageUrl));
  const [showErrors, setShowErrors] = useState(false);
  const [phase, setPhase] = useState<"idle" | "uploading" | "saving">("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const submitting = phase !== "idle";
  const allErrors = validateVenueForm(values);
  const errors = showErrors ? allErrors : {};
  const changes = venueChanges(initial, values);
  const photoChanged = photo.kind === "upload" || photoUrl(photo) !== (venue.imageUrl ?? null);
  const count = changeCount(changes, photoChanged);

  useEffect(() => {
    if (count === 0 || submitting) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [count, submitting]);

  function update(patch: (current: VenueFormValues) => VenueFormValues) {
    setValues(patch);
    setSubmitError(null);
  }

  function updatePhoto(next: VenuePhoto) {
    if (photo.kind === "upload" && (next.kind !== "upload" || next.image !== photo.image)) {
      URL.revokeObjectURL(photo.image.previewUrl);
    }
    setPhoto(next);
    setSubmitError(null);
  }

  function reset() {
    setValues(initial);
    updatePhoto(photoOf(venue.imageUrl));
    setShowErrors(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || count === 0) return;
    setShowErrors(true);
    setSubmitError(null);
    if (hasErrors(allErrors)) {
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }

    let imageUrl = photoUrl(photo);
    if (photo.kind === "upload" && !imageUrl) {
      try {
        setPhase("uploading");
        imageUrl = (await uploadVenueImage(photo.image.blob)).imageUrl;
        setPhoto({ ...photo, uploadedUrl: imageUrl });
      } catch (error) {
        setPhase("idle");
        setSubmitError(error instanceof ApiError ? error.message : "Fotku se nepodařilo nahrát. Zkontrolujte připojení a zkuste to znovu.");
        return;
      }
    }

    setPhase("saving");
    try {
      await updateVenue({ id: venue.id, ...changes, ...(photoChanged ? { imageUrl: imageUrl ?? null } : {}) });
      router.push(`/venues/${venue.id}`);
    } catch (error) {
      setPhase("idle");
      setSubmitError(error instanceof ApiError ? error.message : "Změny se nepodařilo uložit. Vaše úpravy tu zůstaly, zkuste to znovu.");
    }
  }

  const sectionTitle = "font-display text-xl font-semibold tracking-tight";

  return (
    <>
      <h1 className="mt-4 font-display text-[clamp(2rem,4.5vw,3.25rem)] leading-[1.08] font-semibold tracking-[-.045em]">
        Upravit sportoviště
      </h1>
      <p className="mt-2 text-base text-muted md:text-lg">{venue.name}</p>

      <div className="mt-8 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-14">
        <form ref={formRef} onSubmit={handleSubmit} noValidate aria-busy={submitting} className="min-w-0">
          <fieldset disabled={submitting} className="grid min-w-0 gap-14">
            <legend className="sr-only">Údaje sportoviště</legend>

            <section aria-labelledby="edit-details-title">
              <h2 id="edit-details-title" className={`${sectionTitle} mb-6`}>Základní údaje</h2>
              <StepDetails values={values} errors={errors} onChange={(field, value) => update((current) => ({ ...current, [field]: value }))} />
            </section>

            <section aria-labelledby="edit-hours-title" className="border-t border-line pt-10">
              <h2 id="edit-hours-title" className={sectionTitle}>Otevírací doba</h2>
              <p className="mt-1.5 mb-6 text-sm text-muted">Změna platí pro nové rezervace. Už vytvořené rezervace zůstanou beze změny.</p>
              {(errors.hours || errors.days) && (
                <div className="mb-6"><ErrorBanner title="Zkontrolujte otevírací dobu">{errors.hours}</ErrorBanner></div>
              )}
              <StepHours
                values={values}
                errors={errors}
                onDayChange={(day: DayOfWeek, patch: Partial<DayHours>) =>
                  update((current) => ({ ...current, hours: { ...current.hours, [day]: { ...current.hours[day], ...patch } } }))
                }
                onHoursChange={(hours) => update((current) => ({ ...current, hours }))}
              />
            </section>

            <section aria-labelledby="edit-photo-title" className="border-t border-line pt-10">
              <h2 id="edit-photo-title" className={`${sectionTitle} mb-6`}>Fotka</h2>
              <StepPhoto photo={photo} disabled={submitting} onChange={updatePhoto} />
            </section>
          </fieldset>

          {submitError && (
            <div className="mt-8">
              <ErrorBanner title="Změny se nepodařilo uložit">{submitError}</ErrorBanner>
            </div>
          )}

          <div className="sticky bottom-0 z-10 -mx-5 mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-page/90 px-5 py-4 backdrop-blur-md sm:mx-0 sm:px-0">
            <p role="status" className="text-sm text-muted">
              {count === 0 ? "Žádné změny" : changesLabel(count)}
              {count > 0 && !submitting && (
                <button type="button" onClick={reset} className="ml-3 inline-flex min-h-11 items-center font-semibold text-foreground underline underline-offset-4">
                  Vrátit
                </button>
              )}
            </p>
            <div className="flex items-center gap-2">
              <Link href={`/venues/${venue.id}`} className="inline-flex min-h-12 items-center rounded-full px-3 text-sm font-semibold text-muted hover:text-foreground">
                Zrušit
              </Link>
              <button type="submit" disabled={submitting || count === 0} className="button button-primary gap-2 disabled:cursor-not-allowed disabled:opacity-50">
                {phase === "uploading" && <><CircleNotch size={18} className="animate-spin" aria-hidden="true" />Nahráváme fotku…</>}
                {phase === "saving" && <><CircleNotch size={18} className="animate-spin" aria-hidden="true" />Ukládáme…</>}
                {phase === "idle" && <><FloppyDisk size={18} aria-hidden="true" /> Uložit změny</>}
              </button>
            </div>
          </div>
        </form>

        <aside className="hidden lg:sticky lg:top-28 lg:block" aria-label="Náhled pro hráče">
          <p className="mb-3 text-sm font-medium text-muted">Náhled ve výsledcích hledání</p>
          <VenuePreviewCard values={values} photo={photo} />
        </aside>
      </div>
    </>
  );
}
