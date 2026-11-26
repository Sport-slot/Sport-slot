-- SportSlot: ukázková aktivita pro prezentace – hráči, rezervace, hodnocení a žádosti o roli správce.
-- Navazuje na seed.sql a seed-demo.sql (sportoviště, kurty, ceníky); bez nich nic nevloží.
-- Spouští jen Alexandr na sdílenou DB, ručně: npm run seed:activity --workspace @sportslot/db
-- Idempotentní: pevná ID a ON CONFLICT DO NOTHING, nic nepřepisuje ani nemaže.
-- Termíny se počítají od dne spuštění (pražský čas): 10 proběhlých a 12 nadcházejících rezervací.
-- Rezervace, která by mimo otevírací dobu, mimo jedno cenové pravidlo nebo přes cizí aktivní rezervaci
-- neprošla přes reservation/create, se tiše přeskočí (join a ON CONFLICT na reservations_no_active_overlap).
-- Audit log je append-only, proto do něj seed nic nezapisuje.

BEGIN;

-- Hráči se zástupným Google ID se nepřihlásí; slouží jako data v přehledech správce a obsazené termíny.
INSERT INTO "app_auth"."users" ("id", "google_id", "email", "name", "roles")
VALUES
	('00000000-0000-4000-8000-000000000011', 'seed-demo-jana-novakova', 'jana.novakova@sportslot.test', 'Jana Nováková', ARRAY['PLAYER']::"app_auth"."Role"[]),
	('00000000-0000-4000-8000-000000000012', 'seed-demo-petr-svoboda', 'petr.svoboda@sportslot.test', 'Petr Svoboda', ARRAY['PLAYER']::"app_auth"."Role"[]),
	('00000000-0000-4000-8000-000000000013', 'seed-demo-lucie-dvorakova', 'lucie.dvorakova@sportslot.test', 'Lucie Dvořáková', ARRAY['PLAYER']::"app_auth"."Role"[]),
	('00000000-0000-4000-8000-000000000014', 'seed-demo-martin-cerny', 'martin.cerny@sportslot.test', 'Martin Černý', ARRAY['PLAYER']::"app_auth"."Role"[]),
	('00000000-0000-4000-8000-000000000015', 'seed-demo-eva-prochazkova', 'eva.prochazkova@sportslot.test', 'Eva Procházková', ARRAY['PLAYER']::"app_auth"."Role"[])
ON CONFLICT DO NOTHING;

-- day = posun ve dnech od dneška, hour = začátek (místní čas), hours = délka. Cena = hodiny × cena pravidla,
-- které celý termín pokrývá (stejně jako reservation/create).
INSERT INTO "reservation"."reservations"
	("id", "court_id", "venue_id", "player_id", "player_name", "start_at", "end_at", "total_price", "status", "created_at", "cancelled_at")
SELECT
	demo.id::uuid,
	court.id,
	court.venue_id,
	player.id,
	player.name,
	slot.start_at,
	slot.end_at,
	demo.hours * rule.price_per_hour,
	demo.status::"reservation"."ReservationStatus",
	LEAST(now(), slot.start_at) - INTERVAL '3 days',
	CASE WHEN demo.status = 'CANCELLED' THEN LEAST(now(), slot.start_at) - INTERVAL '2 days' END
