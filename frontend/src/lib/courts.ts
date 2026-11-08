import { apiBaseUrl, authHeaders, toApiError, type UuAppErrorMap } from "@/lib/api";
import type { Court } from "@/lib/venues";

export const courtLimits = {
  name: 50,
  sport: 50,
  surface: 100,
} as const;

export type CourtCreateDtoIn = {
  venueId: string;
  name: string;
  sport: string;
  surface: string;
  indoor: boolean;
};

export type CreatedCourt = Court & {
  venueId: string;
  uuAppErrorMap: UuAppErrorMap;
};

export async function createCourt(dtoIn: CourtCreateDtoIn): Promise<CreatedCourt> {
  const response = await fetch(`${apiBaseUrl}/court/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(dtoIn),
  });
  if (!response.ok) {
    throw await toApiError(response);
  }
  return (await response.json()) as CreatedCourt;
}

export const surfaceSuggestions: { match: RegExp; surfaces: string[] }[] = [
  { match: /tenis/i, surfaces: ["Antuka", "Tvrdý povrch", "Umělá tráva s pískem"] },
  { match: /padel/i, surfaces: ["Umělá tráva s pískem", "Tvrdý povrch"] },
  { match: /badminton|squash|volejbal|basketbal|florbal|futsal/i, surfaces: ["Sportovní parkety", "Sportovní PVC", "Umělý povrch"] },
  { match: /fotbal/i, surfaces: ["Umělá tráva", "Přírodní tráva"] },
  { match: /beach|plážov/i, surfaces: ["Písek"] },
];

const fallbackSurfaces = ["Antuka", "Tvrdý povrch", "Umělá tráva", "Sportovní parkety", "Písek"];

export function surfacesForSports(sports: string[]): string[] {
  const matched = surfaceSuggestions
    .filter(({ match }) => sports.some((sport) => match.test(sport)))
    .flatMap(({ surfaces }) => surfaces);
  return matched.length > 0 ? [...new Set(matched)] : fallbackSurfaces;
}

export function nextCourtName(existing: string[]): string {
  const taken = new Set(existing.map((name) => name.trim().toLocaleLowerCase("cs")));
  let number = existing.length + 1;
  while (taken.has(`kurt ${number}`)) number += 1;
  return `Kurt ${number}`;
}

export function splitSports(sport: string): string[] {
  return sport.split(",").map((value) => value.trim()).filter(Boolean);
}
