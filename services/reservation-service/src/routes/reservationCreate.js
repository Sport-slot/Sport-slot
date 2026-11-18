import { Router } from 'express'
import { AppError, invalidDtoIn, notAuthenticated, unsupportedKeys } from '@sportslot/api-format'
import { playerIdFromGateway, UUID_PATTERN } from '../gatewayAuth.js'
import { formatMinutes, minutesOfTime, toPragueLocal } from '../pragueTime.js'

const ALLOWED_KEYS = ['courtId', 'startAt', 'endAt']
const SLOT_MINUTES = 60
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/

function parseInstant(value) {
	if (typeof value !== 'string' || !ISO_DATE_TIME.test(value)) return null
	const instant = new Date(value)
	return Number.isNaN(instant.getTime()) ? null : instant
}

function validateDtoIn(dtoIn) {
	const missingKeyMap = {}
	const invalidTypeKeyMap = {}
	const invalidValueKeyMap = {}

	if (dtoIn.courtId === undefined) {
		missingKeyMap.courtId = 'courtId je povinný.'
	} else if (typeof dtoIn.courtId !== 'string') {
		invalidTypeKeyMap.courtId = 'courtId musí být řetězec.'
	} else if (!UUID_PATTERN.test(dtoIn.courtId)) {
		invalidValueKeyMap.courtId = 'courtId musí být platné UUID.'
	}

	for (const key of ['startAt', 'endAt']) {
		if (dtoIn[key] === undefined) {
			missingKeyMap[key] = `${key} je povinný.`
		} else if (typeof dtoIn[key] !== 'string') {
			invalidTypeKeyMap[key] = `${key} musí být řetězec.`
		} else if (!parseInstant(dtoIn[key])) {
			invalidValueKeyMap[key] = `${key} musí být datum a čas ve formátu ISO 8601 s časovou zónou.`
		}
	}

	const startAt = parseInstant(dtoIn.startAt)
	const endAt = parseInstant(dtoIn.endAt)

	if (startAt && endAt) {
		const durationMinutes = (endAt - startAt) / 60000
		if (durationMinutes < SLOT_MINUTES || durationMinutes % SLOT_MINUTES !== 0) {
			invalidValueKeyMap.endAt = 'Rezervace musí trvat celé hodiny a končit po svém začátku.'
		}
	}

	if (
		Object.keys(missingKeyMap).length ||
		Object.keys(invalidTypeKeyMap).length ||
		Object.keys(invalidValueKeyMap).length
	) {
		throw invalidDtoIn({ missingKeyMap, invalidTypeKeyMap, invalidValueKeyMap })
	}

	return { startAt, endAt }
}

function slotNotAvailable(courtId, startAt, endAt) {
	return new AppError('slotNotAvailable', 'Termín už je obsazený.', 409, {
		courtId,
		startAt: startAt.toISOString(),
		endAt: endAt.toISOString(),
	})
}

function isOverlapViolation(error) {
	const text = [error?.code, error?.meta?.code, error?.cause?.code, error?.message].join(' ')
	return text.includes('23P01') || text.includes('reservations_no_active_overlap')
}

function priceInCents({ priceRuleList, startMinutes, endMinutes }) {
	let total = 0
	for (let slotStart = startMinutes; slotStart < endMinutes; slotStart += SLOT_MINUTES) {
		const rule = priceRuleList.find(
			(item) => minutesOfTime(item.startTime) <= slotStart && minutesOfTime(item.endTime) >= slotStart + SLOT_MINUTES,
		)
		if (!rule) {
			throw new AppError('priceNotSet', 'Kurt nemá pro zvolený termín nastavený ceník.', 400, {
				startTime: formatMinutes(slotStart),
				endTime: formatMinutes(slotStart + SLOT_MINUTES),
			})
		}
		total += Math.round(Number(rule.pricePerHour) * 100)
	}
	return total
}

