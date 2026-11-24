import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as Courts from "@/lib/courts";
import { FreeSlots } from "@/components/FreeSlots";
import { ApiError } from "@/lib/api";
import type { CourtAvailability } from "@/lib/courts";
import type { Court } from "@/lib/venues";

const api = vi.hoisted(() => ({ getCourtAvailability: vi.fn() }));

vi.mock("@/lib/courts", async (importOriginal) => ({
  ...(await importOriginal<typeof Courts>()),
  getCourtAvailability: api.getCourtAvailability,
}));

const courts: Court[] = [
  { id: "c1", name: "Kurt 1", sport: "tenis", surface: "Antuka", indoor: false },
  { id: "c2", name: "Kurt 2", sport: "padel", surface: "Tvrdý povrch", indoor: true },
];

function availability(overrides: Partial<CourtAvailability>): CourtAvailability {
  return {
    courtId: "c1",
    venueId: "v1",
    date: "2026-11-29",
    dayOfWeek: 7,
    openTime: "07:00",
    closeTime: "09:00",
    slotList: [
      { startTime: "07:00", endTime: "08:00", startAt: "2026-11-29T06:00:00.000Z", endAt: "2026-11-29T07:00:00.000Z", free: true },
      { startTime: "08:00", endTime: "09:00", startAt: "2026-11-29T07:00:00.000Z", endAt: "2026-11-29T08:00:00.000Z", free: false },
    ],
    uuAppErrorMap: {},
    ...overrides,
  };
}

beforeEach(() => {
  api.getCourtAvailability.mockReset();
});

describe("FreeSlots", () => {
  it("shows free and occupied hours of the first court for today", async () => {
    api.getCourtAvailability.mockResolvedValue(availability({}));
    render(<FreeSlots courts={courts} />);

    const list = await screen.findByRole("list", { name: "Termíny" });
    expect(list.textContent).toContain("07:00–08:00Volné");
    expect(list.textContent).toContain("08:00–09:00Obsazeno");
    expect(api.getCourtAvailability).toHaveBeenCalledWith("c1", expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
  });

  it("loads the newly selected court", async () => {
    api.getCourtAvailability.mockResolvedValue(availability({}));
    render(<FreeSlots courts={courts} />);
    await screen.findByRole("list", { name: "Termíny" });

    await userEvent.setup().selectOptions(screen.getByRole("combobox", { name: "Kurt" }), "c2");

    expect(await screen.findByRole("list", { name: "Termíny" })).toBeTruthy();
    expect(api.getCourtAvailability).toHaveBeenLastCalledWith("c2", expect.any(String));
  });

  it("labels past hours as over instead of occupied", async () => {
    api.getCourtAvailability.mockResolvedValue(availability({
      slotList: [
        { startTime: "07:00", endTime: "08:00", startAt: "2020-01-01T06:00:00.000Z", endAt: "2020-01-01T07:00:00.000Z", free: false },
      ],
    }));
    render(<FreeSlots courts={courts} />);

    expect((await screen.findByRole("list", { name: "Termíny" })).textContent).toContain("07:00–08:00Proběhlo");
  });

  it("says when the court is closed that day", async () => {
    api.getCourtAvailability.mockResolvedValue(availability({ openTime: null, closeTime: null, slotList: [] }));
    render(<FreeSlots courts={courts} />);

    expect(await screen.findByText("Tento den je kurt zavřený.")).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Termíny" })).toBeNull();
  });

  it("shows the API error and retries", async () => {
    api.getCourtAvailability
      .mockRejectedValueOnce(new ApiError(404, "court/availability/courtDoesNotExist", "Kurt neexistuje."))
      .mockResolvedValueOnce(availability({}));
    render(<FreeSlots courts={courts} />);

    expect((await screen.findByRole("alert")).textContent).toContain("Kurt neexistuje.");
    await userEvent.setup().click(screen.getByRole("button", { name: "Zkusit znovu" }));
    expect(await screen.findByRole("list", { name: "Termíny" })).toBeTruthy();
    expect(api.getCourtAvailability).toHaveBeenCalledTimes(2);
  });
});
