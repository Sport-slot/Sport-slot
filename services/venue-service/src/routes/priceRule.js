import { Router } from "express";
import {
  AppError,
  invalidDtoIn,
  notAuthorized,
  unsupportedKeys,
} from "@sportslot/api-format";
import { managerIdFromGateway, UUID_PATTERN } from "../gatewayAuth.js";
import { toHourMinute } from "../venueDao.js";

const CREATE_KEYS = ["courtId", "dayOfWeek", "startTime", "endTime", "pricePerHour"];
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_PRICE = 99999999.99;

const ruleSelect = {
  id: true,
  courtId: true,
  dayOfWeek: true,
  startTime: true,
  endTime: true,
  pricePerHour: true,
};

function toTime(hourMinute) {
  return new Date(`1970-01-01T${hourMinute}:00.000Z`);
}

function toDtoOut(rule) {
  return {
    id: rule.id,
    courtId: rule.courtId,
    dayOfWeek: rule.dayOfWeek,
    startTime: toHourMinute(rule.startTime),
    endTime: toHourMinute(rule.endTime),
    pricePerHour: Number(rule.pricePerHour),
  };
}

function throwIfInvalid(maps) {
  if (
    Object.keys(maps.missingKeyMap).length ||
    Object.keys(maps.invalidTypeKeyMap).length ||
    Object.keys(maps.invalidValueKeyMap).length
  ) {
    throw invalidDtoIn(maps);
  }
}

function validateCourtId(courtId, maps) {
  if (courtId === undefined) {
    maps.missingKeyMap.courtId = "courtId je povinný.";
  } else if (typeof courtId !== "string") {
    maps.invalidTypeKeyMap.courtId = "courtId musí být řetězec.";
  } else if (!UUID_PATTERN.test(courtId)) {
    maps.invalidValueKeyMap.courtId = "courtId musí být platné UUID.";
  }
}

function validateCreateDtoIn(dtoIn) {
  const maps = { missingKeyMap: {}, invalidTypeKeyMap: {}, invalidValueKeyMap: {} };
  validateCourtId(dtoIn.courtId, maps);

  if (dtoIn.dayOfWeek === undefined) {
    maps.missingKeyMap.dayOfWeek = "dayOfWeek je povinný.";
  } else if (typeof dtoIn.dayOfWeek !== "number") {
    maps.invalidTypeKeyMap.dayOfWeek = "dayOfWeek musí být číslo.";
  } else if (!Number.isInteger(dtoIn.dayOfWeek) || dtoIn.dayOfWeek < 1 || dtoIn.dayOfWeek > 7) {
    maps.invalidValueKeyMap.dayOfWeek = "dayOfWeek musí být celé číslo 1–7 (Po–Ne).";
  }

  for (const key of ["startTime", "endTime"]) {
    if (dtoIn[key] === undefined) {
      maps.missingKeyMap[key] = `${key} je povinný.`;
    } else if (typeof dtoIn[key] !== "string") {
      maps.invalidTypeKeyMap[key] = `${key} musí být řetězec.`;
    } else if (!TIME_PATTERN.test(dtoIn[key])) {
      maps.invalidValueKeyMap[key] = `${key} musí být čas ve formátu HH:MM.`;
    }
  }

  if (
    !maps.invalidValueKeyMap.startTime &&
    !maps.invalidValueKeyMap.endTime &&
    typeof dtoIn.startTime === "string" &&
    typeof dtoIn.endTime === "string" &&
    dtoIn.startTime >= dtoIn.endTime
  ) {
    maps.invalidValueKeyMap.endTime = "endTime musí být později než startTime.";
  }

  if (dtoIn.pricePerHour === undefined) {
    maps.missingKeyMap.pricePerHour = "pricePerHour je povinný.";
  } else if (typeof dtoIn.pricePerHour !== "number" || !Number.isFinite(dtoIn.pricePerHour)) {
    maps.invalidTypeKeyMap.pricePerHour = "pricePerHour musí být číslo.";
  } else if (
    dtoIn.pricePerHour < 0 ||
    dtoIn.pricePerHour > MAX_PRICE ||
    Math.round(dtoIn.pricePerHour * 100) / 100 !== dtoIn.pricePerHour
  ) {
    maps.invalidValueKeyMap.pricePerHour =
      "pricePerHour musí být nezáporná částka v Kč s nejvýše dvěma desetinnými místy.";
  }

  throwIfInvalid(maps);
}

