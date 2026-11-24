import express from 'express'
import { AppError, invalidDtoIn, notAuthenticated, unsupportedKeys } from '@sportslot/api-format'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const STATUSES = ['PENDING', 'APPROVED', 'REJECTED']
const MAX_MESSAGE_LENGTH = 1000

function hasSecret(secret) {
	return typeof secret === 'string' && secret.length >= 32
}

function toDtoOut(r) {
	return {
		id: r.id,
		userId: r.userId,
		message: r.message,
		status: r.status,
		decidedById: r.decidedById,
		createdAt: r.createdAt,
		decidedAt: r.decidedAt,
		...(r.user && { user: { id: r.user.id, email: r.user.email, name: r.user.name } }),
	}
}

function readDtoIn(req) {
	const dtoIn = req.body

	if (!dtoIn || typeof dtoIn !== 'object' || Array.isArray(dtoIn)) {
		throw invalidDtoIn({ invalidTypeKeyMap: { dtoIn: 'Tělo požadavku musí být JSON objekt.' } })
	}

	return dtoIn
}

function readId(dtoIn) {
	if (dtoIn.id === undefined) {
		throw invalidDtoIn({ missingKeyMap: { id: 'id je povinné.' } })
	}

	if (typeof dtoIn.id !== 'string') {
		throw invalidDtoIn({ invalidTypeKeyMap: { id: 'id musí být řetězec.' } })
	}

	if (!UUID_PATTERN.test(dtoIn.id)) {
		throw invalidDtoIn({ invalidValueKeyMap: { id: 'id není platné UUID.' } })
	}

	return dtoIn.id
}

export function createManagerRequestRouter({
	userDao,
	managerRequestDao,
	gatewaySecret,
}) {
	const router = express.Router()

	async function authenticate(req) {
		if (!hasSecret(gatewaySecret)) {
			throw new AppError('gatewayUnavailable', 'Ověření gateway není nakonfigurováno.', 503)
		}

		const userId = req.get('x-user-id')

		if (req.get('x-gateway-secret') !== gatewaySecret || !userId || !UUID_PATTERN.test(userId)) {
			throw notAuthenticated()
		}

		const user = await userDao.get(userId)

		if (!user) throw notAuthenticated()

		return user
	}

	async function requireAdmin(req, _res, next) {
		const user = await authenticate(req)

		if (!user.roles.includes('ADMIN')) {
			throw new AppError('notAuthorized', 'K této akci nemáte oprávnění.', 403)
		}

		req.user = user
		next()
	}

	router.post('/managerRequest/create', async (req, res) => {
		const user = await authenticate(req)
		const dtoIn = readDtoIn(req)
		const { message: rawMessage } = dtoIn

		if (rawMessage !== undefined && typeof rawMessage !== 'string') {
			throw invalidDtoIn({ invalidTypeKeyMap: { message: 'message musí být řetězec.' } })
		}

		const message = rawMessage?.trim() || undefined

		if (message && message.length > MAX_MESSAGE_LENGTH) {
			throw invalidDtoIn({
				invalidValueKeyMap: { message: `message může mít nejvýše ${MAX_MESSAGE_LENGTH} znaků.` },
			})
		}

		if (user.roles.includes('MANAGER') || user.roles.includes('ADMIN')) {
			throw new AppError('alreadyManager', 'Uživatel už má roli správce.', 409)
		}

		if (await managerRequestDao.findPendingByUser(user.id)) {
			throw new AppError('managerRequestAlreadyPending', 'Žádost už čeká na vyřízení.', 409)
		}

		let created
		try {
			created = await managerRequestDao.create({ userId: user.id, message })
		} catch (error) {
			if (managerRequestDao.isPendingConflict?.(error)) {
				throw new AppError('managerRequestAlreadyPending', 'Žádost už čeká na vyřízení.', 409)
			}
			throw error
		}

		res.json({ ...toDtoOut(created), uuAppErrorMap: unsupportedKeys(req, dtoIn, ['message']) })
	})

	router.get('/managerRequest/list', requireAdmin, async (req, res) => {
		const { status } = req.query

		if (status !== undefined && !STATUSES.includes(status)) {
			throw invalidDtoIn({
				invalidValueKeyMap: { status: `status musí být jedna z hodnot: ${STATUSES.join(', ')}.` },
			})
		}

		const items = await managerRequestDao.list({ status })

		res.json({
			itemList: items.map(toDtoOut),
			uuAppErrorMap: unsupportedKeys(req, req.query, ['status']),
		})
	})

	function decideHandler(status) {
		return async (req, res) => {
			const dtoIn = readDtoIn(req)
			const id = readId(dtoIn)
			const alreadyDecided = () =>
				new AppError('managerRequestAlreadyDecided', 'Žádost už byla vyřízena.', 409, { id })

			const existing = await managerRequestDao.get(id)

			if (!existing) {
				throw new AppError('managerRequestDoesNotExist', 'Žádost nenalezena.', 404, { id })
			}

			if (existing.status !== 'PENDING') throw alreadyDecided()

			const decided = await managerRequestDao.decide(id, status, req.user.id)

			if (!decided) throw alreadyDecided()

			res.json({ ...toDtoOut(decided), uuAppErrorMap: unsupportedKeys(req, dtoIn, ['id']) })
		}
	}

	router.post('/managerRequest/approve', requireAdmin, decideHandler('APPROVED'))
	router.post('/managerRequest/reject', requireAdmin, decideHandler('REJECTED'))

	return router
}