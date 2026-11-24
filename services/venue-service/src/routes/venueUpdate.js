import { Router } from "express";
import {
  AppError,
  invalidDtoIn,
  notAuthorized,
  unsupportedKeys,
} from "@sportslot/api-format";
import { managerIdFromGateway, UUID_PATTERN } from "../gatewayAuth.js";
import { VENUE_IMAGE_URL_PATTERN } from "./venueImage.js";
import {
  BUNDLED_IMAGE_PATTERN,
  DESCRIPTION_LIMIT,
  IMAGE_URL_LIMIT,
  TEXT_LIMITS,
  toHourMinute,
  toTime,
  validateOpeningHoursList,
} from "./venueCreate.js";

const UPDATABLE_KEYS = [
  "name",
  "address",
  "city",
  "description",
  "imageUrl",
  "openingHoursList",
];
const ALLOWED_KEYS = ["id", ...UPDATABLE_KEYS];

const venueSelect = {
  id: true,
  managerId: true,
  name: true,
  address: true,
  city: true,
  description: true,
  imageUrl: true,
  createdAt: true,
  deactivatedAt: true,
  openingHours: {
    orderBy: { dayOfWeek: "asc" },
    select: { dayOfWeek: true, openTime: true, closeTime: true },
  },
};

function validateDtoIn(dtoIn) {
  const maps = {
    missingKeyMap: {},
    invalidTypeKeyMap: {},
    invalidValueKeyMap: {},
  };

  if (dtoIn.id === undefined) {
    maps.missingKeyMap.id = "id je povinný.";
  } else if (typeof dtoIn.id !== "string") {
    maps.invalidTypeKeyMap.id = "id musí být řetězec.";
  } else if (!UUID_PATTERN.test(dtoIn.id)) {
    maps.invalidValueKeyMap.id = "id musí být platné UUID.";
  }

  if (!UPDATABLE_KEYS.some((key) => dtoIn[key] !== undefined)) {
    maps.missingKeyMap.dtoIn =
      `Vyplňte alespoň jednu změnu: ${UPDATABLE_KEYS.join(", ")}.`;
  }

  for (const [key, limit] of Object.entries(TEXT_LIMITS)) {
    const value = dtoIn[key];
    if (value === undefined) continue;
    if (typeof value !== "string") {
      maps.invalidTypeKeyMap[key] = `${key} musí být řetězec.`;
    } else if (!value.trim() || value.trim().length > limit) {
      maps.invalidValueKeyMap[key] = `${key} musí obsahovat 1 až ${limit} znaků.`;
    }
  }

  const { description } = dtoIn;
  if (description !== undefined && description !== null) {
    if (typeof description !== "string") {
      maps.invalidTypeKeyMap.description = "description musí být řetězec nebo null.";
    } else if (description.trim().length > DESCRIPTION_LIMIT) {
      maps.invalidValueKeyMap.description =
        `description smí mít nejvýše ${DESCRIPTION_LIMIT} znaků.`;
    }
  }

  const { imageUrl } = dtoIn;
  if (imageUrl !== undefined && imageUrl !== null) {
    if (typeof imageUrl !== "string") {
      maps.invalidTypeKeyMap.imageUrl = "imageUrl musí být řetězec nebo null.";
    } else if (
      imageUrl.length > IMAGE_URL_LIMIT ||
      !(VENUE_IMAGE_URL_PATTERN.test(imageUrl) || BUNDLED_IMAGE_PATTERN.test(imageUrl))
    ) {
      maps.invalidValueKeyMap.imageUrl =
        "imageUrl musí odkazovat na nahranou fotku sportoviště.";
    }
  }

  if (dtoIn.openingHoursList !== undefined) {
    validateOpeningHoursList(dtoIn.openingHoursList, maps);
  }

  if (Object.values(maps).some((map) => Object.keys(map).length > 0)) {
    throw invalidDtoIn(maps);
  }
}

