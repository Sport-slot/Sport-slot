import assert from "node:assert/strict";
import { test } from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";

const GATEWAY_SECRET = "test-gateway-secret-at-least-32-characters";
const OWNER_ID = "00000000-0000-4000-8000-000000000001";
const OTHER_ID = "00000000-0000-4000-8000-000000000002";
const VENUE_ID = "00000000-0000-4000-8000-000000000555";
const MISSING_ID = "00000000-0000-4000-8000-000000000999";
const IMAGE_ID = "00000000-0000-4000-8000-000000000777";

function headers(userId = OWNER_ID, roles = "PLAYER,MANAGER") {
  return {
    "x-gateway-secret": GATEWAY_SECRET,
    "x-user-id": userId,
    "x-user-roles": roles,
  };
}

function time(hourMinute) {
  return new Date(`1970-01-01T${hourMinute}:00.000Z`);
}

function fakeDb({ imageUploadedBy = OWNER_ID, failWith } = {}) {
  const venue = {
    id: VENUE_ID,
    managerId: OWNER_ID,
    name: "Padel Arena",
    address: "Nádražní 52",
    city: "Praha",
    description: "Krytá hala",
    imageUrl: null,
    createdAt: new Date("2026-11-01T10:00:00Z"),
    deactivatedAt: null,
  };
  let openingHours = [{ dayOfWeek: 1, openTime: time("08:00"), closeTime: time("22:00") }];
  const audit = [];
  const tx = {
    venue: {
      update: async ({ data }) => {
        if (failWith) throw failWith;
        Object.assign(venue, data);
        return { ...venue, openingHours: [...openingHours].sort((a, b) => a.dayOfWeek - b.dayOfWeek) };
      },
    },
    openingHours: {
      deleteMany: async () => {
        openingHours = [];
      },
      createMany: async ({ data }) => {
        openingHours = data.map(({ dayOfWeek, openTime, closeTime }) => ({ dayOfWeek, openTime, closeTime }));
      },
    },
    auditLog: {
      create: async ({ data }) => {
        audit.push(data);
      },
    },
  };
  return {
    venue: {
      findUnique: async ({ where }) => (where.id === VENUE_ID ? { id: venue.id, managerId: venue.managerId, imageUrl: venue.imageUrl } : null),
    },
    venueImage: {
      findUnique: async ({ where }) => (where.id === IMAGE_ID ? { uploadedBy: imageUploadedBy } : null),
    },
    $transaction: async (callback) => callback(tx),
    audit,
    state: () => ({ venue, openingHours }),
  };
}

function post(db, body, requestHeaders = headers()) {
  return request(createApp({ db, gatewaySecret: GATEWAY_SECRET }))
    .post("/venue/update")
    .set(requestHeaders)
    .send(body);
}

test("POST /venue/update changes only the sent fields and logs the change", async () => {
  const db = fakeDb();

  const response = await post(db, { id: VENUE_ID, name: "  Padel Arena Smíchov ", description: "" });

  assert.equal(response.status, 200);
  assert.equal(response.body.name, "Padel Arena Smíchov");
  assert.equal(response.body.address, "Nádražní 52");
  assert.equal(response.body.description, null);
  assert.equal(response.body.active, true);
  assert.deepEqual(response.body.openingHoursList, [{ dayOfWeek: 1, openTime: "08:00", closeTime: "22:00" }]);
  assert.deepEqual(response.body.uuAppErrorMap, {});
  assert.equal(db.audit.length, 1);
  assert.equal(db.audit[0].action, "venue/update");
  assert.deepEqual(db.audit[0].details.changedKeys, ["name", "description"]);
});

test("POST /venue/update replaces the opening hours", async () => {
  const db = fakeDb();

  const response = await post(db, {
    id: VENUE_ID,
    openingHoursList: [
      { dayOfWeek: 6, openTime: "09:00", closeTime: "20:00" },
      { dayOfWeek: 2, openTime: "07:00", closeTime: "23:00" },
    ],
  });

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.openingHoursList, [
    { dayOfWeek: 2, openTime: "07:00", closeTime: "23:00" },
    { dayOfWeek: 6, openTime: "09:00", closeTime: "20:00" },
  ]);
  assert.equal(db.state().openingHours.length, 2);
});

test("POST /venue/update sets and removes the photo", async () => {
  const db = fakeDb();

  const set = await post(db, { id: VENUE_ID, imageUrl: `/venueImage/get?id=${IMAGE_ID}` });
  assert.equal(set.status, 200);
  assert.equal(set.body.imageUrl, `/venueImage/get?id=${IMAGE_ID}`);

  const removed = await post(db, { id: VENUE_ID, imageUrl: null });
  assert.equal(removed.status, 200);
  assert.equal(removed.body.imageUrl, null);
});

test("POST /venue/update rejects a photo uploaded by someone else", async () => {
  const response = await post(fakeDb({ imageUploadedBy: OTHER_ID }), { id: VENUE_ID, imageUrl: `/venueImage/get?id=${IMAGE_ID}` });

  assert.equal(response.status, 400);
  assert.ok(response.body.uuAppErrorMap["venue/update/invalidDtoIn"]);
});

test("POST /venue/update validates the dtoIn", async () => {
  const empty = await post(fakeDb(), { id: VENUE_ID });
  assert.equal(empty.status, 400);
  assert.ok(empty.body.uuAppErrorMap["venue/update/invalidDtoIn"].paramMap.missingKeyMap.dtoIn);

  const invalid = await post(fakeDb(), {
    id: "not-a-uuid",
    name: " ",
    openingHoursList: [{ dayOfWeek: 1, openTime: "22:00", closeTime: "08:00" }],
  });
  assert.equal(invalid.status, 400);
  const { paramMap } = invalid.body.uuAppErrorMap["venue/update/invalidDtoIn"];
  assert.ok(paramMap.invalidValueKeyMap.id);
  assert.ok(paramMap.invalidValueKeyMap.name);
  assert.ok(paramMap.invalidValueKeyMap["openingHoursList[0].closeTime"]);
});

test("POST /venue/update returns 404 for a missing venue", async () => {
  const response = await post(fakeDb(), { id: MISSING_ID, name: "Nové jméno" });

  assert.equal(response.status, 404);
  assert.ok(response.body.uuAppErrorMap["venue/update/venueDoesNotExist"]);
});

test("POST /venue/update forbids another manager", async () => {
  const db = fakeDb();

  const response = await post(db, { id: VENUE_ID, name: "Cizí" }, headers(OTHER_ID));

  assert.equal(response.status, 403);
  assert.equal(db.audit.length, 0);
});

test("POST /venue/update requires the manager role", async () => {
  const response = await post(fakeDb(), { id: VENUE_ID, name: "Hráč" }, headers(OWNER_ID, "PLAYER"));

  assert.equal(response.status, 403);
});

test("POST /venue/update reports a duplicate name and address", async () => {
  const response = await post(fakeDb({ failWith: Object.assign(new Error("unique"), { code: "P2002" }) }), { id: VENUE_ID, name: "Sportcentrum" });

  assert.equal(response.status, 409);
  assert.ok(response.body.uuAppErrorMap["venue/update/venueAlreadyExists"]);
});
