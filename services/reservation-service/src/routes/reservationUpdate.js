import { Router } from 'express'
import { AppError, invalidDtoIn, notAuthorized, unsupportedKeys } from '@sportslot/api-format'
import { playerIdFromGateway } from '../gatewayAuth.js'
import { checkSlot, isOverlapViolation, slotNotAvailable, validateDtoIn } from './reservationCreate.js'

const ALLOWED_KEYS = ['id', 'startAt', 'endAt']
const CHANGE_DEADLINE_MS = 24 * 60 * 60 * 1000

function reservationNotActive(id) {
	return new AppError('reservationNotActive', 'Zrušenou rezervaci nelze změnit.', 409, { id })
}

export function createReservationUpdateRouter({ db, gatewaySecret = process.env.GATEWAY_SECRET, now = () => new Date() }) {
	const router = Router()

	router.post('/update', async (req, res) => {
		const playerId = playerIdFromGateway(req, gatewaySecret)
		const dtoIn = req.body

		if (!dtoIn || typeof dtoIn !== 'object' || Array.isArray(dtoIn)) {
			throw invalidDtoIn({ invalidTypeKeyMap: { dtoIn: 'Tělo požadavku musí být JSON objekt.' } })
		}

		const { startAt, endAt } = validateDtoIn(dtoIn, 'id')
		const { id } = dtoIn

		const reservation = await db.reservation.findUnique({ where: { id } })
		if (!reservation) {
			throw new AppError('reservationDoesNotExist', 'Rezervace nenalezena.', 404, { id })
		}
		if (reservation.playerId !== playerId) {
			throw notAuthorized()
		}
		if (reservation.status !== 'ACTIVE') {
			throw reservationNotActive(id)
		}

		const changeableUntil = new Date(reservation.startAt.getTime() - CHANGE_DEADLINE_MS)
		if (now() >= changeableUntil) {
			throw new AppError('changeTooLate', 'Termín rezervace lze změnit nejpozději 24 hodin před jejím začátkem.', 400, {
				startAt: reservation.startAt.toISOString(),
				changeableUntil: changeableUntil.toISOString(),
			})
		}

		const { courtId } = reservation
		const { court, totalCents } = await checkSlot({ db, courtId, startAt, endAt, now })

		const clash = await db.reservation.findFirst({
			where: { id: { not: id }, courtId, status: 'ACTIVE', startAt: { lt: endAt }, endAt: { gt: startAt } },
			select: { id: true },
		})
		if (clash) {
			throw slotNotAvailable(courtId, startAt, endAt)
		}

		let updated
		try {
			updated = await db.$transaction(async (tx) => {
				const { count } = await tx.reservation.updateMany({
					where: { id, status: 'ACTIVE' },
					data: { startAt, endAt, totalPrice: (totalCents / 100).toFixed(2) },
				})
				if (count !== 1) {
					throw reservationNotActive(id)
				}
				await tx.auditLog.create({
					data: {
						userId: playerId,
						action: 'reservation/update',
						entityType: 'Reservation',
						entityId: id,
						details: {
							courtId,
							venueId: reservation.venueId,
							previousStartAt: reservation.startAt.toISOString(),
							previousEndAt: reservation.endAt.toISOString(),
							startAt: startAt.toISOString(),
							endAt: endAt.toISOString(),
							totalPrice: totalCents / 100,
						},
					},
				})
				return tx.reservation.findUnique({ where: { id } })
			})
		} catch (error) {
			if (isOverlapViolation(error)) {
				throw slotNotAvailable(courtId, startAt, endAt)
			}
			throw error
		}

		res.json({
			id: updated.id,
			courtId,
			courtName: court.name,
			venueId: updated.venueId,
			venueName: court.venue.name,
			playerId,
			playerName: updated.playerName,
			startAt: updated.startAt.toISOString(),
			endAt: updated.endAt.toISOString(),
			totalPrice: Number(updated.totalPrice),
			status: updated.status,
			createdAt: updated.createdAt.toISOString(),
			uuAppErrorMap: unsupportedKeys(req, dtoIn, ALLOWED_KEYS),
		})
	})

	return router
}
