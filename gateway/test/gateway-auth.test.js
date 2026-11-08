
import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import express from "express";
import request from "supertest";
import { SignJWT } from "jose";
import { createApp } from "../src/app.js";
import { serviceUrlsFromEnv } from "../src/routes.js";

const JWT_SECRET = "test-jwt-secret-at-least-32-characters";
const GATEWAY_SECRET = "test-gateway-secret-at-least-32-characters";
const USER_ID = "10000000-0000-4000-8000-000000000001";

const CONFIG = {
  jwtSecret: JWT_SECRET,
  gatewaySecret: GATEWAY_SECRET,
  frontendOrigin: "http://localhost:3000",
};

let venueServer;
let serviceUrls;

before(async () => {
  const venue = express();

  // Fake backend for integration tests
  venue.get("/court/list", (req, res) => {
    res.json({ headers: req.headers });
  });

  venue.post("/court/create", (req, res) => {
    res.json({ headers: req.headers });
  });

  venueServer = await new Promise((resolve) => {
    const server = venue.listen(0, "127.0.0.1", () => resolve(server));
  });

  serviceUrls = {
    ...serviceUrlsFromEnv({}),
    venue: `http://127.0.0.1:${venueServer.address().port}`,
  };
});

after(async () => {
  await new Promise((resolve) => venueServer.close(resolve));
});

async function createToken(roles) {
  return new SignJWT({ userId: USER_ID, roles })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(JWT_SECRET));
}

// 1. Public endpoint and spoofed headers
test("public court/list ignores spoofed identity headers", async () => {
  const response = await request(createApp(serviceUrls, CONFIG))
    .get("/api/court/list")
    .set("x-user-id", "fake-user")
    .set("x-user-roles", "ADMIN")
    .set("x-gateway-secret", "fake-secret");

  assert.equal(response.status, 200);
  assert.equal(response.body.headers["x-user-id"], undefined);
  assert.equal(response.body.headers["x-user-roles"], undefined);
  assert.equal(response.body.headers["x-gateway-secret"], GATEWAY_SECRET);
});

// 2. Missing JWT -> 401
test("court/create without JWT returns 401", async () => {
  const response = await request(createApp(serviceUrls, CONFIG))
    .post("/api/court/create");

  assert.equal(response.status, 401);

  assert.equal(
    response.body.uuAppErrorMap["court/create/notAuthenticated"].type,
    "error",
  );

  assert.equal(
    response.body.uuAppErrorMap["court/create/notAuthenticated"].message,
    "Nejste přihlášen.",
  );
});

// 3. PLAYER without MANAGER role -> 403
test("court/create with PLAYER returns 403", async () => {
  const token = await createToken(["PLAYER"]);

  const response = await request(createApp(serviceUrls, CONFIG))
    .post("/api/court/create")
    .set("Authorization", `Bearer ${token}`);

  assert.equal(response.status, 403);

  assert.equal(
    response.body.uuAppErrorMap["court/create/notAuthorized"].type,
    "error",
  );

  assert.equal(
    response.body.uuAppErrorMap["court/create/notAuthorized"].message,
    "Nemáte oprávnění.",
  );
});

// 4. ADMIN without MANAGER role -> 403
test("ADMIN alone does not bypass MANAGER requirement", async () => {
  const token = await createToken(["PLAYER", "ADMIN"]);

  const response = await request(createApp(serviceUrls, CONFIG))
    .post("/api/court/create")
    .set("Authorization", `Bearer ${token}`);

  assert.equal(response.status, 403);

  assert.equal(
    response.body.uuAppErrorMap["court/create/notAuthorized"].type,
    "error",
  );
});

