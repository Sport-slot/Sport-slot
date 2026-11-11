import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { VenueDetail } from "@/components/VenueDetail";
import { daysOfWeek } from "@/lib/venueForm";
import type { VenueDetail as Venue } from "@/lib/venues";

export const metadata: Metadata = {
  title: "Ukázka detailu sportoviště · SportSlot",
  robots: { index: false, follow: false },
};

// Local example based on db/prisma/seed.sql. No API or database is needed.
const venue: Venue = {
  id: "preview",
  name: "Sportcentrum",
  address: "Sportovní 1",
  city: "Praha",
  description: "Venkovní areál se čtyřmi hřišti. Všechna hřiště mají umělé osvětlení, k dispozici jsou šatny se sprchami.",
  imageUrl: "/images/venues/football.webp",
  active: true,
  deactivatedAt: null,
  isOwner: false,
  openingHours: daysOfWeek.map((dayOfWeek) => ({ dayOfWeek, openTime: "07:00", closeTime: "22:00" })),
  courts: [
    { id: "preview-1", name: "Hřiště 1", sport: "fotbal", surface: "Odpružený umělý trávník 3. generace (40 × 20 m)", indoor: false },
    { id: "preview-2", name: "Hřiště 2", sport: "tenis, nohejbal, streetbal", surface: "Odpružený akrylátový povrch", indoor: false },
    { id: "preview-3", name: "Hřiště 3", sport: "volejbal", surface: "Odpružený akrylátový povrch", indoor: false },
    { id: "preview-4", name: "Hřiště 4", sport: "basketbal", surface: "Beton", indoor: false },
  ],
  uuAppErrorMap: {},
};

export default function VenuePreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <>
      <div className="border-b border-line bg-surface/60">
        <p className="section-wrap py-2 text-xs leading-relaxed text-muted">Ukázka detailu · Ilustrační sportoviště s ukázkovými daty</p>
      </div>
      <VenueDetail id={venue.id} initialVenue={venue} />
    </>
  );
}
