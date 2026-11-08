-- CreateTable
CREATE TABLE "venue"."venue_images" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "uploaded_by" UUID NOT NULL,
    "content_type" VARCHAR(20) NOT NULL,
    "data" BYTEA NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "venue_images_pkey" PRIMARY KEY ("id")
);
