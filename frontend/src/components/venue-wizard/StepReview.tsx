import type { ReactNode } from "react";
import { PencilSimple } from "@phosphor-icons/react";
import { summarizeHours, type VenueFormValues } from "@/lib/venueForm";
import { VenuePreviewCard } from "./VenuePreviewCard";
import type { VenuePhoto } from "./steps";

function ReviewSection({
  title,
  editLabel,
  disabled,
  onEdit,
  children,
}: {
  title: string;
  editLabel: string;
  disabled: boolean;
  onEdit: () => void;
  children: ReactNode;
}) {
  return (
    <section className="py-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold text-foreground">{title}</h3>
        <button type="button" disabled={disabled} onClick={onEdit} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-foreground underline-offset-4 hover:underline disabled:opacity-50">
          <PencilSimple size={15} aria-hidden="true" /> Upravit<span className="sr-only"> {editLabel}</span>
        </button>
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function StepReview({
  values,
  photo,
  disabled,
  onEdit,
}: {
  values: VenueFormValues;
  photo: VenuePhoto;
  disabled: boolean;
  onEdit: (stepIndex: number) => void;
}) {
  const description = values.description.trim();
  return (
    <div className="grid gap-6">
      <div className="lg:hidden">
        <VenuePreviewCard values={values} photo={photo} />
      </div>

      <div className="divide-y divide-line border-y border-line">
      <ReviewSection title="Základní údaje" editLabel="základní údaje" disabled={disabled} onEdit={() => onEdit(0)}>
        <dl className="grid gap-3 text-sm sm:grid-cols-[9rem_minmax(0,1fr)]">
          <dt className="text-muted">Název</dt>
          <dd className="break-words font-medium text-foreground">{values.name.trim()}</dd>
          <dt className="text-muted">Adresa</dt>
          <dd className="break-words text-foreground">{values.address.trim()}, {values.city.trim()}</dd>
          <dt className="text-muted">Popis</dt>
          <dd className={`break-words whitespace-pre-line ${description ? "text-foreground" : "text-muted"}`}>
            {description ? (description.length > 280 ? `${description.slice(0, 280)}…` : description) : "Bez popisu"}
          </dd>
        </dl>
      </ReviewSection>

      <ReviewSection title="Otevírací doba" editLabel="otevírací dobu" disabled={disabled} onEdit={() => onEdit(1)}>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[9rem_minmax(0,1fr)]">
          {summarizeHours(values.hours).map(({ days, time }) => (
            <div key={days} className="contents">
              <dt className="text-muted">{days}</dt>
              <dd className={`tabular-nums ${time === "Zavřeno" ? "text-muted" : "text-foreground"}`}>{time}</dd>
            </div>
          ))}
        </dl>
      </ReviewSection>

      <ReviewSection title="Fotka" editLabel="fotku" disabled={disabled} onEdit={() => onEdit(2)}>
        <p className="text-sm text-foreground">
          {photo.kind === "upload" && `Vlastní fotka (${photo.image.fileName})`}
          {photo.kind === "stock" && `Ilustrační fotka: ${photo.label}`}
          {photo.kind === "none" && <span className="text-muted">Bez fotky. Zobrazíme ilustrační obrázek podle sportu.</span>}
        </p>
      </ReviewSection>
      </div>
    </div>
  );
}
