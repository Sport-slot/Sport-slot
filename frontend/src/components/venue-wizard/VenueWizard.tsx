"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, CircleNotch, ClockCounterClockwise } from "@phosphor-icons/react";
import { ErrorBanner } from "@/components/form/fields";
import { ApiError, createVenue, type DayOfWeek, type Venue } from "@/lib/api";
import {
  emptyVenueForm,
  isDirty,
  toVenueCreateDtoIn,
  validateVenueForm,
  type DayHours,
  type VenueFormValues,
} from "@/lib/venueForm";
import { uploadVenueImage } from "@/lib/venueImages";
import { StepDetails } from "./StepDetails";
import { StepHours } from "./StepHours";
import { StepPhoto } from "./StepPhoto";
import { StepReview } from "./StepReview";
import { VenueCreated } from "./VenueCreated";
import { VenuePreviewCard } from "./VenuePreviewCard";
import { WizardStepper } from "./WizardStepper";
import { photoSrc, stepHasErrors, wizardSteps, type VenuePhoto } from "./steps";

const draftKey = "sportslot.venueDraft.v1";
const lastStep = wizardSteps.length - 1;

type Draft = { values: VenueFormValues; photo: VenuePhoto };
type SubmitPhase = "idle" | "uploading" | "saving";
type SubmitError = { message: string; retryStep?: number; retryLabel?: string; dropPhoto?: boolean };

function stepUrl(pathname: string, index: number): string {
  return index === 0 ? pathname : `${pathname}?krok=${wizardSteps[index].id}`;
}

function readDraft(): Draft | null {
  try {
    const raw = window.sessionStorage.getItem(draftKey);
    if (!raw) return null;
    const draft = JSON.parse(raw) as Draft;
    return draft?.values?.hours ? { values: draft.values, photo: draft.photo?.kind === "stock" ? draft.photo : { kind: "none" } } : null;
  } catch {
    return null;
  }
}

function writeDraft(draft: Draft) {
  try {
    const photo = draft.photo.kind === "stock" ? draft.photo : { kind: "none" };
    window.sessionStorage.setItem(draftKey, JSON.stringify({ values: draft.values, photo }));
  } catch {}
}

function clearDraft() {
  try {
    window.sessionStorage.removeItem(draftKey);
  } catch {}
}

