import {
  ApiError,
  apiBaseUrl,
  authHeaders,
  toApiError,
  type UuAppErrorMap,
} from "@/lib/api";

export const reservationPageSize = 20;

const dayMs = 24 * 60 * 60 * 1000;
const timeZone = "Europe/Prague";

export type ReservationPeriod = "upcoming" | "past";

export type Reservation = {
  id: string;
  courtId: string;
  courtName: string | null;
  venueId: string;
  venueName: string | null;
  playerId: string;
  playerName: string;
  startAt: string;
  endAt: string;
  totalPrice: number;
  status: "ACTIVE" | "CANCELLED";
  createdAt: string;
  cancelledAt: string | null;
};

export type ReservationPage = {
  itemList: Reservation[];
  pageInfo: { pageIndex: number; pageSize: number; total: number };
  uuAppErrorMap: UuAppErrorMap;
};

export type CancelledReservation = Omit<Reservation, "courtName" | "venueName"> & {
  uuAppErrorMap?: UuAppErrorMap;
};

export async function listMyReservations({
  period,
  pageIndex = 0,
}: {
  period: ReservationPeriod;
  pageIndex?: number;
}): Promise<ReservationPage> {
  if (process.env.NEXT_PUBLIC_MOCK_ROLE) {
    return listMyReservationsMock(period, pageIndex);
  }

  const query = new URLSearchParams({
    period,
    pageIndex: String(pageIndex),
    pageSize: String(reservationPageSize),
  });
  const response = await fetch(`${apiBaseUrl}/reservation/listMy?${query}`, {
    headers: authHeaders(),
  });
  if (!response.ok) {
    throw await toApiError(response);
  }
  return (await response.json()) as ReservationPage;
}

export async function cancelReservation(id: string): Promise<CancelledReservation> {
  if (process.env.NEXT_PUBLIC_MOCK_ROLE) {
    return cancelReservationMock(id);
  }

  const response = await fetch(`${apiBaseUrl}/reservation/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ id }),
  });
  if (!response.ok) {
    throw await toApiError(response);
  }
  return (await response.json()) as CancelledReservation;
}

const dateFormat = new Intl.DateTimeFormat("cs-CZ", {
  timeZone,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const timeFormat = new Intl.DateTimeFormat("cs-CZ", {
  timeZone,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function formatReservationDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}

export function formatTimeRange(startAt: string, endAt: string): string {
  return `${timeFormat.format(new Date(startAt))}–${timeFormat.format(new Date(endAt))}`;
}

export function canCancel(reservation: Reservation, now: Date): boolean {
  return (
    reservation.status === "ACTIVE" &&
    now.getTime() < new Date(reservation.startAt).getTime() - dayMs
  );
}

export function reservationStatus(
  reservation: Reservation,
  now: Date,
): { label: string; className: string } {
  if (reservation.status === "CANCELLED") {
    return { label: "Zrušeno", className: "bg-surface text-muted" };
  }
  const time = now.getTime();
  if (time >= new Date(reservation.endAt).getTime()) {
    return { label: "Odehráno", className: "bg-surface text-muted" };
  }
  if (time >= new Date(reservation.startAt).getTime()) {
    return { label: "Probíhá", className: "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-100" };
  }
  return { label: "Nadcházející", className: "bg-ball text-brand-900" };
}

const mockPlayerId = "11111111-1111-4111-8111-111111111111";

function mockReservation(
  id: string,
  venue: [string, string],
  court: [string, string],
  startOffsetMs: number,
  price: number,
  status: Reservation["status"] = "ACTIVE",
): Reservation {
  const hour = 60 * 60 * 1000;
  const startAt = Date.now() + startOffsetMs;
  return {
    id,
    courtId: court[0],
    courtName: court[1],
    venueId: venue[0],
    venueName: venue[1],
    playerId: mockPlayerId,
    playerName: "Petr Hráč",
    startAt: new Date(startAt).toISOString(),
    endAt: new Date(startAt + hour).toISOString(),
    totalPrice: price,
    status,
    createdAt: new Date(Date.now() - 7 * dayMs).toISOString(),
    cancelledAt: status === "CANCELLED" ? new Date(Date.now() - 6 * dayMs).toISOString() : null,
  };
}

const stromovka: [string, string] = ["00000000-0000-4000-8000-000000000102", "Tenisový klub Stromovka"];
const padelArena: [string, string] = ["00000000-0000-4000-8000-000000000103", "Padel Arena Smíchov"];

const mockReservations: Reservation[] = [
  mockReservation("a0000000-0000-4000-8000-000000000001", stromovka, ["00000000-0000-4000-8000-000000302001", "Kurt 1"], 3 * dayMs, 350),
  mockReservation("a0000000-0000-4000-8000-000000000002", padelArena, ["00000000-0000-4000-8000-000000303001", "Padel 1"], 10 * 60 * 60 * 1000, 800),
  mockReservation("a0000000-0000-4000-8000-000000000003", stromovka, ["00000000-0000-4000-8000-000000302004", "Krytý kurt"], -dayMs, 380),
  mockReservation("a0000000-0000-4000-8000-000000000004", padelArena, ["00000000-0000-4000-8000-000000303001", "Padel 1"], -7 * dayMs, 800, "CANCELLED"),
  mockReservation("a0000000-0000-4000-8000-000000000005", stromovka, ["00000000-0000-4000-8000-000000302002", "Kurt 2"], 5 * dayMs, 250, "CANCELLED"),
];

const mockDelay = () => new Promise((resolve) => setTimeout(resolve, 400));

async function listMyReservationsMock(
  period: ReservationPeriod,
  pageIndex: number,
): Promise<ReservationPage> {
  await mockDelay();
  const now = Date.now();
  const matching =
    period === "upcoming"
      ? mockReservations
          .filter((r) => r.status === "ACTIVE" && new Date(r.endAt).getTime() > now)
          .sort((a, b) => a.startAt.localeCompare(b.startAt))
      : mockReservations
          .filter((r) => new Date(r.endAt).getTime() <= now)
          .sort((a, b) => b.startAt.localeCompare(a.startAt));
  const start = pageIndex * reservationPageSize;
  return {
    itemList: matching.slice(start, start + reservationPageSize).map((r) => ({ ...r })),
    pageInfo: { pageIndex, pageSize: reservationPageSize, total: matching.length },
    uuAppErrorMap: {},
  };
}

async function cancelReservationMock(id: string): Promise<CancelledReservation> {
  await mockDelay();
  const reservation = mockReservations.find((r) => r.id === id);
  if (!reservation) {
    throw new ApiError(404, "reservation/cancel/reservationDoesNotExist", "Rezervace neexistuje.");
  }
  if (reservation.status === "ACTIVE") {
    if (!canCancel(reservation, new Date())) {
      throw new ApiError(
        400,
        "reservation/cancel/cancellationTooLate",
        "Rezervaci lze zrušit nejpozději 24 hodin před jejím začátkem.",
      );
    }
    reservation.status = "CANCELLED";
    reservation.cancelledAt = new Date().toISOString();
  }
  return {
    id: reservation.id,
    courtId: reservation.courtId,
    venueId: reservation.venueId,
    playerId: reservation.playerId,
    playerName: reservation.playerName,
    startAt: reservation.startAt,
    endAt: reservation.endAt,
    totalPrice: reservation.totalPrice,
    status: reservation.status,
    createdAt: reservation.createdAt,
    cancelledAt: reservation.cancelledAt,
    uuAppErrorMap: {},
  };
}
