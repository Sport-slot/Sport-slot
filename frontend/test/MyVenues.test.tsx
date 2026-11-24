import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MyVenues } from "@/components/MyVenues";
import { ApiError } from "@/lib/api";
import type { MyVenue } from "@/lib/venues";

const venues = vi.hoisted(() => ({ listMyVenues: vi.fn(), setVenueActive: vi.fn() }));

vi.mock("@/lib/venues", () => venues);
vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}));

function venue(overrides: Partial<MyVenue>): MyVenue {
  return {
    id: "v1",
    name: "Sportcentrum",
    city: "Praha",
    imageUrl: null,
    active: true,
    deactivatedAt: null,
    courtCount: 3,
    sports: ["tenis", "padel"],
    createdAt: "2026-11-01T10:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  venues.listMyVenues.mockReset();
  venues.setVenueActive.mockReset();
});

describe("MyVenues", () => {
  it("lists venues with their status and court count", async () => {
    venues.listMyVenues.mockResolvedValue([
      venue({}),
      venue({ id: "v2", name: "Hala Brno", city: "Brno", courtCount: 0, sports: [] }),
      venue({ id: "v3", name: "Stará hala", active: false, courtCount: 1 }),
    ]);
    render(<MyVenues />);
    expect(await screen.findByText("Spravujete 3 sportovišť.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Sportcentrum" }).getAttribute("href")).toBe("/venues/v1");
    expect(screen.getByRole("link", { name: "Upravit sportoviště Sportcentrum" }).getAttribute("href")).toBe("/venues/v1/edit");
    expect(screen.getByText("3 kurty: Tenis, Padel")).toBeTruthy();
    expect(screen.getByText("Aktivní")).toBeTruthy();
    expect(screen.getByText("Bez kurtů")).toBeTruthy();
    expect(screen.getByText("Deaktivované")).toBeTruthy();
  });

  it("shows an empty state for a new manager", async () => {
    venues.listMyVenues.mockResolvedValue([]);
    render(<MyVenues />);
    expect(await screen.findByRole("heading", { name: "Zatím nemáte žádné sportoviště" })).toBeTruthy();
  });

  it("shows the API error and retries", async () => {
    venues.listMyVenues.mockRejectedValueOnce(new ApiError(403, "notAuthorized", "Nemáte oprávnění.")).mockResolvedValueOnce([venue({})]);
    render(<MyVenues />);
    expect((await screen.findByRole("alert")).textContent).toContain("Nemáte oprávnění.");
    await userEvent.setup().click(screen.getByRole("button", { name: /zkusit znovu/i }));
    expect(await screen.findByText("Spravujete 1 sportoviště.")).toBeTruthy();
    expect(venues.listMyVenues).toHaveBeenCalledTimes(2);
  });

  it("deactivates a venue from its card after confirmation", async () => {
    venues.listMyVenues.mockResolvedValue([venue({})]);
    venues.setVenueActive.mockResolvedValue({ id: "v1", name: "Sportcentrum", active: false, deactivatedAt: "2026-11-24T10:00:00.000Z", uuAppErrorMap: {} });
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.open = true; };
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) { this.open = false; };
    const user = userEvent.setup();
    render(<MyVenues />);

    await user.click(await screen.findByRole("button", { name: "Deaktivovat sportoviště Sportcentrum" }));
    await user.click(screen.getByRole("button", { name: "Deaktivovat", hidden: true }));

    expect(venues.setVenueActive).toHaveBeenCalledWith("v1", false);
    expect(await screen.findByText("Deaktivované")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Znovu aktivovat sportoviště Sportcentrum" })).toBeTruthy();
  });

  it("reactivates a deactivated venue right away", async () => {
    venues.listMyVenues.mockResolvedValue([venue({ active: false, deactivatedAt: "2026-11-20T10:00:00.000Z" })]);
    venues.setVenueActive.mockResolvedValue({ id: "v1", name: "Sportcentrum", active: true, deactivatedAt: null, uuAppErrorMap: {} });
    const user = userEvent.setup();
    render(<MyVenues />);

    await user.click(await screen.findByRole("button", { name: "Znovu aktivovat sportoviště Sportcentrum" }));

    expect(venues.setVenueActive).toHaveBeenCalledWith("v1", true);
    expect(await screen.findByText("Aktivní")).toBeTruthy();
  });
});
