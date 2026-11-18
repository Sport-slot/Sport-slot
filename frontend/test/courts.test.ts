import { describe, expect, it } from "vitest";
import { nextCourtName, splitSports, surfacesForSports } from "@/lib/courts";
import { capitalize, imageForSports } from "@/lib/venueVisuals";

describe("courts helpers", () => {
  it("suggests the next free court name", () => {
    expect(nextCourtName([])).toBe("Kurt 1");
    expect(nextCourtName(["Kurt 1", "kurt 3", "Centrální"])).toBe("Kurt 4");
  });

  it("splits a comma separated sport list", () => {
    expect(splitSports(" tenis, padel ,, ")).toEqual(["tenis", "padel"]);
  });

  it("suggests surfaces by sport without duplicates", () => {
    expect(surfacesForSports(["Tenis", "Padel"])).toEqual(["Antuka", "Tvrdý povrch", "Umělá tráva s pískem"]);
    expect(surfacesForSports(["curling"])).toContain("Antuka");
  });
});

describe("venue visuals", () => {
  it("picks an image by sport and falls back to the community photo", () => {
    expect(imageForSports(["padel"])).toBe("/images/padel.webp");
    expect(imageForSports(["golf"])).toBe("/images/community.webp");
  });

  it("capitalizes Czech text", () => {
    expect(capitalize("čtvrtek")).toBe("Čtvrtek");
    expect(capitalize("")).toBe("");
  });
});
