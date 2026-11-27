import { apiBaseUrl, authHeaders, toApiError, type DayOfWeek, type UuAppErrorMap } from "@/lib/api";
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

export async function updateCourt(dtoIn: {
  id: string;
  name: string;
  sport: string;
  surface: string;
  indoor: boolean; }): Promise<Court> {
    const response = await fetch(`${apiBaseUrl}/court/update`, 
      {
        method: "POST",
        headers: { "Content-Type" : "application/json",
        ...authHeaders() },
        body: JSON.stringify(dtoIn),
      });
      if (!response.ok) {
        throw await toApiError(response);
      }
      return (await response.json()) as Court; 
  
}

export async function deleteCourt(id: string): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/court/delete`, {

    method: "POST",
    headers: {"Content-Type": "application/json", 
      ...authHeaders() },
    
    body: JSON.stringify({id}),
  
  });
  if (!response.ok) {
    throw await toApiError(response);
  }
  
}



export type CourtSlot = {
  startTime: string;
  endTime: string;
  startAt: string;
  endAt: string;
  free: boolean;
};

export type CourtAvailability = {
  courtId: string;
  venueId: string;
  date: string;
  dayOfWeek: DayOfWeek;
  openTime: string | null;
  closeTime: string | null;
  slotList: CourtSlot[];
  uuAppErrorMap: UuAppErrorMap;
};

export async function getCourtAvailability(courtId: string, date: string): Promise<CourtAvailability> {
  const response = await fetch(`${apiBaseUrl}/court/availability?${new URLSearchParams({ courtId, date })}`);
  if (!response.ok) {
    throw await toApiError(response);
  }
  return (await response.json()) as CourtAvailability;
}

export type SlotRange = { from: number; to: number };

// Klik na volnou hodinu přilehlou k výběru ho prodlouží; jinak začne nový výběr.
export function selectSlot(slots: CourtSlot[], range: SlotRange | null, index: number): SlotRange {
  if (range && index === range.from - 1 && slots[index].endAt === slots[range.from].startAt) {
    return { from: index, to: range.to };
  }
  if (range && index === range.to + 1 && slots[range.to].endAt === slots[index].startAt) {
    return { from: range.from, to: index };
  }
  return { from: index, to: index };
}

const pragueDateFormat = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Prague", year: "numeric", month: "2-digit", day: "2-digit" });

export function pragueToday(now = new Date()): string {
  return pragueDateFormat.format(now);
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

export function suggestCourtName(sports: string[], existing: string[]): string {
  if (sports.length !== 1) return nextCourtName(existing);
  const prefix = sports[0].trim().replace(/^\p{L}/u, (letter) => letter.toLocaleUpperCase("cs"));
  const taken = new Set(existing.map((name) => name.trim().toLocaleLowerCase("cs")));
  const sameSport = existing.filter((name) => name.trim().toLocaleLowerCase("cs").startsWith(prefix.toLocaleLowerCase("cs"))).length;
  let number = sameSport + 1;
  while (taken.has(`${prefix} ${number}`.toLocaleLowerCase("cs"))) number += 1;
  return `${prefix} ${number}`;
}

export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function dayOfWeekOf(date: string): DayOfWeek {
  const [year, month, day] = date.split("-").map(Number);
  return (((new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7) + 1) as DayOfWeek;
}

export function hourRange(ranges: { start: string; end: string }[], fallback: [number, number] = [8, 22]): number[] {
  const starts = ranges.map(({ start }) => Number(start.slice(0, 2)));
  const ends = ranges.map(({ end }) => Number(end.slice(0, 2)) + (end.slice(3) === "00" ? 0 : 1));
  const from = starts.length > 0 ? Math.min(...starts) : fallback[0];
  const to = ends.length > 0 ? Math.max(...ends) : fallback[1];
  return Array.from({ length: Math.max(0, to - from) }, (_, index) => from + index);
}
