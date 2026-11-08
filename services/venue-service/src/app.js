import express from "express";
import { createCourtRouter } from "./routes/court.js";
import { createVenueCreateRouter } from "./routes/venueCreate.js";
import { createVenueImageRouter } from "./routes/venueImage.js";
import { createVenueSetActiveRouter } from "./routes/venueSetActive.js";
import { createVenueListMineRouter } from "./routes/venueListMine.js";
import { getVenue, listVenues } from "./venue.js";
import { errorHandler, notFound } from "@sportslot/api-format";

// shortcut: server.js zatím venueDao nepředává (DB klient ještě není zapojený), venue/* do té doby vrací 500.
export function createApp({
  db,
  venueDao,
  gatewaySecret = process.env.GATEWAY_SECRET,
} = {}) {
  const app = express();

  app.locals.db = db;

  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "venue-service",
    });
  });

  app.get("/venue/list", async (req, res) => {
    res.json(await listVenues(venueDao, req));
  });

  app.get("/venue/get", async (req, res) => {
    res.json(await getVenue(venueDao, req, { gatewaySecret }));
  });

  app.use("/venue", createVenueCreateRouter({ db, gatewaySecret }));

  app.use("/venue", createVenueSetActiveRouter({ db, gatewaySecret }));

  app.use("/venue", createVenueListMineRouter({ db, gatewaySecret }));

  app.use("/venueImage", createVenueImageRouter({ db, gatewaySecret }));

  app.use("/court", createCourtRouter({ db, gatewaySecret }));

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
