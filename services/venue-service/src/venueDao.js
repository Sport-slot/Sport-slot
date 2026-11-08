function toHourMinute(time) {
  return time.toISOString().slice(11, 16);
}

export function createVenueDao(db) {
  return {
    async list() {
      return db.venue.findMany({
        select: {
          id: true,
          name: true,
          city: true,
          imageUrl: true,
          deactivatedAt: true,
          courts: { select: { sport: true } },
        },
      });
    },

    async get(id) {
      const venue = await db.venue.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          address: true,
          city: true,
          description: true,
          imageUrl: true,
          managerId: true,
          deactivatedAt: true,
          openingHours: {
            orderBy: { dayOfWeek: "asc" },
            select: { dayOfWeek: true, openTime: true, closeTime: true },
          },
          courts: {
            orderBy: [{ name: "asc" }, { id: "asc" }],
            select: {
              id: true,
              name: true,
              sport: true,
              surface: true,
              indoor: true,
            },
          },
        },
      });

      if (!venue) return null;

      return {
        ...venue,
        openingHours: venue.openingHours.map((hours) => ({
          dayOfWeek: hours.dayOfWeek,
          openTime: toHourMinute(hours.openTime),
          closeTime: toHourMinute(hours.closeTime),
        })),
      };
    },
  };
}
