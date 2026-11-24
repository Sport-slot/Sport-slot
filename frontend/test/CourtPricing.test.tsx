import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as PriceRules from "@/lib/priceRules";
import { CourtPricing } from "@/components/court-form/CourtPricing";
import { ApiError } from "@/lib/api";
import type { VenueDetail } from "@/lib/venues";

const api = vi.hoisted(() => ({ getVenue: vi.fn(), listPriceRules: vi.fn(), createPriceRule: vi.fn() }));

vi.mock("@/lib/venues", () => ({ getVenue: api.getVenue }));
vi.mock("@/lib/priceRules", async (importOriginal) => ({
  ...(await importOriginal<typeof PriceRules>()),
  listPriceRules: api.listPriceRules,
  createPriceRule: api.createPriceRule,
}));

function venue(overrides: Partial<VenueDetail> = {}): VenueDetail {
  return {
    id: "v1",
    name: "Padel Arena",
    address: "Nádražní 1",
    city: "Praha",
    active: true,
    isOwner: true,
    openingHours: [{ dayOfWeek: 1, openTime: "07:00", closeTime: "22:00" }],
    courts: [{ id: "c1", name: "Kurt 1", sport: "padel", surface: "Umělá tráva", indoor: true }],
    ...overrides,
  } as VenueDetail;
}

beforeEach(() => {
  api.getVenue.mockReset();
  api.listPriceRules.mockReset();
  api.createPriceRule.mockReset();
});

describe("CourtPricing", () => {
  it("shows the existing price list grouped by day", async () => {
    api.getVenue.mockResolvedValue(venue());
    api.listPriceRules.mockResolvedValue([{ id: "r1", courtId: "c1", dayOfWeek: 1, startTime: "07:00", endTime: "16:00", pricePerHour: 300 }]);
    render(<CourtPricing venueId="v1" courtId="c1" />);

    expect(await screen.findByRole("heading", { name: "Ceník kurtu" })).toBeTruthy();
    const calendar = screen.getByRole("region", { name: "Týdenní ceník Kurt 1" });
    expect(within(calendar).getByText("07:00–16:00")).toBeTruthy();
    expect(calendar.textContent).toContain("300");
    expect(screen.queryByText(/Překrývá se/)).toBeNull();
  });

  it("creates one rule per selected day", async () => {
    api.getVenue.mockResolvedValue(venue());
    api.listPriceRules.mockResolvedValue([]);
    api.createPriceRule.mockImplementation(async (dtoIn) => ({ id: `r${dtoIn.dayOfWeek}`, ...dtoIn }));
    const user = userEvent.setup();
    render(<CourtPricing venueId="v1" courtId="c1" />);

    await user.click(await screen.findByRole("button", { name: "Víkend" }));
    await user.type(screen.getByRole("textbox", { name: "Cena za hodinu" }), "450");
    await user.click(screen.getByRole("button", { name: "Přidat do ceníku" }));

    expect(await screen.findByText(/Uloženo: So, Ne 07:00–22:00/)).toBeTruthy();
    expect(api.createPriceRule).toHaveBeenCalledTimes(2);
    expect(api.createPriceRule).toHaveBeenCalledWith({ courtId: "c1", dayOfWeek: 6, startTime: "07:00", endTime: "22:00", pricePerHour: 450 });
    expect((screen.getByRole("textbox", { name: "Cena za hodinu" }) as HTMLInputElement).value).toBe("450");
  });

  it("blocks a rule overlapping the existing price list", async () => {
    api.getVenue.mockResolvedValue(venue());
    api.listPriceRules.mockResolvedValue([{ id: "r1", courtId: "c1", dayOfWeek: 1, startTime: "07:00", endTime: "16:00", pricePerHour: 300 }]);
    const user = userEvent.setup();
    render(<CourtPricing venueId="v1" courtId="c1" />);

    expect((await screen.findByRole("checkbox", { name: "Pondělí" }) as HTMLInputElement).checked).toBe(true);
    await user.clear(screen.getByLabelText("Od"));
    await user.type(screen.getByLabelText("Od"), "10:00");
    await user.type(screen.getByRole("textbox", { name: "Cena za hodinu" }), "500");
    await user.click(screen.getByRole("button", { name: "Přidat do ceníku" }));

    expect(screen.getByText(/Překrývá se s Po 07:00–16:00/)).toBeTruthy();
    expect(api.createPriceRule).not.toHaveBeenCalled();
  });

  it("prefills the form from a gap without a price", async () => {
    api.getVenue.mockResolvedValue(venue({ openingHours: [{ dayOfWeek: 1, openTime: "07:00", closeTime: "22:00" }, { dayOfWeek: 3, openTime: "08:00", closeTime: "20:00" }] }));
    api.listPriceRules.mockResolvedValue([{ id: "r1", courtId: "c1", dayOfWeek: 1, startTime: "07:00", endTime: "16:00", pricePerHour: 300 }]);
    const user = userEvent.setup();
    render(<CourtPricing venueId="v1" courtId="c1" />);

    await user.click(await screen.findByRole("button", { name: "Středa 08:00–20:00 bez ceny, nastavit cenu" }));

    expect((screen.getByRole("checkbox", { name: "Středa" }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("checkbox", { name: "Pondělí" }) as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText("Od") as HTMLInputElement).value).toBe("08:00");
    expect((screen.getByLabelText("Do") as HTMLInputElement).value).toBe("20:00");
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Cena za hodinu" })));
    expect(screen.getByText("2 úseky bez ceny")).toBeTruthy();
  });

  it("shows the server error when saving fails", async () => {
    api.getVenue.mockResolvedValue(venue());
    api.listPriceRules.mockResolvedValue([]);
    api.createPriceRule.mockRejectedValue(new ApiError(409, "priceRule/create/priceRuleOverlap", "Pravidlo se překrývá s existujícím pravidlem."));
    const user = userEvent.setup();
    render(<CourtPricing venueId="v1" courtId="c1" />);

    await user.click(await screen.findByRole("button", { name: "Celý týden" }));
    await user.type(screen.getByRole("textbox", { name: "Cena za hodinu" }), "400");
    await user.click(screen.getByRole("button", { name: "Přidat do ceníku" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Pravidlo se překrývá s existujícím pravidlem.");
  });

  it("refuses a manager who does not own the venue", async () => {
    api.getVenue.mockResolvedValue(venue({ isOwner: false }));
    api.listPriceRules.mockResolvedValue([]);
    render(<CourtPricing venueId="v1" courtId="c1" />);

    expect(await screen.findByRole("heading", { name: "Ceník nemůžete upravit" })).toBeTruthy();
  });
});
