import assert from "node:assert/strict";
import { test } from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";

const GATEWAY_SECRET = "test-gateway-secret-at-least-32-characters";
const OWNER_ID = "00000000-0000-4000-8000-000000000001";
const OTHER_ID = "00000000-0000-4000-8000-000000000002";
const VENUE_ID = "00000000-0000-4000-8000-000000000555";
const MISSING_ID = "00000000-0000-4000-8000-000000000999";

function headers(userId = OWNER_ID, roles = "PLAYER,MANAGER") {
  return {
    "x-gateway-secret": GATEWAY_SECRET,
    "x-user-id": userId,
    "x-user-roles": roles,
  };
}

function fakeDb(deactivatedAt = null) {
  const venue = { id: VENUE_ID, name: "Padel Arena", managerId: OWNER_ID, deactivatedAt };
  const calls = [];
  return {
    venue: {
      findUnique: async ({ where }) => (where.id === VENUE_ID ? { ...venue } : null),
      update: async ({ data }) => {
        calls.push(data);
        Object.assign(venue, data);
        return { ...venue };
      },
    },
    calls,
  };
}

function post(db, body, requestHeaders = headers()) {
  return request(createApp({ db, gatewaySecret: GATEWAY_SECRET }))
    .post("/venue/setActive")
    .set(requestHeaders)
    .send(body);
}

test("POST /venue/setActive deactivates the owner's venue", async () => {
  const db = fakeDb();

  const response = await post(db, { id: VENUE_ID, active: false });

  assert.equal(response.status, 200);
  assert.equal(response.body.active, false);
  assert.ok(response.body.deactivatedAt);
  assert.ok(db.calls[0].deactivatedAt instanceof Date);
  assert.deepEqual(response.body.uuAppErrorMap, {});
});

test("POST /venue/setActive reactivates a deactivated venue", async () => {
  const db = fakeDb(new Date("2026-11-08T10:00:00Z"));

  const response = await post(db, { id: VENUE_ID, active: true });

  assert.equal(response.status, 200);
  assert.equal(response.body.active, true);
  assert.equal(response.body.deactivatedAt, null);
  assert.deepEqual(db.calls, [{ deactivatedAt: null }]);
});

test("POST /venue/setActive is idempotent and does not write when nothing changes", async () => {
  const db = fakeDb();

  const response = await post(db, { id: VENUE_ID, active: true });

  assert.equal(response.status, 200);
  assert.equal(response.body.active, true);
  assert.equal(db.calls.length, 0);
});

test("POST /venue/setActive forbids a manager who does not own the venue", async () => {
  const db = fakeDb();

  const response = await post(db, { id: VENUE_ID, active: false }, headers(OTHER_ID));

  assert.equal(response.status, 403);
  assert.ok(response.body.uuAppErrorMap["venue/setActive/notAuthorized"]);
  assert.equal(db.calls.length, 0);
});

test("POST /venue/setActive forbids players", async () => {
  const response = await post(fakeDb(), { id: VENUE_ID, active: false }, headers(OWNER_ID, "PLAYER"));

  assert.equal(response.status, 403);
});

test("POST /venue/setActive rejects requests that bypass the gateway", async () => {
  const response = await request(createApp({ db: fakeDb(), gatewaySecret: GATEWAY_SECRET }))
    .post("/venue/setActive")
    .send({ id: VENUE_ID, active: false });

  assert.equal(response.status, 401);
});

test("POST /venue/setActive answers 404 for an unknown venue", async () => {
  const response = await post(fakeDb(), { id: MISSING_ID, active: false });

  assert.equal(response.status, 404);
  assert.ok(response.body.uuAppErrorMap["venue/setActive/venueDoesNotExist"]);
});

test("POST /venue/setActive validates dtoIn", async () => {
  const response = await post(fakeDb(), { id: "nope", active: "no" });

  assert.equal(response.status, 400);
  const { paramMap } = response.body.uuAppErrorMap["venue/setActive/invalidDtoIn"];
  assert.ok(paramMap.invalidValueKeyMap.id);
  assert.ok(paramMap.invalidTypeKeyMap.active);
});

test("POST /venue/setActive warns about unsupported keys", async () => {
  const response = await post(fakeDb(), { id: VENUE_ID, active: false, extra: 1 });

  assert.equal(response.status, 200);
  assert.ok(response.body.uuAppErrorMap["venue/setActive/unsupportedKeys"]);
});