function toDtoOut(venue) {
  const { openingHours, deactivatedAt, ...fields } = venue;
  return {
    ...fields,
    active: !deactivatedAt,
    deactivatedAt: deactivatedAt ?? null,
    openingHoursList: openingHours.map((hours) => ({
      dayOfWeek: hours.dayOfWeek,
      openTime: toHourMinute(hours.openTime),
      closeTime: toHourMinute(hours.closeTime),
    })),
  };
}

function changesOf(dtoIn) {
  const data = {};
  for (const key of ["name", "address", "city"]) {
    if (dtoIn[key] !== undefined) data[key] = dtoIn[key].trim();
  }
  if (dtoIn.description !== undefined) {
    data.description = dtoIn.description?.trim() || null;
  }
  if (dtoIn.imageUrl !== undefined) {
    data.imageUrl = dtoIn.imageUrl;
  }
  return data;
}

export function createVenueUpdateRouter({
  db,
  gatewaySecret = process.env.GATEWAY_SECRET,
}) {
  const router = Router();

  router.post("/update", async (req, res) => {
    const managerId = managerIdFromGateway(req, gatewaySecret);
    const dtoIn = req.body;

    if (!dtoIn || typeof dtoIn !== "object" || Array.isArray(dtoIn)) {
      throw invalidDtoIn({
        invalidTypeKeyMap: { dtoIn: "Tělo požadavku musí být JSON objekt." },
      });
    }

    validateDtoIn(dtoIn);

    const venue = await db.venue.findUnique({
      where: { id: dtoIn.id },
      select: { id: true, managerId: true, imageUrl: true },
    });

    if (!venue) {
      throw new AppError("venueDoesNotExist", "Sportoviště nenalezeno.", 404, {
        id: dtoIn.id,
      });
    }

    if (venue.managerId !== managerId) {
      throw notAuthorized();
    }

    const uploadedImageId =
      dtoIn.imageUrl && dtoIn.imageUrl !== venue.imageUrl
        ? dtoIn.imageUrl.match(VENUE_IMAGE_URL_PATTERN)?.[1]
        : undefined;

    if (uploadedImageId) {
      const image = await db.venueImage.findUnique({
        where: { id: uploadedImageId },
        select: { uploadedBy: true },
      });

      if (!image || image.uploadedBy !== managerId) {
        throw invalidDtoIn({
          invalidValueKeyMap: {
            imageUrl: "Fotka neexistuje nebo ji nahrál jiný uživatel.",
          },
        });
      }
    }

    const data = changesOf(dtoIn);
    const changedKeys = UPDATABLE_KEYS.filter((key) => dtoIn[key] !== undefined);

    let updated;
    try {
      updated = await db.$transaction(async (tx) => {
        if (dtoIn.openingHoursList !== undefined) {
          await tx.openingHours.deleteMany({ where: { venueId: venue.id } });
          await tx.openingHours.createMany({
            data: dtoIn.openingHoursList.map((hours) => ({
              venueId: venue.id,
              dayOfWeek: hours.dayOfWeek,
              openTime: toTime(hours.openTime),
              closeTime: toTime(hours.closeTime),
            })),
          });
        }
        const result = await tx.venue.update({
          where: { id: venue.id },
          data,
          select: venueSelect,
        });
        await tx.auditLog.create({
          data: {
            userId: managerId,
            action: "venue/update",
            entityType: "Venue",
            entityId: venue.id,
            details: { changedKeys, ...data },
          },
        });
        return result;
      });
    } catch (error) {
      if (error.code === "P2002") {
        throw new AppError(
          "venueAlreadyExists",
          "Sportoviště s tímto názvem a adresou už existuje.",
          409,
          { name: data.name, address: data.address, city: data.city },
        );
      }
      throw error;
    }

    res.json({
      ...toDtoOut(updated),
      uuAppErrorMap: unsupportedKeys(req, dtoIn, ALLOWED_KEYS),
    });
  });

  return router;
}
