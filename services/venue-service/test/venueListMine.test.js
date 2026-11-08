import assert from "node:assert/strict";
import { test } from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";

const GATEWAY_SECRET = "test-gateway-secret-at-least-32-characters";
const OWNER_ID = "00000000-0000-4000-8000-000000000001";

function headers(roles = "PLAYER,MANAGER") {
  return {
    "x-gateway-secret": GATEWAY_SECRET,
    "x-user-id": OWNER_ID,
    "x-user-roles": roles,
  };
}

function fakeDb() {
  const calls = [];
  return {
    calls,
    venue: {
      findMany: async (args) => {
        calls.push(args);
        return [
          {
            id: "00000000-0000-4000-8000-000000000101",
            name: "Areál Lužánky",
            city: "Brno",
            imageUrl: null,
            deactivatedAt: new Date("2026-11-08T10:00:00Z"),
            createdAt: new Date("2026-11-01T10:00:00Z"),
            courts: [{ sport: "tenis, nohejbal" }, { sport: "tenis" }],
          },
          {
            id: "00000000-0000-4000-8000-000000000102",
            name: "Nová hala",
            city: "Praha",
            imageUrl: "/images/venues/padel.webp",
            deactivatedAt: null,
            createdAt: new Date("2026-11-07T10:00:00Z"),
            courts: [],
          },
        ];
      },
    },
  };
}

test("GET /venue/listMine returns only the manager's venues including inactive ones", async () => {
  const db = fakeDb();

  const response = await request(createApp({ db, gatewaySecret: GATEWAY_SECRET }))
    .get("/venue/listMine")
    .set(headers());

  assert.equal(response.status, 200);
  assert.deepEqual(db.calls[0].where, { managerId: OWNER_ID });
  assert.equal(response.body.itemList.length, 2);
  assert.deepEqual(response.body.itemList[0], {
    id: "00000000-0000-4000-8000-000000000101",
    name: "Areál Lužánky",
    city: "Brno",
    imageUrl: null,
    active: false,
    deactivatedAt: "2026-11-08T10:00:00.000Z",
    courtCount: 2,
    sports: ["tenis", "nohejbal"],
    createdAt: "2026-11-01T10:00:00.000Z",
  });
  assert.equal(response.body.itemList[1].active, true);
  assert.equal(response.body.itemList[1].courtCount, 0);
  assert.deepEqual(response.body.uuAppErrorMap, {});
});

test("GET /venue/listMine forbids players", async () => {
  const response = await request(createApp({ db: fakeDb(), gatewaySecret: GATEWAY_SECRET }))
    .get("/venue/listMine")
    .set(headers("PLAYER"));

  assert.equal(response.status, 403);
});

test("GET /venue/listMine rejects requests that bypass the gateway", async () => {
  const response = await request(createApp({ db: fakeDb(), gatewaySecret: GATEWAY_SECRET }))
    .get("/venue/listMine");

  assert.equal(response.status, 401);
});
