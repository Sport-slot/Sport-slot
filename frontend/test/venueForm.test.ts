import { describe, expect, it } from "vitest";
import {
  emptyVenueForm,
  venueChanges,
  venueFormFromDetail,
  hasErrors,
  hoursPresets,
  isDirty,
  summarizeHours,
  toVenueCreateDtoIn,
  validateVenueForm,
} from "@/lib/venueForm";

function filledForm() {
  return { ...emptyVenueForm(), name: " Sportcentrum ", address: "Hlavní 1", city: "Praha" };
}

describe("validateVenueForm", () => {
  it("requires name, address and city", () => {
    const errors = validateVenueForm(emptyVenueForm());
    expect(errors.name).toBe("Pole je povinné.");
    expect(errors.address).toBe("Pole je povinné.");
    expect(errors.city).toBe("Pole je povinné.");
    expect(hasErrors(errors)).toBe(true);
  });

  it("accepts a filled form", () => {
    expect(hasErrors(validateVenueForm(filledForm()))).toBe(false);
  });

  it("rejects too long name", () => {
    const errors = validateVenueForm({ ...filledForm(), name: "a".repeat(101) });
    expect(errors.name).toBe("Maximálně 100 znaků.");
  });

  it("rejects closing time before opening time", () => {
    const form = filledForm();
    form.hours[1] = { open: true, openTime: "20:00", closeTime: "08:00" };
    expect(validateVenueForm(form).days?.[1]).toBe("Zavírací čas musí být po otevíracím.");
  });

  it("requires at least one open day", () => {
    const form = filledForm();
    for (const day of [1, 2, 3, 4, 5, 6, 7] as const) form.hours[day].open = false;
    expect(validateVenueForm(form).hours).toBeDefined();
  });
});

describe("toVenueCreateDtoIn", () => {
  it("trims text, omits empty description and skips closed days", () => {
    const form = filledForm();
    form.hours[7].open = false;
    const dtoIn = toVenueCreateDtoIn(form);
    expect(dtoIn.name).toBe("Sportcentrum");
    expect(dtoIn).not.toHaveProperty("description");
    expect(dtoIn.openingHoursList).toHaveLength(6);
    expect(dtoIn.openingHoursList[0]).toEqual({ dayOfWeek: 1, openTime: "08:00", closeTime: "22:00" });
  });
});

describe("summarizeHours", () => {
  it("groups consecutive days with the same hours", () => {
    const weekdays = hoursPresets.find((preset) => preset.id === "weekdays")!;
    expect(summarizeHours(weekdays.hours)).toEqual([
      { days: "Po až Pá", time: "08:00 - 20:00" },
      { days: "So až Ne", time: "Zavřeno" },
    ]);
  });
});

describe("isDirty", () => {
  it("is false for an untouched form and true after typing", () => {
    expect(isDirty(emptyVenueForm())).toBe(false);
    expect(isDirty({ ...emptyVenueForm(), city: "Brno" })).toBe(true);
  });
});

describe("venue editing", () => {
  const detail = {
    name: "Padel Arena",
    address: "Nádražní 52",
    city: "Praha",
    description: null,
    openingHours: [
      { dayOfWeek: 1 as const, openTime: "07:00", closeTime: "23:00" },
      { dayOfWeek: 6 as const, openTime: "09:00", closeTime: "20:00" },
    ],
  };

  it("fills the form from the venue detail", () => {
    const values = venueFormFromDetail(detail);
    expect(values.description).toBe("");
    expect(values.hours[1]).toEqual({ open: true, openTime: "07:00", closeTime: "23:00" });
    expect(values.hours[2].open).toBe(false);
    expect(values.hours[6]).toEqual({ open: true, openTime: "09:00", closeTime: "20:00" });
  });

  it("returns only the changed fields", () => {
    const initial = venueFormFromDetail(detail);
    expect(venueChanges(initial, initial)).toEqual({});

    const changed = { ...initial, name: " Padel Arena Smíchov ", hours: { ...initial.hours, 2: { open: true, openTime: "08:00", closeTime: "22:00" } } };
    expect(venueChanges(initial, changed)).toEqual({
      name: "Padel Arena Smíchov",
      openingHoursList: [
        { dayOfWeek: 1, openTime: "07:00", closeTime: "23:00" },
        { dayOfWeek: 2, openTime: "08:00", closeTime: "22:00" },
        { dayOfWeek: 6, openTime: "09:00", closeTime: "20:00" },
      ],
    });
  });

  it("clears the description with null", () => {
    const initial = venueFormFromDetail({ ...detail, description: "Krytá hala" });
    expect(venueChanges(initial, { ...initial, description: "  " })).toEqual({ description: null });
  });
});
