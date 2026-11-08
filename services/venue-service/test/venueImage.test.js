import assert from "node:assert/strict";
import { test } from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";
import { MAX_IMAGE_BYTES } from "../src/routes/venueImage.js";

const GATEWAY_SECRET = "test-gateway-secret-at-least-32-characters";
const MANAGER_ID = "00000000-0000-4000-8000-000000000001";
const IMAGE_ID = "00000000-0000-4000-8000-000000000777";
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);

function managerHeaders(roles = "PLAYER,MANAGER") {
  return {
    "x-gateway-secret": GATEWAY_SECRET,
    "x-user-id": MANAGER_ID,
    "x-user-roles": roles,
  };
}

function fakeDb(stored = new Map()) {
  return {
    stored,
    venueImage: {
      create: async ({ data }) => {
        stored.set(IMAGE_ID, data);
        return {
          id: IMAGE_ID,
          contentType: data.contentType,
          createdAt: new Date("2026-11-08T10:00:00Z"),
        };
      },
      findUnique: async ({ where }) => stored.get(where.id) ?? null,
    },
  };
}

function app(db) {
  return createApp({ db, gatewaySecret: GATEWAY_SECRET });
}

test("POST /venueImage/upload stores a PNG and returns its URL", async () => {
  const db = fakeDb();

  const response = await request(app(db))
    .post("/venueImage/upload")
    .set(managerHeaders())
    .set("Content-Type", "image/png")
    .send(PNG);

  assert.equal(response.status, 200);
  assert.equal(response.body.id, IMAGE_ID);
  assert.equal(response.body.imageUrl, `/venueImage/get?id=${IMAGE_ID}`);
  assert.equal(response.body.size, PNG.length);
  assert.equal(db.stored.get(IMAGE_ID).uploadedBy, MANAGER_ID);
  assert.deepEqual(db.stored.get(IMAGE_ID).data, PNG);
});

test("POST /venueImage/upload rejects a player without the manager role", async () => {
  const response = await request(app(fakeDb()))
    .post("/venueImage/upload")
    .set(managerHeaders("PLAYER"))
    .set("Content-Type", "image/png")
    .send(PNG);

  assert.equal(response.status, 403);
  assert.ok(response.body.uuAppErrorMap["venueImage/upload/notAuthorized"]);
});

test("POST /venueImage/upload rejects requests that bypass the gateway", async () => {
  const response = await request(app(fakeDb()))
    .post("/venueImage/upload")
    .set("Content-Type", "image/png")
    .send(PNG);

  assert.equal(response.status, 401);
});

test("POST /venueImage/upload rejects unsupported content types", async () => {
  const response = await request(app(fakeDb()))
    .post("/venueImage/upload")
    .set(managerHeaders())
    .set("Content-Type", "image/gif")
    .send(Buffer.from("GIF89a"));

  assert.equal(response.status, 415);
  assert.ok(response.body.uuAppErrorMap["venueImage/upload/unsupportedImageType"]);
});

test("POST /venueImage/upload rejects bytes that do not match the declared type", async () => {
  const response = await request(app(fakeDb()))
    .post("/venueImage/upload")
    .set(managerHeaders())
    .set("Content-Type", "image/png")
    .send(JPEG);

  assert.equal(response.status, 415);
});

test("POST /venueImage/upload rejects an empty body", async () => {
  const response = await request(app(fakeDb()))
    .post("/venueImage/upload")
    .set(managerHeaders())
    .set("Content-Type", "image/jpeg")
    .send(Buffer.alloc(0));

  assert.equal(response.status, 400);
  assert.ok(response.body.uuAppErrorMap["venueImage/upload/invalidDtoIn"]);
});

test("POST /venueImage/upload rejects files over the size limit", async () => {
  const tooLarge = Buffer.concat([JPEG, Buffer.alloc(MAX_IMAGE_BYTES)]);

  const response = await request(app(fakeDb()))
    .post("/venueImage/upload")
    .set(managerHeaders())
    .set("Content-Type", "image/jpeg")
    .send(tooLarge);

  assert.equal(response.status, 413);
  assert.ok(response.body.uuAppErrorMap["venueImage/upload/imageTooLarge"]);
});

test("GET /venueImage/get serves the stored bytes with long-lived caching", async () => {
  const db = fakeDb(new Map([[IMAGE_ID, { contentType: "image/jpeg", data: JPEG }]]));

  const response = await request(app(db))
    .get("/venueImage/get")
    .query({ id: IMAGE_ID });

  assert.equal(response.status, 200);
  assert.equal(response.headers["content-type"], "image/jpeg");
  assert.match(response.headers["cache-control"], /immutable/);
  assert.deepEqual(response.body, JPEG);
});

test("GET /venueImage/get returns 404 for an unknown image", async () => {
  const response = await request(app(fakeDb()))
    .get("/venueImage/get")
    .query({ id: IMAGE_ID });

  assert.equal(response.status, 404);
  assert.ok(response.body.uuAppErrorMap["venueImage/get/venueImageDoesNotExist"]);
});

test("GET /venueImage/get validates the id", async () => {
  const response = await request(app(fakeDb()))
    .get("/venueImage/get")
    .query({ id: "nope" });

  assert.equal(response.status, 400);
});
