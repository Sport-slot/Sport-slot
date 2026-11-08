import { apiBaseUrl, authHeaders, toApiError } from "@/lib/api";

export const acceptedImageTypes = ["image/jpeg", "image/png", "image/webp"] as const;
export const maxSourceImageBytes = 20 * 1024 * 1024;
export const maxUploadBytes = 3 * 1024 * 1024;
export const minImageWidth = 800;

const maxLongEdge = 1920;
const outputQualities = [0.86, 0.78, 0.68, 0.58];

export const stockVenuePhotos = [
  { src: "/images/venues/tennis-clay.webp", label: "Antukový tenis" },
  { src: "/images/venues/tennis-blue.webp", label: "Tenis, tvrdý povrch" },
  { src: "/images/venues/padel.webp", label: "Padel" },
  { src: "/images/venues/badminton-hall.webp", label: "Badmintonová hala" },
  { src: "/images/venues/sports-hall.webp", label: "Sportovní hala" },
  { src: "/images/venues/basketball-hall.webp", label: "Basketbal" },
  { src: "/images/venues/volleyball.webp", label: "Volejbal" },
  { src: "/images/venues/football.webp", label: "Fotbal" },
  { src: "/images/venues/sports-dome.webp", label: "Nafukovací hala" },
] as const;

export function venueImageSrc(imageUrl: string): string {
  return imageUrl.startsWith("/venueImage/") ? `${apiBaseUrl}${imageUrl}` : imageUrl;
}

export function isOptimizableImage(src: string): boolean {
  return src.startsWith("/");
}

export class ImageProcessingError extends Error {}

export type PreparedImage = {
  blob: Blob;
  previewUrl: string;
  width: number;
  height: number;
  fileName: string;
};

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function prepareVenueImage(file: File): Promise<PreparedImage> {
  if (!(acceptedImageTypes as readonly string[]).includes(file.type)) {
    throw new ImageProcessingError("Tento formát neumíme. Nahrajte fotku ve formátu JPG, PNG nebo WebP.");
  }
  if (file.size > maxSourceImageBytes) {
    throw new ImageProcessingError("Soubor je větší než 20 MB. Zkuste menší fotku.");
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new ImageProcessingError("Fotku se nepodařilo otevřít. Soubor je možná poškozený.");
  }

  try {
    if (bitmap.width < minImageWidth) {
      throw new ImageProcessingError(
        `Fotka je příliš malá (${bitmap.width} px na šířku). Nahrajte alespoň ${minImageWidth} px, aby byla ostrá i na velkých obrazovkách.`,
      );
    }

    const scale = Math.min(1, maxLongEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new ImageProcessingError("Prohlížeč nedokázal fotku zpracovat.");
    }
    context.drawImage(bitmap, 0, 0, width, height);

    for (const quality of outputQualities) {
      const webp = await canvasToBlob(canvas, "image/webp", quality);
      const blob = webp?.type === "image/webp" ? webp : await canvasToBlob(canvas, "image/jpeg", quality);
      if (blob && blob.size <= maxUploadBytes) {
        return {
          blob,
          previewUrl: URL.createObjectURL(blob),
          width,
          height,
          fileName: file.name,
        };
      }
    }
    throw new ImageProcessingError("Fotku se nepodařilo zmenšit pod 3 MB. Zkuste jinou.");
  } finally {
    bitmap.close();
  }
}

export type UploadedVenueImage = {
  id: string;
  imageUrl: string;
};

export async function uploadVenueImage(blob: Blob): Promise<UploadedVenueImage> {
  if (process.env.NEXT_PUBLIC_MOCK_ROLE) {
    await new Promise((resolve) => setTimeout(resolve, 600));
    return { id: crypto.randomUUID(), imageUrl: URL.createObjectURL(blob) };
  }

  const response = await fetch(`${apiBaseUrl}/venueImage/upload`, {
    method: "POST",
    headers: { "Content-Type": blob.type, ...authHeaders() },
    body: blob,
  });
  if (!response.ok) {
    throw await toApiError(response);
  }
  return (await response.json()) as UploadedVenueImage;
}
