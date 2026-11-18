import assert from "node:assert/strict";
import { test } from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";
import { buildSlots, dayOfWeekOf, pragueTime } from "../src/routes/courtAvailability.js";

const VENUE_ID = "30000000-0000-4000-8000-000000000001";
const COURT_ID = "50000000-0000-4000-8000-000000000003";
// Prisma vrací sloupec TIME jako Date 1970-01-01
const time = (hhmm) => new Date(`1970-01-01T${hhmm}:00Z`);

function dbWith({ court, reservations = [] }) {
  const calls = {};
  return {
    calls,
    court: { findUnique: async (args) => ((calls.court = args), court) },
    reservation: { findMany: async (args) => ((calls.reservation = args), reservations) },
  };
}

const openCourt = {
  venueId: VENUE_ID,
  venue: {
    deactivatedAt: null,
    openingHours: [{ openTime: time("08:00"), closeTime: time("11:00") }],
  },
};

test("dayOfWeekOf uses 1–7 (Mon–Sun)", () => {
  assert.equal(dayOfWeekOf("2099-11-16"), 1); // pondělí
  assert.equal(dayOfWeekOf("2099-11-22"), 7); // neděle
});

test("pragueTime handles winter, summer and the DST switch day", () => {
  assert.equal(pragueTime("2099-01-15", "08:00").toISOString(), "2099-01-15T07:00:00.000Z");
  assert.equal(pragueTime("2099-07-15", "08:00").toISOString(), "2099-07-15T06:00:00.000Z");
  // 29. 3. 2099 je den přechodu na letní čas (poslední neděle v březnu)
  assert.equal(pragueTime("2099-03-29", "08:00").toISOString(), "2099-03-29T06:00:00.000Z");
});

test("buildSlots marks overlapping, partially overlapping and past slots as not free", () => {
  const date = "2099-01-15";
  const slots = buildSlots({
    date,
    openTime: "08:00",
    closeTime: "12:30",
    reservations: [
      { startAt: pragueTime(date, "08:00"), endAt: pragueTime(date, "09:00") }, // přesně slot
      { startAt: pragueTime(date, "10:30"), endAt: pragueTime(date, "11:15") }, // přes hranici slotů
    ],
    now: new Date("2000-01-01"),
  });

  assert.deepEqual(
    slots.map((s) => [s.startTime, s.endTime, s.free]),
    [
      ["08:00", "09:00", false],
      ["09:00", "10:00", true], // rezervace končí 09:00 = slot hned za ní je volný
      ["10:00", "11:00", false],
      ["11:00", "12:00", false],
    ], // 12:00–12:30 není celý slot, nevrací se
  );

  const past = buildSlots({ date, openTime: "08:00", closeTime: "09:00", reservations: [], now: new Date("2099-12-31") });
  assert.equal(past[0].free, false);
});

test("GET /court/availability returns slots for an open day", async () => {
  const date = "2099-01-15"; // čtvrtek
  const db = dbWith({
    court: openCourt,
    reservations: [{ startAt: pragueTime(date, "09:00"), endAt: pragueTime(date, "10:00") }],
  });

  const response = await request(createApp({ db })).get("/court/availability").query({ courtId: COURT_ID, date });

  assert.equal(response.status, 200);
  assert.equal(response.body.openTime, "08:00");
  assert.equal(response.body.closeTime, "11:00");
  assert.deepEqual(response.body.slotList.map((s) => s.free), [true, false, true]);
  assert.equal(response.body.slotList[0].startAt, "2099-01-15T07:00:00.000Z");
  assert.deepEqual(response.body.uuAppErrorMap, {});
  assert.equal(db.calls.court.select.venue.select.openingHours.where.dayOfWeek, 4);
  assert.equal(db.calls.reservation.where.status, "ACTIVE");
});

test("GET /court/availability returns no slots when the venue is closed that day", async () => {
  const db = dbWith({ court: { ...openCourt, venue: { deactivatedAt: null, openingHours: [] } } });

  const response = await request(createApp({ db })).get("/court/availability").query({ courtId: COURT_ID, date: "2099-01-15" });

  assert.equal(response.status, 200);
  assert.equal(response.body.openTime, null);
  assert.deepEqual(response.body.slotList, []);
  assert.equal(db.calls.reservation, undefined);
});

test("GET /court/availability returns 400 for a missing courtId and an impossible date", async () => {
  const response = await request(createApp({ db: {} })).get("/court/availability").query({ date: "2099-02-30" });

  assert.equal(response.status, 400);
  const { paramMap } = response.body.uuAppErrorMap["court/availability/invalidDtoIn"];
  assert.ok(paramMap.missingKeyMap.courtId);
  assert.ok(paramMap.invalidValueKeyMap.date);
});

test("GET /court/availability returns 404 for an unknown court", async () => {
  const response = await request(createApp({ db: dbWith({ court: null }) }))
    .get("/court/availability")
    .query({ courtId: COURT_ID, date: "2099-01-15" });

  assert.equal(response.status, 404);
  assert.ok(response.body.uuAppErrorMap["court/availability/courtDoesNotExist"]);
});

test("GET /court/availability returns 409 for a deactivated venue", async () => {
  const db = dbWith({ court: { ...openCourt, venue: { ...openCourt.venue, deactivatedAt: new Date() } } });

  const response = await request(createApp({ db })).get("/court/availability").query({ courtId: COURT_ID, date: "2099-01-15" });

  assert.equal(response.status, 409);
  assert.ok(response.body.uuAppErrorMap["court/availability/venueIsNotActive"]);
});
