import { useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowRight, Check, MapPin, Plus } from "@phosphor-icons/react";
import type { Venue } from "@/lib/api";

export function VenueCreated({
  venue,
  previewSrc,
  onStartOver,
}: {
  venue: Venue;
  previewSrc: string | null;
  onStartOver: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <section className="mt-8 max-w-3xl overflow-hidden rounded-2xl border border-line" aria-labelledby="venue-created-title">
      {previewSrc && (
        <div className="relative aspect-[21/8] bg-surface">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewSrc} alt="" className="size-full object-cover" />
        </div>
      )}
      <div className="p-6 sm:p-9">
        <p id="venue-created-status" className="flex items-center gap-2 text-sm font-semibold text-brand-600 dark:text-brand-200">
          <span className="flex size-6 items-center justify-center rounded-full bg-ball text-brand-900">
            <Check size={14} weight="bold" aria-hidden="true" />
          </span>
          Sportoviště je založené
        </p>
        <h2 id="venue-created-title" ref={headingRef} tabIndex={-1} aria-describedby="venue-created-status" className="mt-3 break-words font-display text-3xl leading-tight font-semibold tracking-tight focus:outline-none">
          {venue.name}
        </h2>
        <p className="mt-2 flex items-start gap-2 text-sm text-muted">
          <MapPin size={18} className="shrink-0" aria-hidden="true" />
          {venue.address}, {venue.city}
        </p>

        <div className="mt-7 border-t border-line pt-6">
          <h3 className="font-display text-xl font-semibold">Teď přidejte první kurt</h3>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted">
            Ve výsledcích hledání se sportoviště objeví, jakmile bude mít alespoň jeden kurt.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Link href={`/venues/${venue.id}/courts/new`} className="button button-primary gap-2">
              <Plus size={18} aria-hidden="true" /> Přidat první kurt
            </Link>
            <Link href={`/venues/${venue.id}`} className="button button-outline gap-2">
              Zobrazit sportoviště <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </div>

        <button type="button" onClick={onStartOver} className="mt-5 inline-flex min-h-11 items-center rounded-lg text-sm text-muted underline underline-offset-4 hover:text-foreground">
          Založit další sportoviště
        </button>
      </div>
    </section>
  );
}
