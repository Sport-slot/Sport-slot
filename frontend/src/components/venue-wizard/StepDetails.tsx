import { FieldError, inputClass, labelClass, TextField } from "@/components/form/fields";
import { venueLimits, type VenueFormErrors, type VenueFormValues } from "@/lib/venueForm";

type TextKey = "name" | "address" | "city" | "description";

export function StepDetails({
  values,
  errors,
  onChange,
}: {
  values: VenueFormValues;
  errors: VenueFormErrors;
  onChange: (field: TextKey, value: string) => void;
}) {
  const descriptionLength = values.description.trim().length;
  return (
    <div className="grid gap-6">
      <TextField
        id="venue-name"
        label="Název sportoviště"
        placeholder="Např. Sportcentrum Lužánky"
        hint="Použijte název, pod kterým vás hráči znají."
        value={values.name}
        maxLength={venueLimits.name}
        error={errors.name}
        autoComplete="organization"
        onChange={(value) => onChange("name", value)}
      />
      <div className="grid gap-6 sm:grid-cols-[1.5fr_1fr]">
        <TextField
          id="venue-address"
          label="Ulice a číslo popisné"
          placeholder="Např. Sportovní 14"
          value={values.address}
          maxLength={venueLimits.address}
          error={errors.address}
          autoComplete="street-address"
          onChange={(value) => onChange("address", value)}
        />
        <TextField
          id="venue-city"
          label="Město"
          placeholder="Např. Brno"
          value={values.city}
          maxLength={venueLimits.city}
          error={errors.city}
          autoComplete="address-level2"
          onChange={(value) => onChange("city", value)}
        />
      </div>
      <div className="grid gap-2">
        <label htmlFor="venue-description" className={labelClass}>
          Popis sportoviště <span className="font-normal text-muted">(nepovinné)</span>
        </label>
        <textarea
          id="venue-description"
          className={`${inputClass} min-h-36 resize-y leading-relaxed`}
          rows={5}
          placeholder="Co u vás hráči najdou? Šatny, sprchy, parkování, půjčovna vybavení, občerstvení…"
          value={values.description}
          maxLength={venueLimits.description}
          aria-invalid={Boolean(errors.description)}
          aria-describedby={errors.description ? "venue-description-error" : "venue-description-hint"}
          onChange={(event) => onChange("description", event.target.value)}
        />
        <div className="flex flex-wrap justify-between gap-2 text-xs text-muted">
          <p id="venue-description-hint">Pár vět o vybavení a zázemí pomůže hráčům s výběrem.</p>
          <span className="tabular-nums" aria-live="polite">
            {descriptionLength} / {venueLimits.description}
          </span>
        </div>
        <FieldError id="venue-description-error">{errors.description}</FieldError>
      </div>
    </div>
  );
}
