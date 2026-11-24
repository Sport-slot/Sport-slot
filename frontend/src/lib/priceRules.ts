import { apiBaseUrl, authHeaders, toApiError, type DayOfWeek, type UuAppErrorMap } from "@/lib/api";
import { daysOfWeek } from "@/lib/venueForm";

export const maxPricePerHour = 99999999.99;

export type PriceRule = {
  id: string;
  courtId: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  pricePerHour: number;
};

export type PriceRuleCreateDtoIn = Omit<PriceRule, "id">;

export type PriceRuleList = {
  courtId: string;
  itemList: PriceRule[];
  uuAppErrorMap: UuAppErrorMap;
};

export async function listPriceRules(courtId: string): Promise<PriceRule[]> {
  const response = await fetch(`${apiBaseUrl}/priceRule/listByCourt?${new URLSearchParams({ courtId })}`);
  if (!response.ok) {
    throw await toApiError(response);
  }
  return ((await response.json()) as PriceRuleList).itemList;
}

export async function createPriceRule(dtoIn: PriceRuleCreateDtoIn): Promise<PriceRule> {
  const response = await fetch(`${apiBaseUrl}/priceRule/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(dtoIn),
  });
  if (!response.ok) {
    throw await toApiError(response);
  }
  return (await response.json()) as PriceRule;
}

export type PriceRuleFormValues = {
  days: DayOfWeek[];
  startTime: string;
  endTime: string;
  price: string;
};

export type PriceRuleFormErrors = Partial<Record<"days" | "time" | "price", string>>;

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export function parsePrice(value: string): number | null {
  const normalized = value.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const price = Number(normalized);
  return price <= maxPricePerHour ? price : null;
}

export function findOverlap(rules: PriceRule[], dayOfWeek: DayOfWeek, startTime: string, endTime: string): PriceRule | undefined {
  return rules.find((rule) => rule.dayOfWeek === dayOfWeek && rule.startTime < endTime && startTime < rule.endTime);
}

export function validatePriceRule(values: PriceRuleFormValues): PriceRuleFormErrors {
  const errors: PriceRuleFormErrors = {};
  if (values.days.length === 0) errors.days = "Vyberte alespoň jeden den.";
  if (!timePattern.test(values.startTime) || !timePattern.test(values.endTime)) {
    errors.time = "Vyplňte čas od i do.";
  } else if (values.startTime >= values.endTime) {
    errors.time = "Čas od musí být dřív než čas do.";
  }
  if (!values.price.trim()) errors.price = "Vyplňte cenu za hodinu.";
  else if (parsePrice(values.price) === null) errors.price = "Zadejte nezápornou částku v Kč, nejvýše se dvěma desetinnými místy.";
  return errors;
}

export function sortPriceRules(rules: PriceRule[]): PriceRule[] {
  return [...rules].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime));
}

export function rulesByDay(rules: PriceRule[]): { dayOfWeek: DayOfWeek; rules: PriceRule[] }[] {
  const sorted = sortPriceRules(rules);
  return daysOfWeek.map((dayOfWeek) => ({ dayOfWeek, rules: sorted.filter((rule) => rule.dayOfWeek === dayOfWeek) }));
}

const priceFormat = new Intl.NumberFormat("cs-CZ", { style: "currency", currency: "CZK", minimumFractionDigits: 0, maximumFractionDigits: 2 });

export function formatPrice(price: number): string {
  return priceFormat.format(price);
}

export function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function priceGaps(openTime: string, closeTime: string, dayRules: PriceRule[]): { startTime: string; endTime: string }[] {
  const gaps: { startTime: string; endTime: string }[] = [];
  let cursor = openTime;
  for (const rule of sortPriceRules(dayRules)) {
    if (rule.endTime <= cursor) continue;
    if (rule.startTime > cursor && cursor < closeTime) gaps.push({ startTime: cursor, endTime: rule.startTime < closeTime ? rule.startTime : closeTime });
    if (rule.endTime > cursor) cursor = rule.endTime;
  }
  if (cursor < closeTime) gaps.push({ startTime: cursor, endTime: closeTime });
  return gaps;
}
