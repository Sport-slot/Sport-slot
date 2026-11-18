// court/availability (US 5): volné a obsazené sloty kurtu pro jeden den.
import { Router } from "express";
import { AppError, invalidDtoIn, unsupportedKeys } from "@sportslot/api-format";
import { UUID_PATTERN } from "../gatewayAuth.js";
import { toHourMinute } from "../venueDao.js";

const TIME_ZONE = "Europe/Prague";
const SLOT_MINUTES = 60;

// "2026-11-18" -> 1–7 (Po–Ne), stejně jako dayOfWeek v opening_hours
export function dayOfWeekOf(date) {
  return new Date(`${date}T00:00:00Z`).getUTCDay() || 7;
}

function pragueOffsetMs(instant) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TIME_ZONE,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    })
      .formatToParts(instant)
      .map((part) => [part.type, Number(part.value)]),
  );
  const local = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return local - instant;
}

// Místní čas v Praze ("2026-11-18", "08:00") -> Date. Druhý průchod opraví posun v den přechodu na letní čas.
export function pragueTime(date, time) {
  const asUtc = Date.parse(`${date}T${time}:00Z`);
  let instant = asUtc - pragueOffsetMs(asUtc);
  instant = asUtc - pragueOffsetMs(instant);
  return new Date(instant);
}

function minutesOf(time) {
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
}

function timeOf(minutes) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

// Hodinové sloty od otevření do zavření; slot je volný, když ho nepřekrývá aktivní rezervace a ještě nezačal.
export function buildSlots({ date, openTime, closeTime, reservations, now = new Date() }) {
  const slotList = [];
  for (let start = minutesOf(openTime); start + SLOT_MINUTES <= minutesOf(closeTime); start += SLOT_MINUTES) {
    const startTime = timeOf(start);
    const endTime = timeOf(start + SLOT_MINUTES);
    const startAt = pragueTime(date, startTime);
    const endAt = pragueTime(date, endTime);
    const taken = reservations.some((r) => r.startAt < endAt && r.endAt > startAt);
    slotList.push({
      startTime,
      endTime,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      free: !taken && startAt > now,
    });
  }
  return slotList;
}

function isRealDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(date);
}

export function createCourtAvailabilityRouter({ db }) {
  const router = Router();

  router.get("/availability", async (req, res) => {
    const dtoIn = req.query;
    const { courtId, date } = dtoIn;
    const missingKeyMap = {};
    const invalidTypeKeyMap = {};
    const invalidValueKeyMap = {};

    if (courtId === undefined) missingKeyMap.courtId = "courtId je povinný.";
    else if (typeof courtId !== "string") invalidTypeKeyMap.courtId = "courtId musí být řetězec.";
    else if (!UUID_PATTERN.test(courtId)) invalidValueKeyMap.courtId = "courtId musí být platné UUID.";

    if (date === undefined) missingKeyMap.date = "date je povinný.";
    else if (typeof date !== "string") invalidTypeKeyMap.date = "date musí být řetězec.";
    else if (!isRealDate(date)) invalidValueKeyMap.date = "date musí být platné datum ve tvaru YYYY-MM-DD.";

    if (
      Object.keys(missingKeyMap).length ||
      Object.keys(invalidTypeKeyMap).length ||
      Object.keys(invalidValueKeyMap).length
    ) {
      throw invalidDtoIn({ missingKeyMap, invalidTypeKeyMap, invalidValueKeyMap });
    }

    const dayOfWeek = dayOfWeekOf(date);
    const court = await db.court.findUnique({
      where: { id: courtId },
      select: {
        venueId: true,
        venue: {
          select: {
            deactivatedAt: true,
            openingHours: {
              where: { dayOfWeek },
              select: { openTime: true, closeTime: true },
            },
          },
        },
      },
    });

    if (!court) {
      throw new AppError("courtDoesNotExist", "Kurt nenalezen.", 404, { courtId });
    }

    // reservation/create deaktivované sportoviště odmítne, proto mu nenabízíme volné termíny
    if (court.venue.deactivatedAt) {
      throw new AppError("venueIsNotActive", "Sportoviště je deaktivované.", 409, {
        venueId: court.venueId,
      });
    }

    const hours = court.venue.openingHours[0];
    const openTime = hours ? toHourMinute(hours.openTime) : null;
    const closeTime = hours ? toHourMinute(hours.closeTime) : null;
    let slotList = [];

    if (hours) {
      const reservations = await db.reservation.findMany({
        where: {
          courtId,
          status: "ACTIVE",
          startAt: { lt: pragueTime(date, closeTime) },
          endAt: { gt: pragueTime(date, openTime) },
        },
        select: { startAt: true, endAt: true },
      });
      slotList = buildSlots({ date, openTime, closeTime, reservations });
    }

    res.json({
      courtId,
      venueId: court.venueId,
      date,
      dayOfWeek,
      openTime,
      closeTime,
      slotList,
      uuAppErrorMap: unsupportedKeys(req, dtoIn, ["courtId", "date"]),
    });
  });

  return router;
}
