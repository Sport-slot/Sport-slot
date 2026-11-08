import { useRef, useState, type DragEvent } from "react";
import Image from "next/image";
import {
  ArrowsClockwise,
  Check,
  CircleNotch,
  ImageSquare,
  Trash,
  UploadSimple,
} from "@phosphor-icons/react";
import { FieldError } from "@/components/form/fields";
import {
  acceptedImageTypes,
  ImageProcessingError,
  minImageWidth,
  prepareVenueImage,
  stockVenuePhotos,
} from "@/lib/venueImages";
import type { VenuePhoto } from "./steps";

function formatBytes(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.round(bytes / 1024)} kB`;
}

export function StepPhoto({
  photo,
  disabled,
  onChange,
}: {
  photo: VenuePhoto;
  disabled: boolean;
  onChange: (photo: VenuePhoto) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file || processing) return;
    setError(null);
    setProcessing(true);
    try {
      onChange({ kind: "upload", image: await prepareVenueImage(file) });
    } catch (caught) {
      setError(caught instanceof ImageProcessingError ? caught.message : "Fotku se nepodařilo zpracovat. Zkuste jiný soubor.");
    } finally {
      setProcessing(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    void handleFile(event.dataTransfer.files[0]);
  }

  const fileInput = (
    <input
      ref={inputRef}
      id="venue-photo-input"
      type="file"
      accept={acceptedImageTypes.join(",")}
      className="sr-only"
      disabled={disabled || processing}
      aria-describedby={error ? "venue-photo-error venue-photo-hint" : "venue-photo-hint"}
      onChange={(event) => void handleFile(event.target.files?.[0])}
    />
  );

  return (
    <div className="grid gap-8">
      <section aria-labelledby="venue-photo-upload-title">
        <h3 id="venue-photo-upload-title" className="text-sm font-semibold text-foreground">Vlastní fotka</h3>

        {photo.kind === "upload" ? (
          <div className="mt-3 overflow-hidden rounded-2xl border border-line">
            <div className="relative aspect-[16/9] bg-surface">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.image.previewUrl} alt="Náhled nahrané fotky" className="size-full object-cover" />
              {processing && (
                <div className="absolute inset-0 flex items-center justify-center bg-page/70">
                  <CircleNotch size={28} className="animate-spin" aria-hidden="true" />
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0 text-sm">
                <p className="truncate font-semibold text-foreground">{photo.image.fileName}</p>
                <p className="text-muted tabular-nums">
                  {photo.image.width} × {photo.image.height} px, {formatBytes(photo.image.blob.size)}
                </p>
              </div>
              <div className="flex gap-2">
                <label htmlFor="venue-photo-input" className={`button button-outline min-h-11 cursor-pointer gap-2 px-4 py-2 ${disabled || processing ? "pointer-events-none opacity-50" : ""}`}>
                  <ArrowsClockwise size={16} aria-hidden="true" /> Vyměnit
                </label>
                {fileInput}
                <button type="button" disabled={disabled} onClick={() => onChange({ kind: "none" })} className="button button-outline min-h-11 gap-2 px-4 py-2 disabled:opacity-50">
                  <Trash size={16} aria-hidden="true" /> Odebrat
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div
            onDragEnter={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
            }}
            onDrop={handleDrop}
            className={`relative mt-3 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors focus-within:border-brand-500 ${
              dragging ? "border-brand-500 bg-brand-50/60 dark:bg-brand-900/30" : "border-line bg-surface/40"
            }`}
          >
            {fileInput}
            <span className="flex size-14 items-center justify-center rounded-full bg-page text-foreground shadow-sm">
              {processing ? <CircleNotch size={26} className="animate-spin" aria-hidden="true" /> : <UploadSimple size={26} aria-hidden="true" />}
            </span>
            <p className="mt-4 font-semibold text-foreground">
              {processing ? "Připravujeme fotku…" : dragging ? "Pusťte fotku sem" : "Přetáhněte fotku sem"}
            </p>
            <p className="mt-1 text-sm text-muted">nebo</p>
            <label htmlFor="venue-photo-input" className={`button button-dark mt-3 min-h-11 cursor-pointer gap-2 px-5 py-2 ${disabled || processing ? "pointer-events-none opacity-50" : ""}`}>
              <ImageSquare size={18} aria-hidden="true" /> Vybrat ze zařízení
            </label>
          </div>
        )}

        <p id="venue-photo-hint" className="mt-3 text-xs leading-relaxed text-muted">
          JPG, PNG nebo WebP, alespoň {minImageWidth} px na šířku. Nejlépe vypadá fotka na šířku bez textu a log.
          Před nahráním ji v prohlížeči zmenšíme, takže nevadí ani fotka přímo z telefonu.
        </p>
        <div className="mt-2">
          <FieldError id="venue-photo-error">{error}</FieldError>
        </div>
      </section>

      <fieldset>
        <legend className="text-sm font-semibold text-foreground">Nebo použijte ilustrační fotku</legend>
        <p className="mt-1 text-sm text-muted">Hodí se, dokud nemáte vlastní fotku sportoviště.</p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {stockVenuePhotos.map((stock) => {
            const checked = photo.kind === "stock" && photo.src === stock.src;
            return (
              <label key={stock.src} className={`group relative cursor-pointer overflow-hidden rounded-xl border-2 transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-foreground ${checked ? "border-brand-500" : "border-transparent"}`}>
                <input
                  type="radio"
                  name="venue-stock-photo"
                  value={stock.src}
                  checked={checked}
                  disabled={disabled}
                  onChange={() => onChange({ kind: "stock", src: stock.src, label: stock.label })}
                  className="sr-only"
                />
                <span className="relative block aspect-[4/3] bg-surface">
                  <Image src={stock.src} alt="" fill sizes="(min-width: 640px) 220px, 45vw" className="object-cover transition-transform duration-300 group-hover:scale-105" />
                  {checked && (
                    <span className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-full bg-brand-500 text-white shadow">
                      <Check size={15} weight="bold" aria-hidden="true" />
                    </span>
                  )}
                </span>
                <span className="block truncate px-2.5 py-2 text-xs font-medium text-foreground">{stock.label}</span>
              </label>
            );
          })}
        </div>
        {photo.kind !== "none" && (
          <button type="button" disabled={disabled} onClick={() => onChange({ kind: "none" })} className="mt-4 inline-flex min-h-11 items-center rounded-lg text-sm text-muted underline underline-offset-4 hover:text-foreground">
            Pokračovat bez fotky
          </button>
        )}
      </fieldset>
    </div>
  );
}