// 5. MANAGER -> forward verified identity
test("court/create forwards verified MANAGER identity", async () => {
  const token = await createToken(["PLAYER", "MANAGER"]);

  const response = await request(createApp(serviceUrls, CONFIG))
    .post("/api/court/create")
    .set("Authorization", `Bearer ${token}`)
    .set("x-user-id", "fake-user")
    .set("x-user-roles", "ADMIN")
    .set("x-gateway-secret", "fake-secret");

  assert.equal(response.status, 200);

  assert.equal(
    response.body.headers["x-user-id"],
    USER_ID,
  );

  assert.equal(
    response.body.headers["x-user-roles"],
    "PLAYER,MANAGER",
  );

  assert.equal(
    response.body.headers["x-gateway-secret"],
    GATEWAY_SECRET,
  );
});

// 6. Missing internal gateway secret -> 503
test("missing GATEWAY_SECRET blocks forwarding", async () => {
  const response = await request(
    createApp(serviceUrls, {
      jwtSecret: JWT_SECRET,
      gatewaySecret: "",
    }),
  ).get("/api/court/list");

  assert.equal(response.status, 503);

  assert.equal(
    response.body.uuAppErrorMap["court/list/gatewayUnavailable"].type,
    "error",
  );
});

// 7. Valid CORS preflight -> 204
test("CORS preflight works without JWT", async () => {
  const response = await request(createApp(serviceUrls, CONFIG))
    .options("/api/court/create")
    .set("Origin", "http://localhost:3000")
    .set("Access-Control-Request-Method", "POST")
    .set("Access-Control-Request-Headers", "Authorization");

  assert.equal(response.status, 204);

  assert.equal(
    response.headers["access-control-allow-origin"],
    "http://localhost:3000",
  );
});

// 8. Disallowed CORS preflight -> 403 with shared error format
test("CORS preflight rejects unauthorized origin", async () => {
  const response = await request(createApp(serviceUrls, CONFIG))
    .options("/api/court/create")
    .set("Origin", "https://untrusted.example")
    .set("Access-Control-Request-Method", "POST");

  assert.equal(response.status, 403);

  assert.equal(
    response.body.uuAppErrorMap["court/create/notAuthorized"].type,
    "error",
  );

  assert.equal(
    response.headers["access-control-allow-origin"],
    undefined,
  );
});

test("CORS preflight allows local development next to the deployed frontend", async () => {
  const app = createApp(serviceUrls, {
    ...CONFIG,
    frontendOrigin: "https://sport-slot.netlify.app",
  });

  for (const origin of ["https://sport-slot.netlify.app", "http://localhost:3000"]) {
    const response = await request(app)
      .options("/api/court/create")
      .set("Origin", origin)
      .set("Access-Control-Request-Method", "POST");

    assert.equal(response.status, 204);
    assert.equal(response.headers["access-control-allow-origin"], origin);
  }
});

test("FRONTEND_ORIGIN accepts a comma-separated list", async () => {
  const app = createApp(serviceUrls, {
    ...CONFIG,
    frontendOrigin: "https://sport-slot.netlify.app, https://preview.example",
  });

  const response = await request(app)
    .options("/api/court/create")
    .set("Origin", "https://preview.example")
    .set("Access-Control-Request-Method", "POST");

  assert.equal(response.status, 204);
  assert.equal(
    response.headers["access-control-allow-origin"],
    "https://preview.example",
  );
});

test("public court/list forwards identity when a valid JWT is sent", async () => {
  const token = await createToken(["PLAYER", "MANAGER"]);

  const response = await request(createApp(serviceUrls, CONFIG))
    .get("/api/court/list")
    .set("Authorization", `Bearer ${token}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.headers["x-user-id"], USER_ID);
  assert.equal(response.body.headers["x-user-roles"], "PLAYER,MANAGER");
});

test("public court/list stays anonymous with an invalid JWT", async () => {
  const response = await request(createApp(serviceUrls, CONFIG))
    .get("/api/court/list")
    .set("Authorization", "Bearer not-a-token");

  assert.equal(response.status, 200);
  assert.equal(response.body.headers["x-user-id"], undefined);
});
