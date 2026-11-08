import assert from "node:assert/strict";
import { test } from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";

const GATEWAY_SECRET = "test-gateway-secret-at-least-32-characters";
const MANAGER_ID = "00000000-0000-4000-8000-000000000001";
const VENUE_ID = "00000000-0000-4000-8000-000000000555";

const validDtoIn = {
  name: "Sportcentrum Lužánky",
  address: "Lidická 1",
  city: "Brno",
  description: "Kryté kurty",
  openingHoursList: [
    { dayOfWeek: 2, openTime: "08:00", closeTime: "22:00" },
    { dayOfWeek: 1, openTime: "07:30", closeTime: "21:00" },
  ],
};

function managerHeaders(roles = "PLAYER,MANAGER") {
  return {
    "x-gateway-secret": GATEWAY_SECRET,
    "x-user-id": MANAGER_ID,
    "x-user-roles": roles,
  };
}

function fakeDb(onCreate) {
  return {
    venue: {
      create: async (args) => {
        if (onCreate) return onCreate(args);
        const { data } = args;
        return {
          id: VENUE_ID,
          managerId: data.managerId,
          name: data.name,
          address: data.address,
          city: data.city,
          description: data.description,
          imageUrl: data.imageUrl,
          createdAt: new Date("2026-11-07T10:00:00Z"),
          openingHours: [...data.openingHours.create].sort(
            (a, b) => a.dayOfWeek - b.dayOfWeek,
          ),
        };
      },
    },
  };
}

function post(db, body, headers = managerHeaders()) {
  return request(createApp({ db, gatewaySecret: GATEWAY_SECRET }))
    .post("/venue/create")
    .set(headers)
    .send(body);
}

test("POST /venue/create creates a venue with opening hours", async () => {
  let createArgs;
  const db = fakeDb();
  const create = db.venue.create;
  db.venue.create = async (args) => {
    createArgs = args;
    return create(args);
  };

  const response = await post(db, { ...validDtoIn, name: "  Sportcentrum Lužánky " });

  assert.equal(response.status, 200);
  assert.equal(createArgs.data.managerId, MANAGER_ID);
  assert.equal(createArgs.data.name, "Sportcentrum Lužánky");
  assert.equal(response.body.id, VENUE_ID);
  assert.equal(response.body.managerId, MANAGER_ID);
  assert.deepEqual(response.body.openingHoursList, [
    { dayOfWeek: 1, openTime: "07:30", closeTime: "21:00" },
    { dayOfWeek: 2, openTime: "08:00", closeTime: "22:00" },
  ]);
  assert.deepEqual(response.body.uuAppErrorMap, {});
});

test("POST /venue/create rejects requests that did not come through the gateway", async () => {
  const response = await post(fakeDb(), validDtoIn, {
    "x-user-id": MANAGER_ID,
    "x-user-roles": "PLAYER,MANAGER",
  });

  assert.equal(response.status, 401);
  assert.ok(response.body.uuAppErrorMap["venue/create/notAuthenticated"]);
});

test("POST /venue/create forbids players without the manager role", async () => {
  const response = await post(fakeDb(), validDtoIn, managerHeaders("PLAYER"));

  assert.equal(response.status, 403);
  assert.ok(response.body.uuAppErrorMap["venue/create/notAuthorized"]);
});

test("POST /venue/create reports missing and invalid keys", async () => {
  const response = await post(fakeDb(), {
    name: "",
    city: 42,
    openingHoursList: [
      { dayOfWeek: 1, openTime: "10:00", closeTime: "09:00" },
      { dayOfWeek: 1, openTime: "8:00", closeTime: "22:00" },
    ],
  });

  assert.equal(response.status, 400);
  const { paramMap } = response.body.uuAppErrorMap["venue/create/invalidDtoIn"];
  assert.ok(paramMap.missingKeyMap.address);
  assert.ok(paramMap.invalidTypeKeyMap.city);
  assert.ok(paramMap.invalidValueKeyMap.name);
  assert.ok(paramMap.invalidValueKeyMap["openingHoursList[0].closeTime"]);
  assert.ok(paramMap.invalidValueKeyMap["openingHoursList[1].dayOfWeek"]);
  assert.ok(paramMap.invalidValueKeyMap["openingHoursList[1].openTime"]);
});

test("POST /venue/create requires at least one opening day", async () => {
  const response = await post(fakeDb(), { ...validDtoIn, openingHoursList: [] });

  assert.equal(response.status, 400);
  const { paramMap } = response.body.uuAppErrorMap["venue/create/invalidDtoIn"];
  assert.ok(paramMap.invalidValueKeyMap.openingHoursList);
});

test("POST /venue/create answers 409 for a duplicate venue", async () => {
  const db = fakeDb(async () => {
    throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
  });

  const response = await post(db, validDtoIn);

  assert.equal(response.status, 409);
  assert.ok(response.body.uuAppErrorMap["venue/create/venueAlreadyExists"]);
});

test("POST /venue/create warns about unsupported keys", async () => {
  const response = await post(fakeDb(), { ...validDtoIn, rating: 5 });

  assert.equal(response.status, 200);
  assert.deepEqual(
    response.body.uuAppErrorMap["venue/create/unsupportedKeys"].paramMap,
    { unsupportedKeyList: ["rating"] },
  );
});

const IMAGE_ID = "00000000-0000-4000-8000-000000000777";
const UPLOADED_IMAGE_URL = `/venueImage/get?id=${IMAGE_ID}`;

function dbWithImage(uploadedBy) {
  const db = fakeDb();
  db.venueImage = {
    findUnique: async ({ where }) =>
      where.id === IMAGE_ID && uploadedBy ? { uploadedBy } : null,
  };
  return db;
}

test("POST /venue/create stores an image the manager uploaded", async () => {
  const response = await post(dbWithImage(MANAGER_ID), {
    ...validDtoIn,
    imageUrl: UPLOADED_IMAGE_URL,
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.imageUrl, UPLOADED_IMAGE_URL);
  assert.deepEqual(response.body.uuAppErrorMap, {});
});

test("POST /venue/create rejects an image uploaded by someone else", async () => {
  const response = await post(
    dbWithImage("00000000-0000-4000-8000-000000000999"),
    { ...validDtoIn, imageUrl: UPLOADED_IMAGE_URL },
  );

  assert.equal(response.status, 400);
  assert.ok(
    response.body.uuAppErrorMap["venue/create/invalidDtoIn"].paramMap
      .invalidValueKeyMap.imageUrl,
  );
});

test("POST /venue/create rejects an image URL pointing elsewhere", async () => {
  const response = await post(fakeDb(), {
    ...validDtoIn,
    imageUrl: "https://example.com/photo.jpg",
  });

  assert.equal(response.status, 400);
});

test("POST /venue/create accepts a bundled demo photo", async () => {
  const response = await post(fakeDb(), {
    ...validDtoIn,
    imageUrl: "/images/venues/padel.webp",
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.imageUrl, "/images/venues/padel.webp");
});
