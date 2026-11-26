-- CreateIndex
CREATE INDEX "reservations_player_id_start_at_idx" ON "reservation"."reservations"("player_id", "start_at");