FROM (
	VALUES
		-- proběhlé
		('00000000-0000-4000-8000-000000401001', '00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000201', -12, 17, 2, 'ACTIVE'),
		('00000000-0000-4000-8000-000000401002', '00000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000202', -10, 9, 1, 'ACTIVE'),
		('00000000-0000-4000-8000-000000401003', '00000000-0000-4000-8000-000000000013', '00000000-0000-4000-8000-000000302001', -9, 10, 2, 'ACTIVE'),
		('00000000-0000-4000-8000-000000401004', '00000000-0000-4000-8000-000000000014', '00000000-0000-4000-8000-000000303001', -7, 18, 1, 'ACTIVE'),
		('00000000-0000-4000-8000-000000401005', '00000000-0000-4000-8000-000000000015', '00000000-0000-4000-8000-000000305001', -6, 12, 1, 'ACTIVE'),
		('00000000-0000-4000-8000-000000401006', '00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000309001', -5, 14, 1, 'ACTIVE'),
		('00000000-0000-4000-8000-000000401007', '00000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000304001', -4, 16, 2, 'ACTIVE'),
		('00000000-0000-4000-8000-000000401008', '00000000-0000-4000-8000-000000000013', '00000000-0000-4000-8000-000000000203', -3, 11, 1, 'CANCELLED'),
		('00000000-0000-4000-8000-000000401009', '00000000-0000-4000-8000-000000000014', '00000000-0000-4000-8000-000000307001', -2, 17, 2, 'ACTIVE'),
		('00000000-0000-4000-8000-000000401010', '00000000-0000-4000-8000-000000000015', '00000000-0000-4000-8000-000000000201', -1, 19, 1, 'ACTIVE'),
		-- nadcházející; zítřek na Sportcentru, aby byly v court/availability vidět obsazené sloty
		('00000000-0000-4000-8000-000000401011', '00000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000201', 1, 17, 1, 'ACTIVE'),
		('00000000-0000-4000-8000-000000401012', '00000000-0000-4000-8000-000000000013', '00000000-0000-4000-8000-000000000202', 1, 18, 1, 'ACTIVE'),
		('00000000-0000-4000-8000-000000401013', '00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000202', 2, 17, 1, 'ACTIVE'),
		('00000000-0000-4000-8000-000000401014', '00000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000201', 3, 18, 2, 'ACTIVE'),
		('00000000-0000-4000-8000-000000401015', '00000000-0000-4000-8000-000000000013', '00000000-0000-4000-8000-000000302004', 3, 10, 1, 'ACTIVE'),
		('00000000-0000-4000-8000-000000401016', '00000000-0000-4000-8000-000000000014', '00000000-0000-4000-8000-000000303002', 4, 19, 1, 'ACTIVE'),
		('00000000-0000-4000-8000-000000401017', '00000000-0000-4000-8000-000000000015', '00000000-0000-4000-8000-000000000202', 4, 10, 1, 'CANCELLED'),
		('00000000-0000-4000-8000-000000401018', '00000000-0000-4000-8000-000000000015', '00000000-0000-4000-8000-000000305004', 5, 17, 1, 'ACTIVE'),
		('00000000-0000-4000-8000-000000401019', '00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000306002', 6, 18, 2, 'ACTIVE'),
		('00000000-0000-4000-8000-000000401020', '00000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000308001', 7, 9, 2, 'ACTIVE'),
		('00000000-0000-4000-8000-000000401021', '00000000-0000-4000-8000-000000000013', '00000000-0000-4000-8000-000000310001', 8, 17, 2, 'ACTIVE'),
		('00000000-0000-4000-8000-000000401022', '00000000-0000-4000-8000-000000000014', '00000000-0000-4000-8000-000000000204', 9, 14, 2, 'ACTIVE')
) AS demo (id, player_id, court_id, day, hour, hours, status)
JOIN "app_auth"."users" AS player ON player.id = demo.player_id::uuid
JOIN "venue"."courts" AS court ON court.id = demo.court_id::uuid
JOIN "venue"."venues" AS venue ON venue.id = court.venue_id AND venue.deactivated_at IS NULL
CROSS JOIN LATERAL (
	SELECT
		(now() AT TIME ZONE 'Europe/Prague')::date + demo.day AS local_date,
		make_time(demo.hour, 0, 0) AS local_start,
		make_time(demo.hour + demo.hours, 0, 0) AS local_end
) AS local
CROSS JOIN LATERAL (
	SELECT
		(local.local_date + local.local_start) AT TIME ZONE 'Europe/Prague' AS start_at,
		(local.local_date + local.local_end) AT TIME ZONE 'Europe/Prague' AS end_at,
		EXTRACT(ISODOW FROM local.local_date)::int AS day_of_week
) AS slot
JOIN "venue"."opening_hours" AS hours
	ON hours.venue_id = court.venue_id
	AND hours.day_of_week = slot.day_of_week
	AND hours.open_time <= local.local_start
	AND hours.close_time >= local.local_end
	AND EXTRACT(EPOCH FROM local.local_start - hours.open_time)::int % 3600 = 0
JOIN "venue"."price_rules" AS rule
	ON rule.court_id = court.id
	AND rule.day_of_week = slot.day_of_week
	AND rule.start_time <= local.local_start
	AND rule.end_time >= local.local_end
ON CONFLICT DO NOTHING;

-- Hodnocení jen u proběhlých aktivních rezervací, které se opravdu vložily.
INSERT INTO "review"."reviews" ("id", "reservation_id", "venue_id", "player_id", "rating", "comment", "created_at")
SELECT demo.id::uuid, reservation.id, reservation.venue_id, reservation.player_id, demo.rating, demo.comment, reservation.end_at + INTERVAL '2 hours'
FROM (
	VALUES
		('00000000-0000-4000-8000-000000501001', '00000000-0000-4000-8000-000000401001', 5, 'Skvělý povrch a dobré osvětlení, večer jsme hráli bez problémů.'),
		('00000000-0000-4000-8000-000000501002', '00000000-0000-4000-8000-000000401002', 4, 'Kurt v pořádku, jen šatny by chtěly opravit.'),
		('00000000-0000-4000-8000-000000501003', '00000000-0000-4000-8000-000000401003', 5, 'Antuka krásně udržovaná, příjemné prostředí u parku.'),
		('00000000-0000-4000-8000-000000501004', '00000000-0000-4000-8000-000000401004', 4, 'Padel super, půjčené rakety trochu opotřebované.'),
		('00000000-0000-4000-8000-000000501005', '00000000-0000-4000-8000-000000401005', 3, 'Hala byla dost studená, jinak bez výhrad.'),
		('00000000-0000-4000-8000-000000501006', '00000000-0000-4000-8000-000000401007', 5, NULL),
		('00000000-0000-4000-8000-000000501007', '00000000-0000-4000-8000-000000401009', 4, 'Písek čistý, večer s osvětlením paráda.')
) AS demo (id, reservation_id, rating, comment)
JOIN "reservation"."reservations" AS reservation
	ON reservation.id = demo.reservation_id::uuid
	AND reservation.status = 'ACTIVE'
	AND reservation.end_at < now()
ON CONFLICT DO NOTHING;

-- Čekající žádosti, aby měl administrátor co schválit (managerRequest/approve).
INSERT INTO "app_auth"."manager_requests" ("id", "user_id", "message", "created_at")
VALUES
	('00000000-0000-4000-8000-000000601001', '00000000-0000-4000-8000-000000000014', 'Provozuji dva squashové kurty v Brně a chtěl bych je nabízet přes SportSlot.', now() - INTERVAL '2 days'),
	('00000000-0000-4000-8000-000000601002', '00000000-0000-4000-8000-000000000015', 'Spravuji školní tělocvičnu, která je večer a o víkendu volná pro veřejnost.', now() - INTERVAL '1 day')
ON CONFLICT DO NOTHING;

COMMIT;
