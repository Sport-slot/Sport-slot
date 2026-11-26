import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearToken, setToken } from "@/lib/api";
import {
  cancelReservation,
  canCancel,
  formatReservationDate,
  formatTimeRange,
  listMyReservations,
  reservationStatus,
  type Reservation,
} from "@/lib/reservations";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function reservation(overrides: Partial<Reservation> = {}): Reservation {
  return {
    id: "r1",
    courtId: "c1",
    courtName: "Kurt 1",
    venueId: "v1",
    venueName: "Sportcentrum",
    playerId: "p1",
    playerName: "Petr Hráč",
    startAt: "2026-12-01T17:00:00.000Z",
    endAt: "2026-12-01T18:00:00.000Z",
    totalPrice: 350,
    status: "ACTIVE",
    createdAt: "2026-11-20T10:00:00.000Z",
    cancelledAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  clearToken();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("canCancel", () => {
  const start = new Date("2026-12-01T17:00:00.000Z").getTime();
  const hour = 60 * 60 * 1000;

  it("allows cancelling more than 24 h before the start", () => {
    expect(canCancel(reservation(), new Date(start - 24 * hour - 1))).toBe(true);
  });

  it("is already too late exactly 24 h before the start", () => {
    expect(canCancel(reservation(), new Date(start - 24 * hour))).toBe(false);
  });

  it("does not allow cancelling a cancelled reservation", () => {
    expect(canCancel(reservation({ status: "CANCELLED" }), new Date(start - 48 * hour))).toBe(false);
  });
});

describe("formatting", () => {
  it("formats date and time in Europe/Prague regardless of the machine timezone", () => {
    expect(formatReservationDate("2026-11-27T17:00:00.000Z")).toBe("pátek 27. listopadu 2026");
    expect(formatTimeRange("2026-11-27T17:00:00.000Z", "2026-11-27T18:00:00.000Z")).toBe("18:00–19:00");
    expect(formatTimeRange("2026-07-01T16:00:00.000Z", "2026-07-01T17:00:00.000Z")).toBe("18:00–19:00");
  });

  it("uses the Prague calendar day near midnight", () => {
    expect(formatReservationDate("2026-11-27T23:30:00.000Z")).toBe("sobota 28. listopadu 2026");
  });
});

describe("reservationStatus", () => {
  const item = reservation();
  const start = new Date(item.startAt).getTime();

  it("labels the reservation by its state", () => {
    expect(reservationStatus(item, new Date(start - 1000)).label).toBe("Nadcházející");
    expect(reservationStatus(item, new Date(start)).label).toBe("Probíhá");
    expect(reservationStatus(item, new Date(new Date(item.endAt).getTime())).label).toBe("Odehráno");
    expect(reservationStatus(reservation({ status: "CANCELLED" }), new Date(start - 1000)).label).toBe("Zrušeno");
  });
});

describe("listMyReservations", () => {
  it("sends period, paging and the bearer token", async () => {
    setToken("abc");
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ itemList: [], pageInfo: { pageIndex: 1, pageSize: 20, total: 0 }, uuAppErrorMap: {} }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await listMyReservations({ period: "past", pageIndex: 1 });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/reservation/listMy?period=past&pageIndex=1&pageSize=20");
    expect(init.headers).toEqual({ Authorization: "Bearer abc" });
  });

  it("throws an ApiError built from the response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ uuAppErrorMap: { "reservation/listMy/notAuthorized": { type: "error", message: "Nemáte oprávnění." } } }, 403)),
    );
    await expect(listMyReservations({ period: "upcoming" })).rejects.toMatchObject({ status: 403, code: "reservation/listMy/notAuthorized" });
  });
});

describe("cancelReservation", () => {
  it("posts the id and returns the cancelled reservation", async () => {
    setToken("abc");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: "r1", status: "CANCELLED", cancelledAt: "2026-11-26T10:00:00.000Z" }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await cancelReservation("r1");

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/reservation/cancel");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "Content-Type": "application/json", Authorization: "Bearer abc" });
    expect(JSON.parse(init.body)).toEqual({ id: "r1" });
    expect(result.status).toBe("CANCELLED");
  });

  it("keeps the full error key for a too late cancellation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ uuAppErrorMap: { "reservation/cancel/cancellationTooLate": { type: "error", message: "Příliš pozdě." } } }, 400)),
    );
    await expect(cancelReservation("r1")).rejects.toMatchObject({ status: 400, code: "reservation/cancel/cancellationTooLate", message: "Příliš pozdě." });
  });
});
