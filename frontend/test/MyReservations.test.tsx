import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MyReservations } from "@/components/MyReservations";
import { ApiError } from "@/lib/api";
import type { Reservation } from "@/lib/reservations";

const reservations = vi.hoisted(() => ({ listMyReservations: vi.fn(), cancelReservation: vi.fn() }));

vi.mock("@/lib/reservations", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/reservations")>()),
  ...reservations,
}));

const hour = 60 * 60 * 1000;

function reservation(overrides: Partial<Reservation> & { startInMs?: number } = {}): Reservation {
  const { startInMs = 3 * 24 * hour, ...rest } = overrides;
  const startAt = Date.now() + startInMs;
  return {
    id: "r1",
    courtId: "c1",
    courtName: "Kurt 1",
    venueId: "v1",
    venueName: "Sportcentrum",
    playerId: "p1",
    playerName: "Petr Hráč",
    startAt: new Date(startAt).toISOString(),
    endAt: new Date(startAt + hour).toISOString(),
    totalPrice: 350,
    status: "ACTIVE",
    createdAt: "2026-11-20T10:00:00.000Z",
    cancelledAt: null,
    ...rest,
  };
}

function page(itemList: Reservation[], total = itemList.length, pageIndex = 0) {
  return { itemList, pageInfo: { pageIndex, pageSize: 20, total }, uuAppErrorMap: {} };
}

beforeEach(() => {
  reservations.listMyReservations.mockReset();
  reservations.cancelReservation.mockReset();
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.open = true; };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) { this.open = false; };
});

