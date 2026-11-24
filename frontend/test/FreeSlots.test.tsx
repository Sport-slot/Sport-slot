import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as Courts from "@/lib/courts";
import type * as PriceRules from "@/lib/priceRules";
import { FreeSlots } from "@/components/FreeSlots";
import { ApiError } from "@/lib/api";
import type { CourtAvailability } from "@/lib/courts";
import type { Court } from "@/lib/venues";

const api = vi.hoisted(() => ({ getCourtAvailability: vi.fn(), listPriceRules: vi.fn() }));

vi.mock("@/lib/courts", async (importOriginal) => ({
  ...(await importOriginal<typeof Courts>()),
  getCourtAvailability: api.getCourtAvailability,
}));
vi.mock("@/lib/priceRules", async (importOriginal) => ({
  ...(await importOriginal<typeof PriceRules>()),
  listPriceRules: api.listPriceRules,
}));

const courts: Court[] = [
  { id: "c1", name: "Kurt 1", sport: "tenis", surface: "Antuka", indoor: false },
  { id: "c2", name: "Kurt 2", sport: "padel", surface: "Tvrdý povrch", indoor: true },
];

function futureDay(courtId: string, date: string): CourtAvailability {
  return {
    courtId,
    venueId: "v1",
    date,
    dayOfWeek: 1,
    openTime: "07:00",
    closeTime: "09:00",
    slotList: [
      { startTime: "07:00", endTime: "08:00", startAt: "2099-01-01T06:00:00.000Z", endAt: "2099-01-01T07:00:00.000Z", free: true },
      { startTime: "08:00", endTime: "09:00", startAt: "2099-01-01T07:00:00.000Z", endAt: "2099-01-01T08:00:00.000Z", free: false },
    ],
    uuAppErrorMap: {},
  };
}

beforeEach(() => {
  api.getCourtAvailability.mockReset();
  api.listPriceRules.mockReset();
  api.getCourtAvailability.mockImplementation(async (courtId: string, date: string) => futureDay(courtId, date));
  api.listPriceRules.mockResolvedValue([{ id: "r1", courtId: "c1", dayOfWeek: 1, startTime: "07:00", endTime: "09:00", pricePerHour: 450 }]);
});

describe("FreeSlots", () => {
  it("shows a week calendar with prices for free hours", async () => {
    render(<FreeSlots courts={courts} />);

    const table = await screen.findByRole("table");
    expect(within(table).getAllByRole("columnheader")).toHaveLength(8);
    expect(within(table).getAllByText("450 Kč").length).toBe(7);
    expect(within(table).getAllByText("Obsazeno").length).toBe(7);
    expect(api.getCourtAvailability).toHaveBeenCalledTimes(7);
  });

  it("loads the selected court", async () => {
    const user = userEvent.setup();
    render(<FreeSlots courts={courts} />);
    await screen.findByRole("table");

    await user.click(screen.getByRole("tab", { name: "Kurt 2" }));

    await screen.findByRole("table");
    expect(api.getCourtAvailability).toHaveBeenLastCalledWith("c2", expect.any(String));
    expect(api.listPriceRules).toHaveBeenLastCalledWith("c2");
  });

  it("moves to the next week and back to today", async () => {
    const user = userEvent.setup();
    render(<FreeSlots courts={courts} />);
    await screen.findByRole("table");
    expect(screen.getByRole("button", { name: "Předchozí týden" }).hasAttribute("disabled")).toBe(true);

    await user.click(screen.getByRole("button", { name: "Další týden" }));
    await screen.findByRole("table");
    expect(api.getCourtAvailability).toHaveBeenCalledTimes(14);

    await user.click(screen.getByRole("button", { name: "Dnes" }));
    await screen.findByRole("table");
    expect(screen.getByRole("button", { name: "Předchozí týden" }).hasAttribute("disabled")).toBe(true);
  });

  it("says when the court is closed all week", async () => {
    api.getCourtAvailability.mockImplementation(async (courtId: string, date: string) => ({ ...futureDay(courtId, date), openTime: null, closeTime: null, slotList: [] }));
    render(<FreeSlots courts={courts} />);

    expect(await screen.findByText("Kurt je tento týden zavřený.")).toBeTruthy();
  });

  it("shows the API error and retries", async () => {
    api.getCourtAvailability.mockRejectedValueOnce(new ApiError(404, "court/availability/courtDoesNotExist", "Kurt neexistuje."));
    const user = userEvent.setup();
    render(<FreeSlots courts={courts} />);

    expect((await screen.findByRole("alert")).textContent).toContain("Kurt neexistuje.");
    await user.click(screen.getByRole("button", { name: /Zkusit znovu/ }));
    expect(await screen.findByRole("table")).toBeTruthy();
  });
});
