import { describe, expect, it } from "vitest";
import { nextCourtName, splitSports, suggestCourtName, surfacesForSports } from "@/lib/courts";
import { capitalize, imageForSports } from "@/lib/venueVisuals";

describe("courts helpers", () => {
  it("suggests the next free court name", () => {
    expect(nextCourtName([])).toBe("Kurt 1");
    expect(nextCourtName(["Kurt 1", "kurt 3", "Centrální"])).toBe("Kurt 4");
  });

  it("names a court after its single sport", () => {
    expect(suggestCourtName(["padel"], ["Padel 1", "Padel 2", "Tenis 1"])).toBe("Padel 3");
    expect(suggestCourtName(["tenis"], [])).toBe("Tenis 1");
    expect(suggestCourtName(["tenis", "padel"], ["Kurt 1"])).toBe("Kurt 2");
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
