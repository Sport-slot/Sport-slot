import type { PreparedImage } from "@/lib/venueImages";
import type { VenueFormErrors } from "@/lib/venueForm";

export const wizardSteps = [
  { id: "udaje", title: "Základní údaje", short: "Údaje", description: "Název a adresa, podle kterých vás hráči najdou." },
  { id: "oteviraci-doba", title: "Otevírací doba", short: "Otevírací doba", description: "Kdy si u vás mohou hráči zarezervovat kurt." },
  { id: "fotka", title: "Fotka sportoviště", short: "Fotka", description: "Hlavní fotka se ukáže ve výsledcích hledání i na detailu." },
  { id: "shrnuti", title: "Kontrola a uložení", short: "Kontrola", description: "Zkontrolujte údaje. Po uložení přidáte kurty." },
] as const;

export type WizardStepId = (typeof wizardSteps)[number]["id"];

export type VenuePhoto =
  | { kind: "none" }
  | { kind: "stock"; src: string; label: string }
  | { kind: "upload"; image: PreparedImage; uploadedUrl?: string };

export function stepHasErrors(stepIndex: number, errors: VenueFormErrors): boolean {
  if (stepIndex === 0) return Boolean(errors.name || errors.address || errors.city || errors.description);
  if (stepIndex === 1) return Boolean(errors.hours || errors.days);
  return false;
}

export function photoSrc(photo: VenuePhoto): string | null {
  if (photo.kind === "stock") return photo.src;
  if (photo.kind === "upload") return photo.image.previewUrl;
  return null;
}
