import assert from "node:assert/strict";
import { test } from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";

const VENUE_ID = "30000000-0000-4000-8000-000000000001";
const COURT_ID = "50000000-0000-4000-8000-000000000003";

test("GET /court/list returns courts for a venue", async () => {
  const db = {
    venue: {
      findUnique: async () => ({ id: VENUE_ID }),
    },
    court: {
      count: async () => 1,
      findMany: async () => [
        {
          id: COURT_ID,
          venueId: VENUE_ID,
          name: "Hřiště 3",
          sport: "volejbal",
          surface: "Odpružený akrylátový povrch",
          indoor: false,
        },
      ],
    },
  };

  const response = await request(createApp({ db }))
    .get("/court/list")
    .query({ venueId: VENUE_ID });

  assert.equal(response.status, 200);
  assert.equal(response.body.itemList.length, 1);
  assert.equal(response.body.itemList[0].id, COURT_ID);
});

test("GET /court/list returns 400 when venueId is missing", async () => {
  const response = await request(createApp({ db: {} }))
    .get("/court/list");

  assert.equal(response.status, 400);

  assert.equal(
    response.body.uuAppErrorMap["court/list/invalidDtoIn"].type,
    "error",
  );

  assert.ok(
    response.body.uuAppErrorMap["court/list/invalidDtoIn"]
      .paramMap.missingKeyMap.venueId,
  );
});

test("GET /court/list returns 400 for invalid venueId", async () => {
  const response = await request(createApp({ db: {} }))
    .get("/court/list")
    .query({ venueId: "not-a-valid-uuid" });

  assert.equal(response.status, 400);

  assert.equal(
    response.body.uuAppErrorMap["court/list/invalidDtoIn"].type,
    "error",
  );
});

test("GET /court/list returns 404 for unknown venue", async () => {
  const db = {
    venue: {
      findUnique: async () => null,
    },
  };

  const response = await request(createApp({ db }))
    .get("/court/list")
    .query({ venueId: VENUE_ID });

  assert.equal(response.status, 404);

  assert.equal(
    response.body.uuAppErrorMap["court/list/venueDoesNotExist"].type,
    "error",
  );
});

test("GET /court/list returns empty list when venue has no courts", async () => {
  const db = {
    venue: {
      findUnique: async () => ({ id: VENUE_ID }),
    },
    court: {
      count: async () => 0,
      findMany: async () => [],
    },
  };

  const response = await request(createApp({ db }))
    .get("/court/list")
    .query({ venueId: VENUE_ID });

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.itemList, []);

  assert.deepEqual(response.body.pageInfo, {
    pageIndex: 0,
    pageSize: 20,
    total: 0,
  });

  assert.deepEqual(response.body.uuAppErrorMap, {});
});

