import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as Auth from "@/lib/auth";
import type * as Courts from "@/lib/courts";
import type * as PriceRules from "@/lib/priceRules";
import type * as Reservations from "@/lib/reservations";
import { FreeSlots } from "@/components/FreeSlots";
import { ApiError } from "@/lib/api";
import type { CourtAvailability } from "@/lib/courts";
import type { Court } from "@/lib/venues";

const api = vi.hoisted(() => ({
  getCourtAvailability: vi.fn(),
  listPriceRules: vi.fn(),
  createReservation: vi.fn(),
  openLogin: vi.fn(),
  user: null as { roles: string[] } | null,
}));

vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof Auth>()),
  useAuth: () => ({ user: api.user, loading: false, openLogin: api.openLogin }),
}));
vi.mock("@/lib/courts", async (importOriginal) => ({
  ...(await importOriginal<typeof Courts>()),
  getCourtAvailability: api.getCourtAvailability,
}));
vi.mock("@/lib/priceRules", async (importOriginal) => ({
  ...(await importOriginal<typeof PriceRules>()),
  listPriceRules: api.listPriceRules,
}));
vi.mock("@/lib/reservations", async (importOriginal) => ({
  ...(await importOriginal<typeof Reservations>()),
  createReservation: api.createReservation,
}));

const courts: Court[] = [
  { id: "c1", name: "Kurt 1", sport: "tenis", surface: "Antuka", indoor: false },
  { id: "c2", name: "Kurt 2", sport: "padel", surface: "Tvrdý povrch", indoor: true },
];

function day(courtId: string, date: string, overrides: Partial<CourtAvailability> = {}): CourtAvailability {
  return {
    courtId,
    venueId: "v1",
    date,
    dayOfWeek: 1,
    openTime: "09:00",
    closeTime: "19:00",
    slotList: [
      { startTime: "09:00", endTime: "10:00", startAt: "2099-01-05T08:00:00.000Z", endAt: "2099-01-05T09:00:00.000Z", free: true },
      { startTime: "13:00", endTime: "14:00", startAt: "2099-01-05T12:00:00.000Z", endAt: "2099-01-05T13:00:00.000Z", free: false },
      { startTime: "18:00", endTime: "19:00", startAt: "2020-01-05T17:00:00.000Z", endAt: "2020-01-05T18:00:00.000Z", free: false },
    ],
    uuAppErrorMap: {},
    ...overrides,
  };
}

function twoFreeHours(courtId: string, date: string): CourtAvailability {
  return day(courtId, date, {
    slotList: [
      { startTime: "09:00", endTime: "10:00", startAt: "2099-01-05T08:00:00.000Z", endAt: "2099-01-05T09:00:00.000Z", free: true },
      { startTime: "10:00", endTime: "11:00", startAt: "2099-01-05T09:00:00.000Z", endAt: "2099-01-05T10:00:00.000Z", free: true },
      { startTime: "11:00", endTime: "12:00", startAt: "2099-01-05T10:00:00.000Z", endAt: "2099-01-05T11:00:00.000Z", free: false },
    ],
  });
}

beforeEach(() => {
  api.getCourtAvailability.mockReset();
  api.listPriceRules.mockReset();
  api.createReservation.mockReset();
  api.openLogin.mockReset();
  api.user = null;
  api.getCourtAvailability.mockImplementation(async (courtId: string, date: string) => day(courtId, date));
  api.listPriceRules.mockResolvedValue([{ id: "r1", courtId: "c1", dayOfWeek: 1, startTime: "08:00", endTime: "20:00", pricePerHour: 450 }]);
});