describe("MyReservations", () => {
  it("lists upcoming reservations with venue link, court and price", async () => {
    reservations.listMyReservations.mockResolvedValue(page([reservation(), reservation({ id: "r2", venueName: null, courtName: null })]));
    render(<MyReservations />);
    expect(await screen.findByRole("link", { name: "Sportcentrum" })).toHaveProperty("href", expect.stringContaining("/venues/v1"));
    expect(screen.getByText("Kurt 1")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Sportoviště" }).getAttribute("href")).toBe("/venues/v1");
    expect(screen.getByText("Kurt byl odstraněn")).toBeTruthy();
    expect(screen.getAllByText("Nadcházející", { selector: "span" })).toHaveLength(2);
    expect(reservations.listMyReservations).toHaveBeenCalledWith({ period: "upcoming", pageIndex: 0 });
  });

  it("shows an empty state with a link to venues", async () => {
    reservations.listMyReservations.mockResolvedValue(page([]));
    render(<MyReservations />);
    expect(await screen.findByRole("heading", { name: "Zatím nemáte žádné nadcházející rezervace" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /najít sportoviště/i }).getAttribute("href")).toBe("/venues");
  });

  it("shows the API error and retries", async () => {
    reservations.listMyReservations.mockRejectedValueOnce(new ApiError(403, "notAuthorized", "Nemáte oprávnění.")).mockResolvedValueOnce(page([reservation()]));
    render(<MyReservations />);
    expect((await screen.findByRole("alert")).textContent).toContain("Nemáte oprávnění.");
    await userEvent.setup().click(screen.getByRole("button", { name: /zkusit znovu/i }));
    expect(await screen.findByRole("link", { name: "Sportcentrum" })).toBeTruthy();
    expect(reservations.listMyReservations).toHaveBeenCalledTimes(2);
  });

  it("switches to past reservations and requests period=past", async () => {
    reservations.listMyReservations
      .mockResolvedValueOnce(page([reservation()]))
      .mockResolvedValueOnce(page([reservation({ id: "r9", venueName: "Hala Brno", startInMs: -2 * 24 * hour })]));
    const user = userEvent.setup();
    render(<MyReservations />);
    await screen.findByRole("link", { name: "Sportcentrum" });

    await user.click(screen.getByRole("button", { name: "Proběhlé" }));

    expect(await screen.findByRole("link", { name: "Hala Brno" })).toBeTruthy();
    expect(reservations.listMyReservations).toHaveBeenLastCalledWith({ period: "past", pageIndex: 0 });
    expect(screen.getByText("Odehráno")).toBeTruthy();
  });

  it("appends the next page", async () => {
    reservations.listMyReservations
      .mockResolvedValueOnce(page([reservation()], 2))
      .mockResolvedValueOnce(page([reservation({ id: "r2", venueName: "Hala Brno" })], 2, 1));
    const user = userEvent.setup();
    render(<MyReservations />);
    await user.click(await screen.findByRole("button", { name: "Načíst další" }));

    expect(await screen.findByRole("link", { name: "Hala Brno" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Sportcentrum" })).toBeTruthy();
    expect(reservations.listMyReservations).toHaveBeenLastCalledWith({ period: "upcoming", pageIndex: 1 });
    expect(screen.queryByRole("button", { name: "Načíst další" })).toBeNull();
  });

  it("cancels a reservation after confirmation and keeps the card with a Zrušeno pill", async () => {
    reservations.listMyReservations.mockResolvedValue(page([reservation()]));
    reservations.cancelReservation.mockResolvedValue({ id: "r1", status: "CANCELLED", cancelledAt: "2026-11-26T10:00:00.000Z" });
    const user = userEvent.setup();
    render(<MyReservations />);

    await user.click(await screen.findByRole("button", { name: /^Zrušit rezervaci:/ }));
    const dialog = screen.getByRole("dialog", { hidden: true });
    expect(within(dialog).getByRole("heading", { name: "Zrušit rezervaci?", hidden: true })).toBeTruthy();
    await user.click(within(dialog).getByRole("button", { name: "Zrušit rezervaci", hidden: true }));

    expect(reservations.cancelReservation).toHaveBeenCalledWith("r1");
    expect(await screen.findByText("Zrušeno")).toBeTruthy();
    expect(screen.getByText("Rezervace byla zrušena.").closest("[role=status]")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Sportcentrum" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Zrušit rezervaci:/ })).toBeNull();
    await vi.waitFor(() => expect(document.activeElement?.id).toBe("reservation-cancelled-r1"));
  });

  it("ignores a next page that arrives after switching tabs", async () => {
    let resolveNext: (value: ReturnType<typeof page>) => void = () => {};
    reservations.listMyReservations
      .mockResolvedValueOnce(page([reservation()], 2))
      .mockReturnValueOnce(new Promise((resolve) => { resolveNext = resolve; }))
      .mockResolvedValueOnce(page([reservation({ id: "p1", venueName: "Hala Brno", startInMs: -2 * 24 * hour })]));
    const user = userEvent.setup();
    render(<MyReservations />);

    await user.click(await screen.findByRole("button", { name: "Načíst další" }));
    await user.click(screen.getByRole("button", { name: "Proběhlé" }));
    expect(await screen.findByRole("link", { name: "Hala Brno" })).toBeTruthy();

    await act(async () => resolveNext(page([reservation({ id: "r2", venueName: "Stará hala" })], 2, 1)));
    expect(screen.queryByRole("link", { name: "Stará hala" })).toBeNull();
    expect(screen.getByRole("link", { name: "Hala Brno" })).toBeTruthy();
  });

  it("shows the API error inside the dialog when cancelling fails", async () => {
    reservations.listMyReservations.mockResolvedValue(page([reservation()]));
    reservations.cancelReservation.mockRejectedValue(
      new ApiError(400, "reservation/cancel/cancellationTooLate", "Rezervaci lze zrušit nejpozději 24 hodin před jejím začátkem."),
    );
    const user = userEvent.setup();
    render(<MyReservations />);

    await user.click(await screen.findByRole("button", { name: /^Zrušit rezervaci:/ }));
    await user.click(within(screen.getByRole("dialog", { hidden: true })).getByRole("button", { name: "Zrušit rezervaci", hidden: true }));

    const alert = await screen.findByRole("alert", { hidden: true });
    expect(alert.textContent).toContain("nejpozději 24 hodin");
    expect(screen.queryByText("Zrušeno")).toBeNull();
  });

  it("hides the cancel button within 24 h of the start and explains why", async () => {
    reservations.listMyReservations.mockResolvedValue(page([reservation({ startInMs: 10 * hour })]));
    render(<MyReservations />);
    expect(await screen.findByText("Zrušit lze nejpozději 24 h před začátkem.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Zrušit rezervaci:/ })).toBeNull();
  });
});