function overlapError(dtoIn, conflict) {
  return new AppError(
    "priceRuleOverlap",
    "Pravidlo se překrývá s jiným pravidlem ceníku kurtu ve stejný den.",
    409,
    {
      courtId: dtoIn.courtId,
      dayOfWeek: dtoIn.dayOfWeek,
      conflictingRule: conflict
        ? { id: conflict.id, startTime: toHourMinute(conflict.startTime), endTime: toHourMinute(conflict.endTime) }
        : null,
    },
  );
}

function isOverlapViolation(error) {
  const text = [error?.code, error?.meta?.code, error?.cause?.code, error?.message].join(" ");
  return text.includes("23P01") || text.includes("price_rules_no_overlap");
}

export function createPriceRuleRouter({ db, gatewaySecret = process.env.GATEWAY_SECRET }) {
  const router = Router();

  router.post("/create", async (req, res) => {
    const managerId = managerIdFromGateway(req, gatewaySecret);
    const dtoIn = req.body;

    if (!dtoIn || typeof dtoIn !== "object" || Array.isArray(dtoIn)) {
      throw invalidDtoIn({ invalidTypeKeyMap: { dtoIn: "Tělo požadavku musí být JSON objekt." } });
    }

    validateCreateDtoIn(dtoIn);

    const court = await db.court.findUnique({
      where: { id: dtoIn.courtId },
      select: { id: true, venueId: true, venue: { select: { managerId: true } } },
    });

    if (!court) {
      throw new AppError("courtDoesNotExist", "Kurt nenalezen.", 404, { courtId: dtoIn.courtId });
    }

    if (court.venue.managerId !== managerId) {
      throw notAuthorized();
    }

    const startTime = toTime(dtoIn.startTime);
    const endTime = toTime(dtoIn.endTime);

    const conflict = await db.priceRule.findFirst({
      where: {
        courtId: dtoIn.courtId,
        dayOfWeek: dtoIn.dayOfWeek,
        startTime: { lt: endTime },
        endTime: { gt: startTime },
      },
      select: { id: true, startTime: true, endTime: true },
    });

    if (conflict) {
      throw overlapError(dtoIn, conflict);
    }

    let rule;
    try {
      rule = await db.$transaction(async (tx) => {
        const created = await tx.priceRule.create({
          data: {
            courtId: dtoIn.courtId,
            dayOfWeek: dtoIn.dayOfWeek,
            startTime,
            endTime,
            pricePerHour: dtoIn.pricePerHour.toFixed(2),
          },
          select: ruleSelect,
        });
        await tx.auditLog.create({
          data: {
            userId: managerId,
            action: "priceRule/create",
            entityType: "PriceRule",
            entityId: created.id,
            details: {
              courtId: dtoIn.courtId,
              venueId: court.venueId,
              dayOfWeek: dtoIn.dayOfWeek,
              startTime: dtoIn.startTime,
              endTime: dtoIn.endTime,
              pricePerHour: dtoIn.pricePerHour,
            },
          },
        });
        return created;
      });
    } catch (error) {
      if (isOverlapViolation(error)) {
        throw overlapError(dtoIn, null);
      }
      throw error;
    }

    res.json({
      ...toDtoOut(rule),
      uuAppErrorMap: unsupportedKeys(req, dtoIn, CREATE_KEYS),
    });
  });

  router.get("/listByCourt", async (req, res) => {
    const dtoIn = req.query;
    const maps = { missingKeyMap: {}, invalidTypeKeyMap: {}, invalidValueKeyMap: {} };
    validateCourtId(dtoIn.courtId, maps);
    throwIfInvalid(maps);

    const court = await db.court.findUnique({
      where: { id: dtoIn.courtId },
      select: { id: true },
    });

    if (!court) {
      throw new AppError("courtDoesNotExist", "Kurt nenalezen.", 404, { courtId: dtoIn.courtId });
    }

    const ruleList = await db.priceRule.findMany({
      where: { courtId: dtoIn.courtId },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      select: ruleSelect,
    });

    res.json({
      courtId: dtoIn.courtId,
      itemList: ruleList.map(toDtoOut),
      uuAppErrorMap: unsupportedKeys(req, dtoIn, ["courtId"]),
    });
  });

  return router;
}
