import assert from "node:assert/strict";
import { test } from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";

const GATEWAY_SECRET = "test-gateway-secret-at-least-32-characters";
const OWNER_ID = "00000000-0000-4000-8000-000000000001";
const OTHER_ID = "00000000-0000-4000-8000-000000000002";
const COURT_ID = "00000000-0000-4000-8000-000000000202";
const VENUE_ID = "00000000-0000-4000-8000-000000000101";
const MISSING_ID = "00000000-0000-4000-8000-000000000999";

function time(value) {
  return new Date(`1970-01-01T${value}:00.000Z`);
}

function headers(userId = OWNER_ID, roles = "PLAYER,MANAGER") {
  return {
    "x-gateway-secret": GATEWAY_SECRET,
    "x-user-id": userId,
    "x-user-roles": roles,
  };
}

function fakeDb({ rules = [], transactionError = null } = {}) {
  const calls = { created: [], auditLogs: [], conflictQuery: null };
  const stored = rules.map((rule, index) => ({ id: `rule-${index}`, courtId: COURT_ID, ...rule }));
  return {
    calls,
    court: {
      findUnique: async ({ where }) =>
        where.id === COURT_ID ? { id: COURT_ID, venueId: VENUE_ID, venue: { managerId: OWNER_ID } } : null,
    },
    priceRule: {
      findFirst: async (query) => {
        calls.conflictQuery = query;
        const { dayOfWeek, startTime, endTime } = query.where;
        return (
          stored.find(
            (rule) =>
              rule.dayOfWeek === dayOfWeek && rule.startTime < startTime.lt && rule.endTime > endTime.gt,
          ) ?? null
        );
      },
      findMany: async () =>
        [...stored].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime - b.startTime),
    },
    $transaction: async (callback) => {
      if (transactionError) throw transactionError;
      return callback({
        priceRule: {
          create: async ({ data }) => {
            calls.created.push(data);
            return { id: "00000000-0000-4000-8000-000000000401", ...data };
          },
        },
        auditLog: {
          create: async ({ data }) => {
            calls.auditLogs.push(data);
            return data;
          },
        },
      });
    },
  };
}

function create(db, body, requestHeaders = headers()) {
  return request(createApp({ db, gatewaySecret: GATEWAY_SECRET }))
    .post("/priceRule/create")
    .set(requestHeaders)
    .send(body);
}

const rule = { courtId: COURT_ID, dayOfWeek: 1, startTime: "07:00", endTime: "16:00", pricePerHour: 100 };

test("POST /priceRule/create saves a rule for the manager's court and logs it", async () => {
  const db = fakeDb();

  const response = await create(db, rule);

  assert.equal(response.status, 200);
  assert.deepEqual(
    { ...response.body, uuAppErrorMap: undefined },
    {
      id: "00000000-0000-4000-8000-000000000401",
      courtId: COURT_ID,
      dayOfWeek: 1,
      startTime: "07:00",
      endTime: "16:00",
      pricePerHour: 100,
      uuAppErrorMap: undefined,
    },
  );
  assert.deepEqual(response.body.uuAppErrorMap, {});
  assert.equal(db.calls.created[0].pricePerHour, "100.00");
  assert.deepEqual(db.calls.created[0].startTime, time("07:00"));
  assert.equal(db.calls.auditLogs[0].action, "priceRule/create");
  assert.equal(db.calls.auditLogs[0].entityType, "PriceRule");
});

test("POST /priceRule/create accepts a rule that starts where another ends", async () => {
  const db = fakeDb({ rules: [{ dayOfWeek: 1, startTime: time("07:00"), endTime: time("16:00"), pricePerHour: "100.00" }] });

  const response = await create(db, { ...rule, startTime: "16:00", endTime: "22:00", pricePerHour: 200 });

  assert.equal(response.status, 200);
  assert.equal(response.body.pricePerHour, 200);
});

test("POST /priceRule/create refuses an overlapping rule on the same day", async () => {
  const db = fakeDb({ rules: [{ dayOfWeek: 1, startTime: time("07:00"), endTime: time("16:00"), pricePerHour: "100.00" }] });

  const response = await create(db, { ...rule, startTime: "15:00", endTime: "18:00" });

  assert.equal(response.status, 409);
  const error = response.body.uuAppErrorMap["priceRule/create/priceRuleOverlap"];
  assert.deepEqual(error.paramMap.conflictingRule, { id: "rule-0", startTime: "07:00", endTime: "16:00" });
  assert.equal(db.calls.created.length, 0);
});

test("POST /priceRule/create allows the same hours on a different day", async () => {
  const db = fakeDb({ rules: [{ dayOfWeek: 1, startTime: time("07:00"), endTime: time("16:00"), pricePerHour: "100.00" }] });

  const response = await create(db, { ...rule, dayOfWeek: 2 });

  assert.equal(response.status, 200);
});