describe("FreeSlots", () => {
  it("shows the day's slots grouped by part of day with prices", async () => {
    render(<FreeSlots courts={courts} />);

    const morning = await screen.findByRole("list", { name: "Termíny: Dopoledne" });
    expect(morning.textContent).toContain("09:00–10:00Volné");
    expect(await screen.findByText("450 Kč")).toBeTruthy();
    expect(screen.getByRole("list", { name: "Termíny: Odpoledne" }).textContent).toContain("Obsazeno");
    expect(screen.getByRole("list", { name: "Termíny: Večer" }).textContent).toContain("Proběhlo");
    expect(screen.getByText(/volných 1 z 3 hodin/)).toBeTruthy();
    expect(api.getCourtAvailability).toHaveBeenCalledTimes(1);
  });

  it("loads another day from the date strip", async () => {
    const user = userEvent.setup();
    render(<FreeSlots courts={courts} />);
    await screen.findByRole("list", { name: "Termíny: Dopoledne" });

    const days = screen.getAllByRole("button", { pressed: false }).filter((button) => button.closest('[aria-label="Den"]'));
    await user.click(days[0]);

    await screen.findByRole("list", { name: "Termíny: Dopoledne" });
    expect(api.getCourtAvailability).toHaveBeenCalledTimes(2);
    expect(api.getCourtAvailability.mock.calls[1][1]).not.toBe(api.getCourtAvailability.mock.calls[0][1]);
  });

  it("loads the selected court", async () => {
    const user = userEvent.setup();
    render(<FreeSlots courts={courts} />);
    await screen.findByRole("list", { name: "Termíny: Dopoledne" });

    await user.click(screen.getByRole("button", { name: "Kurt 2" }));

    await screen.findByRole("list", { name: "Termíny: Dopoledne" });
    expect(api.getCourtAvailability).toHaveBeenLastCalledWith("c2", expect.any(String));
    expect(api.listPriceRules).toHaveBeenLastCalledWith("c2");
  });

  it("says when the court is closed that day", async () => {
    api.getCourtAvailability.mockImplementation(async (courtId: string, date: string) => day(courtId, date, { openTime: null, closeTime: null, slotList: [] }));
    render(<FreeSlots courts={courts} />);

    expect(await screen.findByText("Tento den je kurt zavřený. Vyberte jiný den.")).toBeTruthy();
  });

  it("shows the API error and retries", async () => {
    api.getCourtAvailability.mockRejectedValueOnce(new ApiError(404, "court/availability/courtDoesNotExist", "Kurt neexistuje."));
    const user = userEvent.setup();
    render(<FreeSlots courts={courts} />);

    expect((await screen.findByRole("alert")).textContent).toContain("Kurt neexistuje.");
    await user.click(screen.getByRole("button", { name: /Zkusit znovu/ }));
    expect(await screen.findByRole("list", { name: "Termíny: Dopoledne" })).toBeTruthy();
  });

  it("asks a visitor to sign in before booking", async () => {
    api.getCourtAvailability.mockImplementation(async (courtId: string, date: string) => twoFreeHours(courtId, date));
    const user = userEvent.setup();
    render(<FreeSlots courts={courts} />);

    await user.click(await screen.findByRole("button", { name: /09:00–10:00/ }));
    await user.click(screen.getByRole("button", { name: "Potvrdit rezervaci" }));

    expect(api.openLogin).toHaveBeenCalledWith(expect.stringContaining("po přihlášení"));
    expect(api.createReservation).not.toHaveBeenCalled();
  });

  it("books the selected hours in one reservation and shows its number", async () => {
    api.user = { roles: ["PLAYER"] };
    api.getCourtAvailability.mockImplementation(async (courtId: string, date: string) => twoFreeHours(courtId, date));
    api.createReservation.mockResolvedValue({
      id: "r-1",
      courtId: "c1",
      startAt: "2099-01-05T08:00:00.000Z",
      endAt: "2099-01-05T10:00:00.000Z",
      totalPrice: 900,
      status: "ACTIVE",
    });
    const user = userEvent.setup();
    render(<FreeSlots courts={courts} />);

    await user.click(await screen.findByRole("button", { name: /09:00–10:00/ }));
    await user.click(screen.getByRole("button", { name: /10:00–11:00/ }));
    expect(screen.getByText(/\(2 h\)/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Potvrdit rezervaci" }));

    expect(api.createReservation).toHaveBeenCalledWith({ courtId: "c1", startAt: "2099-01-05T08:00:00.000Z", endAt: "2099-01-05T10:00:00.000Z" });
    expect(await screen.findByText(/Číslo rezervace: r-1/)).toBeTruthy();
    expect(api.getCourtAvailability).toHaveBeenCalledTimes(2);
  });

  it("drops the selection and reloads the day when the slot was taken", async () => {
    api.user = { roles: ["PLAYER"] };
    api.getCourtAvailability.mockImplementation(async (courtId: string, date: string) => twoFreeHours(courtId, date));
    api.createReservation.mockRejectedValueOnce(new ApiError(409, "reservation/create/slotNotAvailable", "Termín je obsazený."));
    const user = userEvent.setup();
    render(<FreeSlots courts={courts} />);

    await user.click(await screen.findByRole("button", { name: /09:00–10:00/ }));
    await user.click(screen.getByRole("button", { name: "Potvrdit rezervaci" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Tenhle termín už není volný");
    expect(api.getCourtAvailability).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("button", { name: "Potvrdit rezervaci" })).toBeNull();
  });
});