export function createReservationCreateRouter({ db, gatewaySecret = process.env.GATEWAY_SECRET, now = () => new Date() }) {
	const router = Router()

	router.post('/create', async (req, res) => {
		const playerId = playerIdFromGateway(req, gatewaySecret)
		const dtoIn = req.body

		if (!dtoIn || typeof dtoIn !== 'object' || Array.isArray(dtoIn)) {
			throw invalidDtoIn({ invalidTypeKeyMap: { dtoIn: 'Tělo požadavku musí být JSON objekt.' } })
		}

		const { startAt, endAt } = validateDtoIn(dtoIn)
		const { courtId } = dtoIn

		if (startAt <= now()) {
			throw new AppError('reservationInPast', 'Termín už začal nebo je v minulosti.', 400, {
				startAt: startAt.toISOString(),
			})
		}

		const localStart = toPragueLocal(startAt)
		const localEnd = toPragueLocal(endAt)
		const startMinutes = localStart.minutes
		const endMinutes = startMinutes + (endAt - startAt) / 60000

		const court = await db.court.findUnique({
			where: { id: courtId },
			select: {
				id: true,
				name: true,
				venueId: true,
				venue: {
					select: {
						name: true,
						deactivatedAt: true,
						openingHours: {
							where: { dayOfWeek: localStart.dayOfWeek },
							select: { openTime: true, closeTime: true },
						},
					},
				},
				priceRules: {
					where: { dayOfWeek: localStart.dayOfWeek },
					select: { startTime: true, endTime: true, pricePerHour: true },
				},
			},
		})

		if (!court) {
			throw new AppError('courtDoesNotExist', 'Kurt nenalezen.', 404, { courtId })
		}

		if (court.venue.deactivatedAt) {
			throw new AppError('venueIsNotActive', 'Sportoviště je deaktivované a nepřijímá rezervace.', 409, {
				venueId: court.venueId,
			})
		}

		const hours = court.venue.openingHours[0]
		const openMinutes = hours ? minutesOfTime(hours.openTime) : null
		const closeMinutes = hours ? minutesOfTime(hours.closeTime) : null
		const fitsOpeningHours =
			hours &&
			localStart.seconds === 0 &&
			localEnd.date === localStart.date &&
			localEnd.minutes === endMinutes &&
			startMinutes >= openMinutes &&
			endMinutes <= closeMinutes &&
			(startMinutes - openMinutes) % SLOT_MINUTES === 0

		if (!fitsOpeningHours) {
			throw new AppError('outsideOpeningHours', 'Termín je mimo otevírací dobu sportoviště.', 400, {
				date: localStart.date,
				openTime: hours ? formatMinutes(openMinutes) : null,
				closeTime: hours ? formatMinutes(closeMinutes) : null,
			})
		}

		const totalCents = priceInCents({ priceRuleList: court.priceRules, startMinutes, endMinutes })

		const player = await db.user.findUnique({ where: { id: playerId }, select: { name: true } })
		if (!player) {
			throw notAuthenticated()
		}

		const clash = await db.reservation.findFirst({
			where: { courtId, status: 'ACTIVE', startAt: { lt: endAt }, endAt: { gt: startAt } },
			select: { id: true },
		})
		if (clash) {
			throw slotNotAvailable(courtId, startAt, endAt)
		}

		const totalPrice = (totalCents / 100).toFixed(2)
		let reservation
		try {
			reservation = await db.$transaction(async (tx) => {
				const created = await tx.reservation.create({
					data: {
						courtId,
						venueId: court.venueId,
						playerId,
						playerName: player.name,
						startAt,
						endAt,
						totalPrice,
					},
				})
				await tx.auditLog.create({
					data: {
						userId: playerId,
						action: 'reservation/create',
						entityType: 'Reservation',
						entityId: created.id,
						details: {
							courtId,
							venueId: court.venueId,
							startAt: startAt.toISOString(),
							endAt: endAt.toISOString(),
							totalPrice: totalCents / 100,
						},
					},
				})
				return created
			})
		} catch (error) {
			if (isOverlapViolation(error)) {
				throw slotNotAvailable(courtId, startAt, endAt)
			}
			throw error
		}

		res.json({
			id: reservation.id,
			courtId,
			courtName: court.name,
			venueId: court.venueId,
			venueName: court.venue.name,
			playerId,
			playerName: reservation.playerName,
			startAt: reservation.startAt.toISOString(),
			endAt: reservation.endAt.toISOString(),
			totalPrice: Number(reservation.totalPrice),
			status: reservation.status,
			createdAt: reservation.createdAt.toISOString(),
			uuAppErrorMap: unsupportedKeys(req, dtoIn, ALLOWED_KEYS),
		})
	})

	return router
}
