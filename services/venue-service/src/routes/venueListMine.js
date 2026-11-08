import { Router } from "express";
import { unsupportedKeys } from "@sportslot/api-format";
import { managerIdFromGateway } from "../gatewayAuth.js";

function sportsOf(courts) {
  return [
    ...new Set(
      courts.flatMap((court) =>
        court.sport
          .split(",")
          .map((sport) => sport.trim())
          .filter(Boolean),
      ),
    ),
  ];
}

export function createVenueListMineRouter({
  db,
  gatewaySecret = process.env.GATEWAY_SECRET,
}) {
  const router = Router();

  router.get("/listMine", async (req, res) => {
    const managerId = managerIdFromGateway(req, gatewaySecret);

    const venues = await db.venue.findMany({
      where: { managerId },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: {
        id: true,
        name: true,
        city: true,
        imageUrl: true,
        deactivatedAt: true,
        createdAt: true,
        courts: { select: { sport: true } },
      },
    });

    res.json({
      itemList: venues.map((venue) => ({
        id: venue.id,
        name: venue.name,
        city: venue.city,
        imageUrl: venue.imageUrl ?? null,
        active: !venue.deactivatedAt,
        deactivatedAt: venue.deactivatedAt ?? null,
        courtCount: venue.courts.length,
        sports: sportsOf(venue.courts),
        createdAt: venue.createdAt,
      })),
      uuAppErrorMap: unsupportedKeys(req, req.query, []),
    });
  });

  return router;
}
