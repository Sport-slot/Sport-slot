import { Router } from "express";
import {
  AppError,
  invalidDtoIn,
  notAuthorized,
  unsupportedKeys,
} from "@sportslot/api-format";
import { managerIdFromGateway, UUID_PATTERN } from "../gatewayAuth.js";

const ALLOWED_KEYS = ["id", "active"];

function validateDtoIn(dtoIn) {
  const missingKeyMap = {};
  const invalidTypeKeyMap = {};
  const invalidValueKeyMap = {};

  if (dtoIn.id === undefined) {
    missingKeyMap.id = "id je povinný.";
  } else if (typeof dtoIn.id !== "string") {
    invalidTypeKeyMap.id = "id musí být řetězec.";
  } else if (!UUID_PATTERN.test(dtoIn.id)) {
    invalidValueKeyMap.id = "id musí být platné UUID.";
  }

  if (dtoIn.active === undefined) {
    missingKeyMap.active = "active je povinný.";
  } else if (typeof dtoIn.active !== "boolean") {
    invalidTypeKeyMap.active = "active musí být boolean.";
  }

  if (
    Object.keys(missingKeyMap).length ||
    Object.keys(invalidTypeKeyMap).length ||
    Object.keys(invalidValueKeyMap).length
  ) {
    throw invalidDtoIn({ missingKeyMap, invalidTypeKeyMap, invalidValueKeyMap });
  }
}

export function createVenueSetActiveRouter({
  db,
  gatewaySecret = process.env.GATEWAY_SECRET,
}) {
  const router = Router();

  router.post("/setActive", async (req, res) => {
    const managerId = managerIdFromGateway(req, gatewaySecret);
    const dtoIn = req.body;

    if (!dtoIn || typeof dtoIn !== "object" || Array.isArray(dtoIn)) {
      throw invalidDtoIn({
        invalidTypeKeyMap: { dtoIn: "Tělo požadavku musí být JSON objekt." },
      });
    }

    validateDtoIn(dtoIn);

    const select = {
      id: true,
      name: true,
      managerId: true,
      deactivatedAt: true,
    };

    const venue = await db.venue.findUnique({
      where: { id: dtoIn.id },
      select,
    });

    if (!venue) {
      throw new AppError("venueDoesNotExist", "Sportoviště nenalezeno.", 404, {
        id: dtoIn.id,
      });
    }

    if (venue.managerId !== managerId) {
      throw notAuthorized();
    }

    const isActive = !venue.deactivatedAt;
    const updated =
      isActive === dtoIn.active
        ? venue
        : await db.venue.update({
            where: { id: venue.id },
            data: { deactivatedAt: dtoIn.active ? null : new Date() },
            select,
          });

    res.json({
      id: updated.id,
      name: updated.name,
      active: !updated.deactivatedAt,
      deactivatedAt: updated.deactivatedAt ?? null,
      uuAppErrorMap: unsupportedKeys(req, dtoIn, ALLOWED_KEYS),
    });
  });

  return router;
}
