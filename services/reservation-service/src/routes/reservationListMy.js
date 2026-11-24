import { Router } from 'express'
import { invalidDtoIn, unsupportedKeys } from '@sportslot/api-format'
import { playerIdFromGateway } from '../gatewayAuth.js'

const ALLOWED_KEYS = ['pageIndex', 'pageSize', 'period']
const PERIODS = ['upcoming', 'past']
const DEFAULT_PAGE_SIZE = 20

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

function parsePageNumber(value, defaultValue, minimum) {
	if (value === undefined) return defaultValue
	if (typeof value !== 'string' || !/^\d+$/.test(value)) return null
	const number = Number(value)
	if (!Number.isSafeInteger(number) || number < minimum) return null
	return number
}

function toDtoOut(reservation, court) {
	return {
		id: reservation.id,
		courtId: reservation.courtId,
		courtName: court?.name ?? null,
		venueId: reservation.venueId,
		venueName: court?.venue?.name ?? null,
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

export function createReservationListMyRouter({ db, gatewaySecret = process.env.GATEWAY_SECRET, now = () => new Date() }) {
	const router = Router()

	router.get('/listMy', async (req, res) => {
		const playerId = playerIdFromGateway(req, gatewaySecret)
		const { period } = req.query

		const invalidTypeKeyMap = {}
		const invalidValueKeyMap = {}

		const pageIndex = parsePageNumber(req.query.pageIndex, 0, 0)
		const pageSize = parsePageNumber(req.query.pageSize, DEFAULT_PAGE_SIZE, 1)

		if (pageIndex === null) invalidValueKeyMap.pageIndex = 'pageIndex musí být celé číslo od 0.'
		if (pageSize === null) invalidValueKeyMap.pageSize = 'pageSize musí být kladné celé číslo.'

		if (period !== undefined) {
			if (typeof period !== 'string') {
				invalidTypeKeyMap.period = 'period musí být řetězec.'
			} else if (!PERIODS.includes(period)) {
				invalidValueKeyMap.period = `period musí být jedna z hodnot: ${PERIODS.join(', ')}.`
			}
		}

		if (Object.keys(invalidTypeKeyMap).length || Object.keys(invalidValueKeyMap).length) {
			throw invalidDtoIn({ invalidTypeKeyMap, invalidValueKeyMap })
		}

		const skip = pageIndex * pageSize
		if (!Number.isSafeInteger(skip)) {
			throw invalidDtoIn({ invalidValueKeyMap: { pageIndex: 'Požadovaná stránka je příliš vysoká.' } })
		}

		// Nadcházející = ještě neskončila, minulé = už skončila. Zrušené rezervace se vracejí se stavem CANCELLED.
		const where = { playerId }
		if (period === 'upcoming') where.endAt = { gt: now() }
		if (period === 'past') where.endAt = { lte: now() }

		const direction = period === 'upcoming' ? 'asc' : 'desc'

		const [total, reservations] = await Promise.all([
			db.reservation.count({ where }),
			db.reservation.findMany({
				where,
				orderBy: [{ startAt: direction }, { id: 'asc' }],
				skip,
				take: pageSize,
				select: reservationSelect,
			}),
		])

		const courtIds = [...new Set(reservations.map((reservation) => reservation.courtId))]
		const courts = courtIds.length
			? await db.court.findMany({
					where: { id: { in: courtIds } },
					select: { id: true, name: true, venue: { select: { name: true } } },
				})
			: []
		const courtById = new Map(courts.map((court) => [court.id, court]))

		res.json({
			itemList: reservations.map((reservation) => toDtoOut(reservation, courtById.get(reservation.courtId))),
			pageInfo: { pageIndex, pageSize, total },
			uuAppErrorMap: unsupportedKeys(req, req.query, ALLOWED_KEYS),
		})
	})

	return router
}
