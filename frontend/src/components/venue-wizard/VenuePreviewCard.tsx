import Image from "next/image";
import { Clock, ImageSquare, MapPin } from "@phosphor-icons/react";
import { daysOfWeek, type VenueFormValues } from "@/lib/venueForm";
import { photoSrc, type VenuePhoto } from "./steps";

function openDaysLabel(count: number): string {
  if (count === 7) return "Otevřeno každý den";
  if (count === 0) return "Zatím žádný otevřený den";
  return `Otevřeno ${count} ${count === 1 ? "den" : count < 5 ? "dny" : "dnů"} v týdnu`;
}

export function VenuePreviewCard({ values, photo }: { values: VenueFormValues; photo: VenuePhoto }) {
  const src = photoSrc(photo);
  const openDays = daysOfWeek.filter((day) => values.hours[day].open).length;
  const location = [values.address.trim(), values.city.trim()].filter(Boolean).join(", ");

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-page shadow-[0_16px_36px_-28px_rgba(23,59,43,.45)]">
      <div className="relative aspect-[16/9] bg-surface">
        {src ? (
          photo.kind === "stock" ? (
            <Image src={src} alt="" fill sizes="340px" className="object-cover" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt="" className="size-full object-cover" />
          )
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-2 text-muted">
            <ImageSquare size={30} aria-hidden="true" />
            <span className="text-xs">Bez fotky</span>
          </div>
        )}
      </div>
      <div className="p-5">
        <p className="flex items-center gap-1.5 text-sm text-muted">
          <MapPin size={15} aria-hidden="true" />
          {values.city.trim() || "Město"}
        </p>
        <p className="mt-1.5 break-words font-display text-xl leading-snug font-semibold tracking-[-.02em] text-foreground">
          {values.name.trim() || "Název sportoviště"}
        </p>
        <p className="mt-2 break-words text-sm text-muted">{location || "Ulice a číslo popisné"}</p>
        <p className="mt-4 flex items-center gap-2 border-t border-line pt-4 text-sm text-muted">
          <Clock size={16} aria-hidden="true" />
          {openDaysLabel(openDays)}
        </p>
      </div>
    </div>
  );
}
