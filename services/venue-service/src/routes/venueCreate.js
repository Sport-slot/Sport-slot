import { Router } from "express";
import { AppError, invalidDtoIn, unsupportedKeys } from "@sportslot/api-format";
import { managerIdFromGateway } from "../gatewayAuth.js";
import { VENUE_IMAGE_URL_PATTERN } from "./venueImage.js";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const TEXT_LIMITS = { name: 100, address: 200, city: 100 };
const DESCRIPTION_LIMIT = 2000;
const IMAGE_URL_LIMIT = 500;
const BUNDLED_IMAGE_PATTERN = /^\/images\/venues\/[a-z0-9-]+\.(webp|jpg|png)$/;
const ALLOWED_KEYS = [
  "name",
  "address",
  "city",
  "description",
  "openingHoursList",
  "imageUrl",
];

function validateOpeningHoursList(value, maps) {
  if (value === undefined) {
    maps.missingKeyMap.openingHoursList = "openingHoursList je povinný.";
    return;
  }

  if (!Array.isArray(value)) {
    maps.invalidTypeKeyMap.openingHoursList = "openingHoursList musí být pole.";
    return;
  }

  if (value.length < 1 || value.length > 7) {
    maps.invalidValueKeyMap.openingHoursList =
      "Sportoviště musí být otevřené alespoň jeden a nejvýše sedm dní.";
    return;
  }

  const seenDays = new Set();

  value.forEach((hours, index) => {
    const key = `openingHoursList[${index}]`;

    if (!hours || typeof hours !== "object" || Array.isArray(hours)) {
      maps.invalidTypeKeyMap[key] = "Položka musí být objekt.";
      return;
    }

    const { dayOfWeek, openTime, closeTime } = hours;

    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 1 || dayOfWeek > 7) {
      maps.invalidValueKeyMap[`${key}.dayOfWeek`] =
        "dayOfWeek musí být celé číslo 1–7.";
    } else if (seenDays.has(dayOfWeek)) {
      maps.invalidValueKeyMap[`${key}.dayOfWeek`] =
        "Každý den smí být uveden jen jednou.";
    } else {
      seenDays.add(dayOfWeek);
    }

    const validOpen = typeof openTime === "string" && TIME_PATTERN.test(openTime);
    const validClose =
      typeof closeTime === "string" && TIME_PATTERN.test(closeTime);

    if (!validOpen) {
      maps.invalidValueKeyMap[`${key}.openTime`] = "openTime musí být HH:MM.";
    }

    if (!validClose) {
      maps.invalidValueKeyMap[`${key}.closeTime`] = "closeTime musí být HH:MM.";
    }

    if (validOpen && validClose && closeTime <= openTime) {
      maps.invalidValueKeyMap[`${key}.closeTime`] =
        "Zavírací čas musí být po otevíracím.";
    }
  });
}

function validateDtoIn(dtoIn) {
  const maps = {
    missingKeyMap: {},
    invalidTypeKeyMap: {},
    invalidValueKeyMap: {},
  };

  for (const [key, limit] of Object.entries(TEXT_LIMITS)) {
    const value = dtoIn[key];

    if (value === undefined) {
      maps.missingKeyMap[key] = `${key} je povinný.`;
    } else if (typeof value !== "string") {
      maps.invalidTypeKeyMap[key] = `${key} musí být řetězec.`;
    } else if (!value.trim() || value.trim().length > limit) {
      maps.invalidValueKeyMap[key] =
        `${key} musí obsahovat 1 až ${limit} znaků.`;
    }
  }

  const { description } = dtoIn;

  if (description !== undefined) {
    if (typeof description !== "string") {
      maps.invalidTypeKeyMap.description = "description musí být řetězec.";
    } else if (description.trim().length > DESCRIPTION_LIMIT) {
      maps.invalidValueKeyMap.description =
        `description smí mít nejvýše ${DESCRIPTION_LIMIT} znaků.`;
    }
  }

  validateOpeningHoursList(dtoIn.openingHoursList, maps);

  const { imageUrl } = dtoIn;

  if (imageUrl !== undefined && imageUrl !== null) {
    if (typeof imageUrl !== "string") {
      maps.invalidTypeKeyMap.imageUrl = "imageUrl musí být řetězec.";
    } else if (
      imageUrl.length > IMAGE_URL_LIMIT ||
      !(VENUE_IMAGE_URL_PATTERN.test(imageUrl) || BUNDLED_IMAGE_PATTERN.test(imageUrl))
    ) {
      maps.invalidValueKeyMap.imageUrl =
        "imageUrl musí odkazovat na nahranou fotku sportoviště.";
    }
  }

  const hasErrors = Object.values(maps).some(
    (map) => Object.keys(map).length > 0,
  );

  if (hasErrors) {
    throw invalidDtoIn(maps);
  }
}

function toTime(hourMinute) {
  return new Date(`1970-01-01T${hourMinute}:00.000Z`);
}

function toHourMinute(time) {
  return time.toISOString().slice(11, 16);
}

export function createVenueCreateRouter({
  db,
  gatewaySecret = process.env.GATEWAY_SECRET,
}) {
  const router = Router();

  router.post("/create", async (req, res) => {
    const managerId = managerIdFromGateway(req, gatewaySecret);
    const dtoIn = req.body;

    if (!dtoIn || typeof dtoIn !== "object" || Array.isArray(dtoIn)) {
      throw invalidDtoIn({
        invalidTypeKeyMap: { dtoIn: "Tělo požadavku musí být JSON objekt." },
      });
    }

    validateDtoIn(dtoIn);

    const name = dtoIn.name.trim();
    const address = dtoIn.address.trim();
    const city = dtoIn.city.trim();
    const description = dtoIn.description?.trim() || null;
    const imageUrl = dtoIn.imageUrl ?? null;
    const uploadedImageId = imageUrl?.match(VENUE_IMAGE_URL_PATTERN)?.[1];

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

    let venue;

    try {
      venue = await db.venue.create({
        data: {
          managerId,
          name,
          address,
          city,
          description,
          imageUrl,
          openingHours: {
            create: dtoIn.openingHoursList.map((hours) => ({
              dayOfWeek: hours.dayOfWeek,
              openTime: toTime(hours.openTime),
              closeTime: toTime(hours.closeTime),
            })),
          },
        },
        select: {
          id: true,
          managerId: true,
          name: true,
          address: true,
          city: true,
          description: true,
          imageUrl: true,
          createdAt: true,
          openingHours: {
            orderBy: { dayOfWeek: "asc" },
            select: { dayOfWeek: true, openTime: true, closeTime: true },
          },
        },
      });
    } catch (error) {
      if (error.code === "P2002") {
        throw new AppError(
          "venueAlreadyExists",
          "Sportoviště s tímto názvem a adresou už existuje.",
          409,
          { name, address, city },
        );
      }

      throw error;
    }

    const { openingHours, ...venueFields } = venue;

    res.json({
      ...venueFields,
      openingHoursList: openingHours.map((hours) => ({
        dayOfWeek: hours.dayOfWeek,
        openTime: toHourMinute(hours.openTime),
        closeTime: toHourMinute(hours.closeTime),
      })),
      uuAppErrorMap: unsupportedKeys(req, dtoIn, ALLOWED_KEYS),
    });
  });

  return router;
}
