import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VenueEditor } from "@/components/venue-wizard/VenueEditor";
import { ApiError } from "@/lib/api";
import type { VenueDetail } from "@/lib/venues";

const mocks = vi.hoisted(() => ({ getVenue: vi.fn(), updateVenue: vi.fn(), push: vi.fn() }));

vi.mock("@/lib/venues", () => ({ getVenue: mocks.getVenue, updateVenue: mocks.updateVenue }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("next/image", () => ({ default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} /> }));

function venue(overrides: Partial<VenueDetail> = {}): VenueDetail {
  return {
    id: "v1",
    name: "Padel Arena",
    address: "Nádražní 52",
    city: "Praha",
    description: "Krytá hala",
    imageUrl: null,
    active: true,
    deactivatedAt: null,
    isOwner: true,
    openingHours: [{ dayOfWeek: 1, openTime: "07:00", closeTime: "23:00" }],
    courts: [],
    uuAppErrorMap: {},
    ...overrides,
  };
}

beforeEach(() => {
  mocks.getVenue.mockReset();
  mocks.updateVenue.mockReset();
  mocks.push.mockReset();
});

describe("VenueEditor", () => {
  it("prefills the form and saves only the changed fields", async () => {
    mocks.getVenue.mockResolvedValue(venue());
    mocks.updateVenue.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<VenueEditor venueId="v1" />);

    const name = await screen.findByRole("textbox", { name: "Název sportoviště" });
    expect((name as HTMLInputElement).value).toBe("Padel Arena");
    expect(screen.getByRole("button", { name: /Uložit změny/ }).hasAttribute("disabled")).toBe(true);

    await user.clear(name);
    await user.type(name, "Padel Arena Smíchov");
    expect(screen.getByText("1 neuložená změna")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /Uložit změny/ }));

    expect(mocks.updateVenue).toHaveBeenCalledWith({ id: "v1", name: "Padel Arena Smíchov" });
    expect(mocks.push).toHaveBeenCalledWith("/venues/v1");
  });

  it("removes the photo", async () => {
    mocks.getVenue.mockResolvedValue(venue({ imageUrl: "/venueImage/get?id=00000000-0000-4000-8000-000000000777" }));
    mocks.updateVenue.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<VenueEditor venueId="v1" />);

    await user.click(await screen.findByRole("button", { name: "Odebrat" }));
    await user.click(screen.getByRole("button", { name: /Uložit změny/ }));

    expect(mocks.updateVenue).toHaveBeenCalledWith({ id: "v1", imageUrl: null });
  });

  it("keeps the edits and shows the server error", async () => {
    mocks.getVenue.mockResolvedValue(venue());
    mocks.updateVenue.mockRejectedValue(new ApiError(409, "venue/update/venueAlreadyExists", "Sportoviště s tímto názvem a adresou už existuje."));
    const user = userEvent.setup();
    render(<VenueEditor venueId="v1" />);

    const city = await screen.findByRole("textbox", { name: "Město" });
    await user.clear(city);
    await user.type(city, "Brno");
    await user.click(screen.getByRole("button", { name: /Uložit změny/ }));

    expect((await screen.findByRole("alert")).textContent).toContain("Sportoviště s tímto názvem a adresou už existuje.");
    expect((screen.getByRole("textbox", { name: "Město" }) as HTMLInputElement).value).toBe("Brno");
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("refuses a manager who does not own the venue", async () => {
    mocks.getVenue.mockResolvedValue(venue({ isOwner: false }));
    render(<VenueEditor venueId="v1" />);

    expect(await screen.findByRole("heading", { name: "Sportoviště nemůžete upravit" })).toBeTruthy();
  });
});
