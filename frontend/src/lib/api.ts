export const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export type Role = "PLAYER" | "MANAGER" | "ADMIN";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  roles: Role[];
};

const mockUsers: Record<string, CurrentUser | null> = {
  visitor: null,
  player: {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Petr Hráč",
    email: "player@example.com",
    roles: ["PLAYER"],
  },
  manager: {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Marie Správcová",
    email: "manager@example.com",
    roles: ["PLAYER", "MANAGER"],
  },
  admin: {
    id: "33333333-3333-4333-8333-333333333333",
    name: "Adam Administrátor",
    email: "admin@example.com",
    roles: ["PLAYER", "ADMIN"],
  },
};

const tokenStorageKey = "sportslot.token";

export function getToken(): string | null {
  try {
    return window.localStorage.getItem(tokenStorageKey);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    window.localStorage.setItem(tokenStorageKey, token);
  } catch {}
}

export function clearToken(): void {
  try {
    window.localStorage.removeItem(tokenStorageKey);
  } catch {}
}

export function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const mockRole = process.env.NEXT_PUBLIC_MOCK_ROLE;
  if (mockRole) {
    return Object.hasOwn(mockUsers, mockRole) ? mockUsers[mockRole] : null;
  }

  if (!getToken()) {
    return null;
  }

  const response = await fetch(`${apiBaseUrl}/user/me`, {
    headers: authHeaders(),
  });
  if (response.status === 401 || response.status === 404) {
    clearToken();
    return null;
  }
  if (!response.ok) {
    throw new Error(`GET /user/me failed with status ${response.status}`);
  }
  const user = (await response.json()) as CurrentUser;
  if (!Array.isArray(user?.roles)) {
    throw new Error("GET /user/me returned a user without roles");
  }
  return user;
}

export type ErrorEntry = {
  type: "error" | "warning";
  message: string;
  paramMap?: Record<string, unknown>;
};

export type UuAppErrorMap = Record<string, ErrorEntry>;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly paramMap: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function toApiError(response: Response): Promise<ApiError> {
  const body = (await response.json().catch(() => null)) as {
    uuAppErrorMap?: UuAppErrorMap;
  } | null;
  const firstError = Object.entries(body?.uuAppErrorMap ?? {}).find(
    ([, entry]) => entry.type === "error",
  );
  if (!firstError) {
    return new ApiError(
      response.status,
      "unexpectedError",
      "Neočekávaná chyba serveru.",
    );
  }
  const [code, entry] = firstError;
  return new ApiError(response.status, code, entry.message, entry.paramMap);
}

export type DayOfWeek = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type OpeningHoursDtoIn = {
  dayOfWeek: DayOfWeek;
  openTime: string;
  closeTime: string;
};

export type VenueCreateDtoIn = {
  name: string;
  address: string;
  city: string;
  description?: string;
  imageUrl?: string;
  openingHoursList: OpeningHoursDtoIn[];
};

export type Venue = {
  id: string;
  managerId: string;
  name: string;
  address: string;
  city: string;
  description?: string;
  imageUrl?: string | null;
  createdAt: string;
  openingHoursList: OpeningHoursDtoIn[];
  uuAppErrorMap: UuAppErrorMap;
};

const mockVenues: Venue[] = [];

function sameText(a: string, b: string): boolean {
  return a.trim().toLocaleLowerCase("cs") === b.trim().toLocaleLowerCase("cs");
}

async function createVenueMock(dtoIn: VenueCreateDtoIn): Promise<Venue> {
  await new Promise((resolve) => setTimeout(resolve, 400));
  const duplicate = mockVenues.some(
    (venue) =>
      sameText(venue.name, dtoIn.name) &&
      sameText(venue.address, dtoIn.address) &&
      sameText(venue.city, dtoIn.city),
  );
  if (duplicate) {
    throw new ApiError(
      409,
      "venue/create/venueAlreadyExists",
      "Sportoviště s tímto názvem a adresou už existuje.",
    );
  }
  const venue: Venue = {
    ...dtoIn,
    id: crypto.randomUUID(),
    managerId: mockUsers.manager?.id ?? "",
    createdAt: new Date().toISOString(),
    uuAppErrorMap: {},
  };
  mockVenues.push(venue);
  return venue;
}

export async function createVenue(dtoIn: VenueCreateDtoIn): Promise<Venue> {
  if (process.env.NEXT_PUBLIC_MOCK_ROLE) {
    return createVenueMock(dtoIn);
  }

  const response = await fetch(`${apiBaseUrl}/venue/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(dtoIn),
  });
  if (!response.ok) {
    throw await toApiError(response);
  }
  return (await response.json()) as Venue;
}

export type GoogleSignIn = {
  token: string;
  user: CurrentUser;
};

export async function signInWithGoogle(idToken: string): Promise<GoogleSignIn> {
  const response = await fetch(`${apiBaseUrl}/auth/googleCallback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!response.ok) {
    throw await toApiError(response);
  }
  const { token, user } = (await response.json()) as GoogleSignIn;
  return { token, user };
}