test("GET /court/list supports pagination", async () => {
  const courts = Array.from({ length: 5 }, (_, index) => ({
    id: `50000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    venueId: VENUE_ID,
    name: `Hřiště ${index + 1}`,
    sport: "volejbal",
    surface: "Umělý povrch",
    indoor: false,
  }));

  const db = {
    venue: {
      findUnique: async () => ({ id: VENUE_ID }),
    },
    court: {
      count: async () => courts.length,
      findMany: async ({ skip, take }) => courts.slice(skip, skip + take),
    },
  };

  const response = await request(createApp({ db }))
    .get("/court/list")
    .query({
      venueId: VENUE_ID,
      pageIndex: 1,
      pageSize: 2,
    });

  assert.equal(response.status, 200);

  assert.equal(response.body.itemList.length, 2);
  assert.equal(response.body.itemList[0].id, courts[2].id);
  assert.equal(response.body.itemList[1].id, courts[3].id);

  assert.deepEqual(response.body.pageInfo, {
    pageIndex: 1,
    pageSize: 2,
    total: 5,
  });
});

test("GET /court/list returns 400 for invalid pageIndex", async () => {
  const response = await request(createApp({ db: {} }))
    .get("/court/list")
    .query({
      venueId: VENUE_ID,
      pageIndex: -1,
    });

  assert.equal(response.status, 400);

  assert.equal(
    response.body.uuAppErrorMap["court/list/invalidDtoIn"].type,
    "error",
  );
});

test("GET /court/list returns 400 for invalid pageSize", async () => {
  const response = await request(createApp({ db: {} }))
    .get("/court/list")
    .query({
      venueId: VENUE_ID,
      pageSize: 0,
    });

  assert.equal(response.status, 400);

  assert.equal(
    response.body.uuAppErrorMap["court/list/invalidDtoIn"].type,
    "error",
  );
});

const GATEWAY_SECRET = "test-gateway-secret-at-least-32-characters";
const MANAGER_ID = "10000000-0000-4000-8000-000000000001";

const CREATE_DTO = {
  venueId: VENUE_ID,
  name: "Nové hřiště",
  sport: "volejbal",
  surface: "Umělý povrch",
  indoor: false,
};

function createAuthorizedApp(db) {
  return createApp({ db, gatewaySecret: GATEWAY_SECRET });
}

function managerHeaders(req) {
  return req
    .set("x-gateway-secret", GATEWAY_SECRET)
    .set("x-user-id", MANAGER_ID)
    .set("x-user-roles", "PLAYER,MANAGER");
}

test("POST /court/create creates a court for its manager", async () => {
  const db = {
    venue: {
      findUnique: async () => ({
        id: VENUE_ID,
        managerId: MANAGER_ID,
      }),
    },
    court: {
      create: async ({ data }) => ({
        id: COURT_ID,
        ...data,
      }),
    },
  };

  const response = await managerHeaders(
    request(createAuthorizedApp(db)).post("/court/create"),
  ).send(CREATE_DTO);

  assert.equal(response.status, 200);
  assert.equal(response.body.id, COURT_ID);
  assert.equal(response.body.name, CREATE_DTO.name);
  assert.equal(response.body.venueId, VENUE_ID);
  assert.deepEqual(response.body.uuAppErrorMap, {});
});

test("POST /court/create returns 401 without gateway identity", async () => {
  const response = await request(
    createAuthorizedApp({}),
  )
    .post("/court/create")
    .send(CREATE_DTO);

  assert.equal(response.status, 401);
});

test("POST /court/create rejects an incorrect gateway secret", async () => {
  const response = await request(
    createAuthorizedApp({}),
  )
    .post("/court/create")
    .set("x-gateway-secret", "incorrect-secret")
    .set("x-user-id", MANAGER_ID)
    .set("x-user-roles", "PLAYER,MANAGER")
    .send(CREATE_DTO);

  assert.equal(response.status, 401);
});

test("POST /court/create returns 403 for PLAYER", async () => {
  const response = await request(
    createAuthorizedApp({}),
  )
    .post("/court/create")
    .set("x-gateway-secret", GATEWAY_SECRET)
    .set("x-user-id", MANAGER_ID)
    .set("x-user-roles", "PLAYER")
    .send(CREATE_DTO);

  assert.equal(response.status, 403);
});

test("POST /court/create rejects a manager who does not own the venue", async () => {
  const db = {
    venue: {
      findUnique: async () => ({
        id: VENUE_ID,
        managerId: "10000000-0000-4000-8000-000000000099",
      }),
    },
  };

  const response = await managerHeaders(
    request(createAuthorizedApp(db)).post("/court/create"),
  ).send(CREATE_DTO);

  assert.equal(response.status, 403);
});

test("POST /court/create returns 404 for unknown venue", async () => {
  const db = {
    venue: {
      findUnique: async () => null,
    },
  };

  const response = await managerHeaders(
    request(createAuthorizedApp(db)).post("/court/create"),
  ).send(CREATE_DTO);

  assert.equal(response.status, 404);
});

test("POST /court/create rejects invalid input", async () => {
  const response = await managerHeaders(
    request(createAuthorizedApp({})).post("/court/create"),
  ).send({
    ...CREATE_DTO,
    name: "",
    indoor: "false",
  });

  assert.equal(response.status, 400);
  assert.equal(
    response.body.uuAppErrorMap["court/create/invalidDtoIn"].type,
    "error",
  );
});

test("POST /court/create returns 409 for duplicate court name", async () => {
  const db = {
    venue: {
      findUnique: async () => ({
        id: VENUE_ID,
        managerId: MANAGER_ID,
      }),
    },
    court: {
      create: async () => {
        const error = new Error("Unique constraint violation");
        error.code = "P2002";
        throw error;
      },
    },
  };

  const response = await managerHeaders(
    request(createAuthorizedApp(db)).post("/court/create"),
  ).send(CREATE_DTO);

  assert.equal(response.status, 409);
});

const UPDATE_DTO = {
  id: COURT_ID,
  name: "Upravené hřiště",
  sport: "tenis",
  surface: "antuka",
  indoor: true,
};

test("POST /court/update updates a court for its manager", async () => {
  const db = {
    $transaction: async (callback) => callback(db),

    court: {
      findUnique: async () => ({
        id: COURT_ID,
        name: "Původní hřiště",
        sport: "volejbal",
        surface: "beton",
        indoor: false,
        venue: {
          managerId: MANAGER_ID,
        },
      }),

      update: async ({ data }) => ({
        id: COURT_ID,
        ...data,
      }),
    },

    auditLog: {
      create: async () => {},
    },
  };

  const response = await managerHeaders(
    request(createAuthorizedApp(db)).post("/court/update"),
  ).send(UPDATE_DTO);

  assert.equal(response.status, 200);
  assert.equal(response.body.id, COURT_ID);
  assert.equal(response.body.name, "Upravené hřiště");
  assert.equal(response.body.sport, "tenis");
});


test("POST /court/update rejects missing id", async () => {
  const response = await managerHeaders(
    request(createAuthorizedApp({})).post("/court/update"),
  ).send({
    name: "New name",
  });

  assert.equal(response.status, 400);

  assert.ok(
    response.body.uuAppErrorMap["court/update/invalidDtoIn"],
  );
});


test("POST /court/update rejects manager who does not own the court", async () => {
  const db = {
    court: {
      findUnique: async () => ({
        id: COURT_ID,
        venue: {
          managerId: "10000000-0000-4000-8000-000000000099",
        },
      }),
    },
  };

  const response = await managerHeaders(
    request(createAuthorizedApp(db)).post("/court/update"),
  ).send(UPDATE_DTO);

  assert.equal(response.status, 403);
});


const DELETE_DTO = {
  id: COURT_ID,
};


test("POST /court/delete deletes a court for its manager", async () => {
  let deletedCourt = false;
  let deletedPriceRules = false;
  let createdAudit = false;

  const db = {
    $transaction: async (callback) => callback(db),

    court: {
      findUnique: async () => ({
        id: COURT_ID,
        name: "Court 1",
        sport: "tenis",
        venueId: VENUE_ID,
        venue: {
          managerId: MANAGER_ID,
        },
      }),

      delete: async () => {
        deletedCourt = true;
      },
    },

    priceRule: {
      deleteMany: async () => {
        deletedPriceRules = true;

        return {
          count: 2,
        };
      },
    },

    auditLog: {
      create: async () => {
        createdAudit = true;
      },
    },
  };

  const response = await managerHeaders(
    request(createAuthorizedApp(db)).post("/court/delete"),
  ).send(DELETE_DTO);

  assert.equal(response.status, 200);

  assert.equal(response.body.id, COURT_ID);
  assert.equal(response.body.deleted, true);

  assert.equal(deletedPriceRules, true);
  assert.equal(deletedCourt, true);
  assert.equal(createdAudit, true);
});


test("POST /court/delete returns 404 for unknown court", async () => {
  const db = {
    court: {
      findUnique: async () => null,
    },
  };

  const response = await managerHeaders(
    request(createAuthorizedApp(db)).post("/court/delete"),
  ).send(DELETE_DTO);

  assert.equal(response.status, 404);
});


test("POST /court/delete rejects manager who does not own the court", async () => {
  const db = {
    court: {
      findUnique: async () => ({
        id: COURT_ID,
        venue: {
          managerId: "10000000-0000-4000-8000-000000000099",
        },
      }),
    },
  };

  const response = await managerHeaders(
    request(createAuthorizedApp(db)).post("/court/delete"),
  ).send(DELETE_DTO);

  assert.equal(response.status, 403);
});