import { describe, expect, it } from "vitest";
import { initialsOf, safeNextPath } from "@/lib/auth";

describe("initialsOf", () => {
  it("uses first and last name", () => {
    expect(initialsOf("Daniel Kolář")).toBe("DK");
    expect(initialsOf("  jan  van  šimek ")).toBe("JŠ");
  });

  it("uses two letters of a single name", () => {
    expect(initialsOf("samir")).toBe("SA");
  });
});

describe("safeNextPath", () => {
  it("keeps same site paths", () => {
    expect(safeNextPath("/venues?city=Praha#top")).toBe("/venues?city=Praha#top");
  });

  it("rejects external and protocol relative redirects", () => {
    expect(safeNextPath("https://evil.example")).toBe("/");
    expect(safeNextPath("//evil.example/path")).toBe("/");
    expect(safeNextPath(null)).toBe("/");
  });
});
