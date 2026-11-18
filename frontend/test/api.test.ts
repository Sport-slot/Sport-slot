import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authHeaders, clearToken, getCurrentUser, setToken, toApiError } from "@/lib/api";
import { listVenues } from "@/lib/venues";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

beforeEach(() => {
  clearToken();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("token handling", () => {
  it("adds a bearer header only when a token is stored", () => {
    expect(authHeaders()).toEqual({});
    setToken("abc");
    expect(authHeaders()).toEqual({ Authorization: "Bearer abc" });
  });
});

describe("toApiError", () => {
  it("reads the first error from uuAppErrorMap", async () => {
    const error = await toApiError(
      jsonResponse({ uuAppErrorMap: { "venue/create/invalidDtoIn": { type: "error", message: "Bad input" } } }, 400),
    );
    expect(error.status).toBe(400);
    expect(error.code).toBe("venue/create/invalidDtoIn");
    expect(error.message).toBe("Bad input");
  });

  it("falls back to unexpectedError for a body without errors", async () => {
    const error = await toApiError(new Response("oops", { status: 500 }));
    expect(error.code).toBe("unexpectedError");
  });
});

describe("getCurrentUser", () => {
  it("returns null without calling the API when no token is stored", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await getCurrentUser()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("clears the token when the API answers 401", async () => {
    setToken("expired");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, 401)));
    expect(await getCurrentUser()).toBeNull();
    expect(authHeaders()).toEqual({});
  });
});

describe("listVenues", () => {
  it("sends filters as query parameters", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ itemList: [], pageInfo: {} }));
    vi.stubGlobal("fetch", fetchMock);
    await listVenues({ city: "Praha", sport: "tenis", pageIndex: 2 });
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.pathname.endsWith("/venue/list")).toBe(true);
    expect(Object.fromEntries(url.searchParams)).toEqual({ pageIndex: "2", pageSize: "12", city: "Praha", sport: "tenis" });
  });
});
