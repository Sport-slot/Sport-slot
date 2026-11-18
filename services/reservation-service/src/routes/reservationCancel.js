import { Router } from 'express'
import { AppError, invalidDtoIn, notAuthorized, unsupportedKeys } from '@sportslot/api-format'
import { playerIdFromGateway, UUID_PATTERN } from '../gatewayAuth.js'

const ALLOWED_KEYS = ['id']
const CANCELLATION_DEADLINE_MS = 24 * 60 * 60 * 1000

const reservationSelect = {
	id: true,
	courtId: true,
	venueId: true,
	playerId: true,
	playerName: true,
	startAt: true,
	endAt: true,
	totalPrice: true,
	status: true,
	createdAt: true,
	cancelledAt: true,
}

function toDtoOut(reservation) {
	return {
		id: reservation.id,
		courtId: reservation.courtId,
		venueId: reservation.venueId,
		playerId: reservation.playerId,
		playerName: reservation.playerName,
		startAt: reservation.startAt.toISOString(),
		endAt: reservation.endAt.toISOString(),
		totalPrice: Number(reservation.totalPrice),
		status: reservation.status,
		createdAt: reservation.createdAt.toISOString(),
		cancelledAt: reservation.cancelledAt ? reservation.cancelledAt.toISOString() : null,
	}
}

function validateDtoIn(dtoIn) {
	if (dtoIn.id === undefined) {
		throw invalidDtoIn({ missingKeyMap: { id: 'id je povinný.' } })
	}
	if (typeof dtoIn.id !== 'string') {
		throw invalidDtoIn({ invalidTypeKeyMap: { id: 'id musí být řetězec.' } })
	}
	if (!UUID_PATTERN.test(dtoIn.id)) {
		throw invalidDtoIn({ invalidValueKeyMap: { id: 'id musí být platné UUID.' } })
	}
}

export function createReservationCancelRouter({ db, gatewaySecret = process.env.GATEWAY_SECRET, now = () => new Date() }) {
	const router = Router()

	router.post('/cancel', async (req, res) => {
		const playerId = playerIdFromGateway(req, gatewaySecret)
		const dtoIn = req.body

		if (!dtoIn || typeof dtoIn !== 'object' || Array.isArray(dtoIn)) {
			throw invalidDtoIn({ invalidTypeKeyMap: { dtoIn: 'Tělo požadavku musí být JSON objekt.' } })
		}

		validateDtoIn(dtoIn)

		const reservation = await db.reservation.findUnique({ where: { id: dtoIn.id }, select: reservationSelect })

		if (!reservation) {
			throw new AppError('reservationDoesNotExist', 'Rezervace nenalezena.', 404, { id: dtoIn.id })
		}

		if (reservation.playerId !== playerId) {
			throw notAuthorized()
		}

		const uuAppErrorMap = unsupportedKeys(req, dtoIn, ALLOWED_KEYS)

		if (reservation.status !== 'ACTIVE') {
			return res.json({ ...toDtoOut(reservation), uuAppErrorMap })
		}

		const current = now()
		const cancellableUntil = new Date(reservation.startAt.getTime() - CANCELLATION_DEADLINE_MS)

		if (current >= cancellableUntil) {
			throw new AppError(
				'cancellationTooLate',
				'Rezervaci lze zrušit nejpozději 24 hodin před jejím začátkem.',
				400,
				{ startAt: reservation.startAt.toISOString(), cancellableUntil: cancellableUntil.toISOString() },
			)
		}

		const updated = await db.$transaction(async (tx) => {
			const { count } = await tx.reservation.updateMany({
				where: { id: reservation.id, status: 'ACTIVE' },
				data: { status: 'CANCELLED', cancelledAt: current },
			})
			if (count === 1) {
				await tx.auditLog.create({
					data: {
						userId: playerId,
						action: 'reservation/cancel',
						entityType: 'Reservation',
						entityId: reservation.id,
						details: {
							courtId: reservation.courtId,
							venueId: reservation.venueId,
							startAt: reservation.startAt.toISOString(),
							endAt: reservation.endAt.toISOString(),
						},
					},
				})
			}
			return tx.reservation.findUnique({ where: { id: reservation.id }, select: reservationSelect })
		})

		res.json({ ...toDtoOut(updated), uuAppErrorMap })
	})

	return router
}
