import type { DayOfWeek, VenueCreateDtoIn } from "@/lib/api";

export const venueLimits = {
  name: 100,
  address: 200,
  city: 100,
  description: 2000,
} as const;

export const dayNames: Record<DayOfWeek, string> = {
  1: "Pondělí",
  2: "Úterý",
  3: "Středa",
  4: "Čtvrtek",
  5: "Pátek",
  6: "Sobota",
  7: "Neděle",
};

export const daysOfWeek = Object.keys(dayNames).map(Number) as DayOfWeek[];

export type DayHours = {
  open: boolean;
  openTime: string;
  closeTime: string;
};

export type VenueFormValues = {
  name: string;
  address: string;
  city: string;
  description: string;
  hours: Record<DayOfWeek, DayHours>;
};

export type VenueFormErrors = Partial<
  Record<"name" | "address" | "city" | "description" | "hours", string>
> & { days?: Partial<Record<DayOfWeek, string>> };

export function emptyVenueForm(): VenueFormValues {
  const hours = Object.fromEntries(
    daysOfWeek.map((day) => [
      day,
      { open: true, openTime: "08:00", closeTime: "22:00" },
    ]),
  ) as Record<DayOfWeek, DayHours>;
  return { name: "", address: "", city: "", description: "", hours };
}

function requiredText(value: string, limit: number): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return "Pole je povinné.";
  }
  if (trimmed.length > limit) {
    return `Maximálně ${limit} znaků.`;
  }
  return undefined;
}

export function validateVenueForm(values: VenueFormValues): VenueFormErrors {
  const errors: VenueFormErrors = {};
  const name = requiredText(values.name, venueLimits.name);
  const address = requiredText(values.address, venueLimits.address);
  const city = requiredText(values.city, venueLimits.city);
  if (name) errors.name = name;
  if (address) errors.address = address;
  if (city) errors.city = city;
  if (values.description.trim().length > venueLimits.description) {
    errors.description = `Maximálně ${venueLimits.description} znaků.`;
  }

  const days: Partial<Record<DayOfWeek, string>> = {};
  for (const day of daysOfWeek) {
    const { open, openTime, closeTime } = values.hours[day];
    if (!open) continue;
    if (!openTime || !closeTime) {
      days[day] = "Vyplňte čas otevření i zavření.";
    } else if (closeTime <= openTime) {
      days[day] = "Zavírací čas musí být po otevíracím.";
    }
  }
  if (Object.keys(days).length > 0) {
    errors.days = days;
  }
  if (!daysOfWeek.some((day) => values.hours[day].open)) {
    errors.hours = "Sportoviště musí být otevřené alespoň jeden den v týdnu.";
  }
  return errors;
}

export function hasErrors(errors: VenueFormErrors): boolean {
  return Object.keys(errors).length > 0;
}

export function toVenueCreateDtoIn(values: VenueFormValues): VenueCreateDtoIn {
  const description = values.description.trim();
  return {
    name: values.name.trim(),
    address: values.address.trim(),
    city: values.city.trim(),
    ...(description ? { description } : {}),
    openingHoursList: daysOfWeek
      .filter((day) => values.hours[day].open)
      .map((day) => ({
        dayOfWeek: day,
        openTime: values.hours[day].openTime,
        closeTime: values.hours[day].closeTime,
      })),
  };
}

export type HoursPreset = {
  id: string;
  label: string;
  hours: Record<DayOfWeek, DayHours>;
};

function presetHours(weekday: [string, string], weekend: [string, string] | null): Record<DayOfWeek, DayHours> {
  return Object.fromEntries(
    daysOfWeek.map((day) => {
      const range = day >= 6 ? weekend : weekday;
      return [day, range ? { open: true, openTime: range[0], closeTime: range[1] } : { open: false, openTime: "08:00", closeTime: "22:00" }];
    }),
  ) as Record<DayOfWeek, DayHours>;
}

export const hoursPresets: HoursPreset[] = [
  { id: "daily", label: "Denně 8-22", hours: presetHours(["08:00", "22:00"], ["08:00", "22:00"]) },
  { id: "weekend-short", label: "Všední dny 7-22, víkend 9-20", hours: presetHours(["07:00", "22:00"], ["09:00", "20:00"]) },
  { id: "weekdays", label: "Jen všední dny 8-20", hours: presetHours(["08:00", "20:00"], null) },
];

export function sameHours(a: Record<DayOfWeek, DayHours>, b: Record<DayOfWeek, DayHours>): boolean {
  return daysOfWeek.every(
    (day) =>
      a[day].open === b[day].open &&
      (!a[day].open || (a[day].openTime === b[day].openTime && a[day].closeTime === b[day].closeTime)),
  );
}

export function summarizeHours(hours: Record<DayOfWeek, DayHours>): { days: string; time: string }[] {
  const groups: { from: DayOfWeek; to: DayOfWeek; time: string }[] = [];
  for (const day of daysOfWeek) {
    const { open, openTime, closeTime } = hours[day];
    const time = open ? `${openTime} - ${closeTime}` : "Zavřeno";
    const last = groups.at(-1);
    if (last && last.time === time && last.to === day - 1) {
      last.to = day;
    } else {
      groups.push({ from: day, to: day, time });
    }
  }
  const short: Record<DayOfWeek, string> = { 1: "Po", 2: "Út", 3: "St", 4: "Čt", 5: "Pá", 6: "So", 7: "Ne" };
  return groups.map(({ from, to, time }) => ({
    days: from === to ? dayNames[from] : `${short[from]} až ${short[to]}`,
    time,
  }));
}

export function isDirty(values: VenueFormValues): boolean {
  const empty = emptyVenueForm();
  return (
    Boolean(values.name.trim() || values.address.trim() || values.city.trim() || values.description.trim()) ||
    !sameHours(values.hours, empty.hours)
  );
}