export function VenueWizard() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [restored, setRestored] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [values, setValues] = useState<VenueFormValues>(emptyVenueForm);
  const [photo, setPhoto] = useState<VenuePhoto>({ kind: "none" });
  const [maxVisited, setMaxVisited] = useState(0);
  const [attempted, setAttempted] = useState<Set<number>>(new Set());
  const [phase, setPhase] = useState<SubmitPhase>("idle");
  const [submitError, setSubmitError] = useState<SubmitError | null>(null);
  const [created, setCreated] = useState<Venue | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const previousStep = useRef<number | null>(null);
  const submitting = phase !== "idle";

  const allErrors = validateVenueForm(values);
  const firstInvalid = wizardSteps.findIndex((_, index) => stepHasErrors(index, allErrors));
  const reachable = firstInvalid === -1 ? lastStep : firstInvalid;
  const requested = Math.max(0, wizardSteps.findIndex((step) => step.id === searchParams.get("krok")));
  const current = Math.min(requested, reachable);
  const step = wizardSteps[current];
  const errors = attempted.has(current) ? allErrors : {};

  useEffect(() => {
    const draft = readDraft();
    if (draft && (isDirty(draft.values) || draft.photo.kind !== "none")) {
      setValues(draft.values);
      setPhoto(draft.photo);
      setDraftRestored(true);
    }
    setRestored(true);
  }, []);

  useEffect(() => {
    if (restored && !created) writeDraft({ values, photo });
  }, [restored, created, values, photo]);

  useEffect(() => {
    if (!restored || created || requested === current) return;
    window.history.replaceState(null, "", stepUrl(pathname, current));
  }, [restored, created, requested, current, pathname]);

  useEffect(() => {
    setMaxVisited((visited) => Math.max(visited, current));
  }, [current]);

  useEffect(() => {
    if (!restored) return;
    if (previousStep.current !== null && previousStep.current !== current) {
      headingRef.current?.focus({ preventScroll: true });
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    previousStep.current = current;
  }, [restored, current]);

  const dirty = isDirty(values) || photo.kind !== "none";

  useEffect(() => {
    if (!dirty || created) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, created]);

  const goTo = useCallback(
    (index: number) => {
      setSubmitError(null);
      window.history.pushState(null, "", stepUrl(pathname, index));
    },
    [pathname],
  );

  function updateValues(patch: (current: VenueFormValues) => VenueFormValues) {
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

  function focusFirstInvalid() {
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
  }

  async function submit() {
    if (firstInvalid !== -1) {
      setAttempted((set) => new Set(set).add(firstInvalid));
      goTo(firstInvalid);
      return;
    }
    setSubmitError(null);
    let imageUrl: string | undefined;
    try {
      if (photo.kind === "stock") imageUrl = photo.src;
      if (photo.kind === "upload") {
        imageUrl = photo.uploadedUrl;
        if (!imageUrl) {
          setPhase("uploading");
          imageUrl = (await uploadVenueImage(photo.image.blob)).imageUrl;
          setPhoto({ ...photo, uploadedUrl: imageUrl });
        }
      }
    } catch (error) {
      setPhase("idle");
      setSubmitError({
        message: error instanceof ApiError ? error.message : "Fotku se nepodařilo nahrát. Zkontrolujte připojení a zkuste to znovu.",
        retryStep: 2,
        retryLabel: "Změnit fotku",
        dropPhoto: true,
      });
      return;
    }

    setPhase("saving");
    try {
      const venue = await createVenue({ ...toVenueCreateDtoIn(values), ...(imageUrl ? { imageUrl } : {}) });
      clearDraft();
      setCreated(venue);
      window.history.replaceState(null, "", pathname);
      window.scrollTo({ top: 0 });
    } catch (error) {
      const duplicate = error instanceof ApiError && error.code.endsWith("venueAlreadyExists");
      setSubmitError({
        message: error instanceof ApiError ? error.message : "Sportoviště se nepodařilo uložit. Vaše údaje tu zůstaly, zkuste to znovu.",
        ...(duplicate ? { retryStep: 0, retryLabel: "Upravit název nebo adresu" } : {}),
      });
    } finally {
      setPhase("idle");
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    if (current === lastStep) {
      void submit();
      return;
    }
    if (stepHasErrors(current, allErrors)) {
      setAttempted((set) => new Set(set).add(current));
      focusFirstInvalid();
      return;
    }
    goTo(current + 1);
  }

  function startOver() {
    clearDraft();
    if (photo.kind === "upload") URL.revokeObjectURL(photo.image.previewUrl);
    setValues(emptyVenueForm());
    setPhoto({ kind: "none" });
    setAttempted(new Set());
    setMaxVisited(0);
    setSubmitError(null);
    setDraftRestored(false);
    setCreated(null);
    previousStep.current = null;
    window.history.replaceState(null, "", pathname);
  }

  if (!restored) {
    return <div aria-hidden="true" className="mt-8 h-96 animate-pulse rounded-3xl bg-surface" />;
  }

  if (created) {
    return <VenueCreated venue={created} previewSrc={photoSrc(photo)} onStartOver={startOver} />;
  }

  const stepErrorCount = stepHasErrors(current, errors);

  return (
    <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-12">
      <form ref={formRef} onSubmit={handleSubmit} noValidate aria-busy={submitting} className="min-w-0 scroll-mt-28">
        <WizardStepper
          current={current}
          reachable={Math.min(reachable, maxVisited)}
          completed={(index) => index < reachable && index <= maxVisited}
          onSelect={goTo}
        />

        {draftRestored && current === 0 && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface/60 px-4 py-3 text-sm">
            <p className="flex items-center gap-2 text-foreground">
              <ClockCounterClockwise size={18} aria-hidden="true" /> Pokračujete v rozpracovaném sportovišti.
            </p>
            <button type="button" onClick={startOver} className="inline-flex min-h-11 items-center rounded-lg font-semibold underline underline-offset-4">
              Začít znovu
            </button>
          </div>
        )}

        <fieldset disabled={submitting} className="mt-8 min-w-0">
          <legend className="sr-only">{step.title}</legend>
          <header className="mb-7">
            <h2 ref={headingRef} tabIndex={-1} className="font-display text-2xl font-semibold tracking-tight focus:outline-none sm:text-[1.75rem]">
              {step.title}
            </h2>
            <p className="mt-1.5 text-muted">{step.description}</p>
          </header>

          {stepErrorCount && (
            <div className="mb-6">
              <ErrorBanner title="Zkontrolujte zvýrazněná pole" />
            </div>
          )}

          {current === 0 && (
            <StepDetails values={values} errors={errors} onChange={(field, value) => updateValues((v) => ({ ...v, [field]: value }))} />
          )}
          {current === 1 && (
            <StepHours
              values={values}
              errors={errors}
              onDayChange={(day: DayOfWeek, patch: Partial<DayHours>) =>
                updateValues((v) => ({ ...v, hours: { ...v.hours, [day]: { ...v.hours[day], ...patch } } }))
              }
              onHoursChange={(hours) => updateValues((v) => ({ ...v, hours }))}
            />
          )}
          {current === 2 && <StepPhoto photo={photo} disabled={submitting} onChange={updatePhoto} />}
          {current === 3 && <StepReview values={values} photo={photo} disabled={submitting} onEdit={goTo} />}
        </fieldset>

        {submitError && (
          <div className="mt-6">
            <ErrorBanner
              title="Sportoviště se nepodařilo uložit"
              action={
                (submitError.retryStep !== undefined || submitError.dropPhoto) && (
                  <div className="flex flex-wrap gap-2">
                    {submitError.retryStep !== undefined && (
                      <button type="button" onClick={() => goTo(submitError.retryStep ?? 0)} className="button button-outline min-h-10 border-red-300 px-4 py-2 dark:border-red-800">
                        {submitError.retryLabel}
                      </button>
                    )}
                    {submitError.dropPhoto && (
                      <button type="button" onClick={() => updatePhoto({ kind: "none" })} className="button button-outline min-h-10 border-red-300 px-4 py-2 dark:border-red-800">
                        Uložit bez fotky
                      </button>
                    )}
                  </div>
                )
              }
            >
              {submitError.message}
            </ErrorBanner>
          </div>
        )}

        <div className="sticky bottom-0 z-10 -mx-5 mt-10 flex items-center justify-between gap-3 border-t border-line bg-page/95 px-5 py-4 backdrop-blur md:static md:mx-0 md:bg-transparent md:px-0 md:pt-6 md:backdrop-blur-none">
          {current === 0 ? (
            <Link href="/venues" className="inline-flex min-h-12 items-center rounded-full px-2 text-sm font-semibold text-muted hover:text-foreground">
              Zrušit
            </Link>
          ) : (
            <button type="button" disabled={submitting} onClick={() => goTo(current - 1)} className="button button-outline gap-2 px-5 disabled:opacity-50">
              <ArrowLeft size={17} aria-hidden="true" /> <span className="hidden sm:inline">Předchozí krok</span><span className="sm:hidden">Zpět</span>
            </button>
          )}
          <button type="submit" disabled={submitting} className={`button gap-2 disabled:cursor-wait disabled:opacity-70 ${current === lastStep ? "button-primary" : "button-dark"}`}>
            {phase === "uploading" && <><CircleNotch size={18} className="animate-spin" aria-hidden="true" /><span role="status">Nahráváme fotku…</span></>}
            {phase === "saving" && <><CircleNotch size={18} className="animate-spin" aria-hidden="true" /><span role="status">Ukládáme sportoviště…</span></>}
            {phase === "idle" && current === lastStep && <>Založit sportoviště <ArrowRight size={18} aria-hidden="true" /></>}
            {phase === "idle" && current === 2 && photo.kind === "none" && <>Pokračovat bez fotky <ArrowRight size={18} aria-hidden="true" /></>}
            {phase === "idle" && current < lastStep && !(current === 2 && photo.kind === "none") && <>Pokračovat <ArrowRight size={18} aria-hidden="true" /></>}
          </button>
        </div>
      </form>

      <aside className="hidden lg:sticky lg:top-28 lg:block" aria-label="Náhled pro hráče">
        <p className="mb-3 text-sm font-medium text-muted">Náhled ve výsledcích hledání</p>
        <VenuePreviewCard values={values} photo={photo} />
        <p className="mt-4 text-sm leading-relaxed text-muted">
          Po uložení přidáte kurty a hřiště. Sportoviště se ve vyhledávání ukáže, jakmile bude mít alespoň jeden.
        </p>
      </aside>
    </div>
  );
}