test("POST /priceRule/create maps the database overlap constraint to priceRuleOverlap", async () => {
  const error = Object.assign(new Error("conflicting key value violates exclusion constraint"), {
    cause: { code: "23P01" },
  });

  const response = await create(fakeDb({ transactionError: error }), rule);

  assert.equal(response.status, 409);
  assert.equal(response.body.uuAppErrorMap["priceRule/create/priceRuleOverlap"].paramMap.conflictingRule, null);
});

test("POST /priceRule/create validates the rule", async () => {
  const response = await create(fakeDb(), {
    courtId: "nope",
    dayOfWeek: 8,
    startTime: "16:00",
    endTime: "07:00",
    pricePerHour: -5,
  });

  assert.equal(response.status, 400);
  const { invalidValueKeyMap } = response.body.uuAppErrorMap["priceRule/create/invalidDtoIn"].paramMap;
  assert.deepEqual(Object.keys(invalidValueKeyMap).sort(), ["courtId", "dayOfWeek", "endTime", "pricePerHour"]);
});

test("POST /priceRule/create reports missing keys and wrong types", async () => {
  const response = await create(fakeDb(), { courtId: COURT_ID, dayOfWeek: "1", pricePerHour: "100" });

  assert.equal(response.status, 400);
  const { missingKeyMap, invalidTypeKeyMap } = response.body.uuAppErrorMap["priceRule/create/invalidDtoIn"].paramMap;
  assert.deepEqual(Object.keys(missingKeyMap).sort(), ["endTime", "startTime"]);
  assert.deepEqual(Object.keys(invalidTypeKeyMap).sort(), ["dayOfWeek", "pricePerHour"]);
});

test("POST /priceRule/create refuses more than two decimal places", async () => {
  const response = await create(fakeDb(), { ...rule, pricePerHour: 100.555 });

  assert.equal(response.status, 400);
  assert.ok(response.body.uuAppErrorMap["priceRule/create/invalidDtoIn"].paramMap.invalidValueKeyMap.pricePerHour);
});

test("POST /priceRule/create forbids a manager who does not own the venue", async () => {
  const db = fakeDb();

  const response = await create(db, rule, headers(OTHER_ID));

  assert.equal(response.status, 403);
  assert.equal(db.calls.created.length, 0);
});

test("POST /priceRule/create forbids a player without the manager role", async () => {
  const response = await create(fakeDb(), rule, headers(OWNER_ID, "PLAYER"));

  assert.equal(response.status, 403);
});

test("POST /priceRule/create returns 404 for an unknown court", async () => {
  const response = await create(fakeDb(), { ...rule, courtId: MISSING_ID });

  assert.equal(response.status, 404);
  assert.ok(response.body.uuAppErrorMap["priceRule/create/courtDoesNotExist"]);
});

test("GET /priceRule/listByCourt returns the court's rules sorted by day and time", async () => {
  const db = fakeDb({
    rules: [
      { dayOfWeek: 2, startTime: time("07:00"), endTime: time("16:00"), pricePerHour: "150.00" },
      { dayOfWeek: 1, startTime: time("16:00"), endTime: time("22:00"), pricePerHour: "200.00" },
      { dayOfWeek: 1, startTime: time("07:00"), endTime: time("16:00"), pricePerHour: "100.50" },
    ],
  });

  const response = await request(createApp({ db, gatewaySecret: GATEWAY_SECRET })).get(
    `/priceRule/listByCourt?courtId=${COURT_ID}`,
  );

  assert.equal(response.status, 200);
  assert.deepEqual(
    response.body.itemList.map((item) => [item.dayOfWeek, item.startTime, item.endTime, item.pricePerHour]),
    [
      [1, "07:00", "16:00", 100.5],
      [1, "16:00", "22:00", 200],
      [2, "07:00", "16:00", 150],
    ],
  );
  assert.deepEqual(response.body.uuAppErrorMap, {});
});

test("GET /priceRule/listByCourt returns 404 for an unknown court", async () => {
  const response = await request(createApp({ db: fakeDb(), gatewaySecret: GATEWAY_SECRET })).get(
    `/priceRule/listByCourt?courtId=${MISSING_ID}`,
  );

  assert.equal(response.status, 404);
  assert.ok(response.body.uuAppErrorMap["priceRule/listByCourt/courtDoesNotExist"]);
});

test("GET /priceRule/listByCourt requires a valid courtId", async () => {
  const response = await request(createApp({ db: fakeDb(), gatewaySecret: GATEWAY_SECRET })).get(
    "/priceRule/listByCourt",
  );

  assert.equal(response.status, 400);
  assert.ok(response.body.uuAppErrorMap["priceRule/listByCourt/invalidDtoIn"].paramMap.missingKeyMap.courtId);
});
