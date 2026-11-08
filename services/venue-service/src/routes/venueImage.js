import express, { Router } from "express";
import { AppError, invalidDtoIn, unsupportedKeys } from "@sportslot/api-format";
import { managerIdFromGateway, UUID_PATTERN } from "../gatewayAuth.js";

export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
export const VENUE_IMAGE_URL_PATTERN =
  /^\/venueImage\/get\?id=([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

const SIGNATURES = {
  "image/jpeg": (bytes) =>
    bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  "image/png": (bytes) =>
    bytes.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    ),
  "image/webp": (bytes) =>
    bytes.subarray(0, 4).toString("latin1") === "RIFF" &&
    bytes.subarray(8, 12).toString("latin1") === "WEBP",
};

export function venueImageUrl(id) {
  return `/venueImage/get?id=${id}`;
}

const readImageBody = express.raw({
  type: () => true,
  limit: MAX_IMAGE_BYTES,
});

function readImage(req, res, next) {
  readImageBody(req, res, (error) => {
    if (error?.type === "entity.too.large") {
      return next(
        new AppError(
          "imageTooLarge",
          "Fotka je příliš velká. Nahrajte soubor do 3 MB.",
          413,
          { maxBytes: MAX_IMAGE_BYTES },
        ),
      );
    }
    next(error);
  });
}

export function createVenueImageRouter({
  db,
  gatewaySecret = process.env.GATEWAY_SECRET,
}) {
  const router = Router();

  router.post(
    "/upload",
    (req, res, next) => {
      res.locals.uploadedBy = managerIdFromGateway(req, gatewaySecret);
      next();
    },
    readImage,
    async (req, res) => {
      const { uploadedBy } = res.locals;
      const contentType = (req.get("content-type") ?? "")
        .split(";")[0]
        .trim()
        .toLowerCase();
      const matchesSignature = SIGNATURES[contentType];

      if (!matchesSignature) {
        throw new AppError(
          "unsupportedImageType",
          "Podporujeme jen fotky ve formátu JPEG, PNG nebo WebP.",
          415,
          { contentType },
        );
      }

      const data = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);

      if (data.length === 0) {
        throw invalidDtoIn({ missingKeyMap: { image: "Fotka je povinná." } });
      }

      if (!matchesSignature(data)) {
        throw new AppError(
          "unsupportedImageType",
          "Soubor neodpovídá formátu fotky, kterou deklaruje.",
          415,
          { contentType },
        );
      }

      const image = await db.venueImage.create({
        data: { uploadedBy, contentType, data },
        select: { id: true, contentType: true, createdAt: true },
      });

      res.json({
        id: image.id,
        imageUrl: venueImageUrl(image.id),
        contentType: image.contentType,
        size: data.length,
        createdAt: image.createdAt,
        uuAppErrorMap: unsupportedKeys(req, req.query, []),
      });
    },
  );

  router.get("/get", async (req, res) => {
    const { id } = req.query;

    if (id === undefined) {
      throw invalidDtoIn({ missingKeyMap: { id: "id je povinný." } });
    }

    if (typeof id !== "string" || !UUID_PATTERN.test(id)) {
      throw invalidDtoIn({ invalidValueKeyMap: { id: "id musí být platné UUID." } });
    }

    const image = await db.venueImage.findUnique({
      where: { id },
      select: { contentType: true, data: true },
    });

    if (!image) {
      throw new AppError("venueImageDoesNotExist", "Fotka nenalezena.", 404, { id });
    }

    res.set({
      "Content-Type": image.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "Cross-Origin-Resource-Policy": "cross-origin",
      "X-Content-Type-Options": "nosniff",
    });
    res.send(Buffer.from(image.data));
  });

  return router;
}
