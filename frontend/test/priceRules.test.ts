import { describe, expect, it } from "vitest";
import { findOverlap, parsePrice, rulesByDay, validatePriceRule, type PriceRule } from "@/lib/priceRules";

const rule = (overrides: Partial<PriceRule>): PriceRule => ({
  id: "r1",
  courtId: "c1",
  dayOfWeek: 1,
  startTime: "07:00",
  endTime: "16:00",
  pricePerHour: 300,
  ...overrides,
});

describe("parsePrice", () => {
  it("accepts whole and decimal amounts with comma or dot", () => {
    expect(parsePrice("400")).toBe(400);
    expect(parsePrice("399,50")).toBe(399.5);
    expect(parsePrice(" 1 200.25 ")).toBe(1200.25);
    expect(parsePrice("0")).toBe(0);
  });

  it("rejects negative, text and more than two decimals", () => {
    expect(parsePrice("-5")).toBeNull();
    expect(parsePrice("abc")).toBeNull();
    expect(parsePrice("10.555")).toBeNull();
    expect(parsePrice("100000000")).toBeNull();
  });
});

describe("findOverlap", () => {
  const rules = [rule({})];

  it("finds a rule overlapping on the same day", () => {
    expect(findOverlap(rules, 1, "15:00", "18:00")?.id).toBe("r1");
  });

  it("allows adjacent times and other days", () => {
    expect(findOverlap(rules, 1, "16:00", "22:00")).toBeUndefined();
    expect(findOverlap(rules, 2, "08:00", "10:00")).toBeUndefined();
  });
});

describe("validatePriceRule", () => {
  const valid = { days: [1, 2] as const, startTime: "08:00", endTime: "12:00", price: "350" };

  it("passes a complete rule", () => {
    expect(validatePriceRule({ ...valid, days: [...valid.days] })).toEqual({});
  });

  it("reports missing days, reversed times and bad price", () => {
    expect(validatePriceRule({ days: [], startTime: "12:00", endTime: "08:00", price: "x" })).toEqual({
      days: "Vyberte alespoň jeden den.",
      time: "Čas od musí být dřív než čas do.",
      price: "Zadejte nezápornou částku v Kč, nejvýše se dvěma desetinnými místy.",
    });
  });
});

describe("rulesByDay", () => {
  it("groups rules into all seven days sorted by start time", () => {
    const grouped = rulesByDay([rule({ id: "b", startTime: "16:00", endTime: "22:00" }), rule({ id: "a" }), rule({ id: "c", dayOfWeek: 6 })]);
    expect(grouped).toHaveLength(7);
    expect(grouped[0].rules.map((item) => item.id)).toEqual(["a", "b"]);
    expect(grouped[5].rules.map((item) => item.id)).toEqual(["c"]);
    expect(grouped[1].rules).toEqual([]);
  });
});
