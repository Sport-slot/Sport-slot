import { render, screen, within } from "@testing-library/react";
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

    expect(await screen.findByRole("heading", { name: "Ceník: Kurt 1" })).toBeTruthy();
    const list = screen.getByRole("complementary");
    expect(within(list).getByText("07:00–16:00")).toBeTruthy();
    expect(list.textContent).toContain("300");
    expect(screen.getByRole("textbox", { name: "Cena za hodinu" })).toBeTruthy();
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
    expect(screen.getAllByText("Nové")).toHaveLength(2);
  });

  it("blocks a rule overlapping the existing price list", async () => {
    api.getVenue.mockResolvedValue(venue());
    api.listPriceRules.mockResolvedValue([{ id: "r1", courtId: "c1", dayOfWeek: 1, startTime: "07:00", endTime: "16:00", pricePerHour: 300 }]);
    const user = userEvent.setup();
    render(<CourtPricing venueId="v1" courtId="c1" />);

    await user.type(await screen.findByRole("textbox", { name: "Cena za hodinu" }), "500");
    await user.click(screen.getByRole("button", { name: "Přidat do ceníku" }));

    expect(screen.getByText(/Překrývá se s pravidlem Po 07:00–16:00/)).toBeTruthy();
    expect(api.createPriceRule).not.toHaveBeenCalled();
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
