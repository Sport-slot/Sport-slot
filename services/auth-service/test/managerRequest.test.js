import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { describe, it } from 'node:test'
import request from 'supertest'
import { createApp } from '../src/app.js'

const SECRET = 'x'.repeat(32)
const ADMIN_ID = '00000000-0000-4000-8000-000000000001'
const PLAYER_ID = '00000000-0000-4000-8000-000000000002'

const as = (userId) => ({ 'x-gateway-secret': SECRET, 'x-user-id': userId })

function setup() {
	const users = new Map([
		[ADMIN_ID, { id: ADMIN_ID, email: 'a@x.cz', name: 'Admin', roles: ['PLAYER', 'ADMIN'] }],
		[PLAYER_ID, { id: PLAYER_ID, email: 'p@x.cz', name: 'Player', roles: ['PLAYER'] }],
	])
	const requests = new Map()
	const auditCalls = []

	const userDao = { get: async (id) => users.get(id) ?? null }

	const managerRequestDao = {
		get: async (id) => requests.get(id) ?? null,
		findPendingByUser: async (userId) =>
			[...requests.values()].find((r) => r.userId === userId && r.status === 'PENDING') ?? null,
		list: async ({ status } = {}) =>
			[...requests.values()]
				.filter((r) => !status || r.status === status)
				.map((r) => ({ ...r, user: users.get(r.userId) })),
		create: async ({ userId, message }) => {
			const r = {
				id: randomUUID(),
				userId,
				message: message ?? null,
				status: 'PENDING',
				decidedById: null,
				createdAt: new Date(),
				decidedAt: null,
			}
			requests.set(r.id, r)
			return r
		},
		decide: async (id, status, adminId) => {
			const r = requests.get(id)
			if (!r || r.status !== 'PENDING') return null
			Object.assign(r, { status, decidedById: adminId, decidedAt: new Date() })
			if (status === 'APPROVED') {
				const u = users.get(r.userId)
				if (!u.roles.includes('MANAGER')) u.roles.push('MANAGER')
			}
			return r
		},
	}

	const app = createApp({
		userDao,
		managerRequestDao,
		gatewaySecret: SECRET,
		audit: async (event) => auditCalls.push(event),
	})

	const seedPending = () =>
		managerRequestDao.create({ userId: PLAYER_ID, message: 'Chci spravovat kurty' })

	return { app, users, requests, auditCalls, seedPending }
}

describe('POST /managerRequest/create', () => {
	it('creates a PENDING request for a player', async () => {
		const { app, requests } = setup()
		const res = await request(app)
			.post('/managerRequest/create')
			.set(as(PLAYER_ID))
			.send({ message: 'Ahoj' })
		assert.equal(res.status, 200)
		assert.equal(res.body.status, 'PENDING')
		assert.equal(requests.size, 1)
	})

	it('rejects a second pending request with 409', async () => {
		const { app, seedPending } = setup()
		await seedPending()
		const res = await request(app).post('/managerRequest/create').set(as(PLAYER_ID)).send({})
		assert.equal(res.status, 409)
	})

	it('rejects someone who is already a manager/admin with 409', async () => {
		const { app } = setup()
		const res = await request(app).post('/managerRequest/create').set(as(ADMIN_ID)).send({})
		assert.equal(res.status, 409)
	})

	it('returns 401 without gateway headers', async () => {
		const { app } = setup()
		const res = await request(app).post('/managerRequest/create').send({})
		assert.equal(res.status, 401)
	})
})

describe('GET /managerRequest/list', () => {
	it('returns 401 without auth and 403 for a player', async () => {
		const { app } = setup()
		assert.equal((await request(app).get('/managerRequest/list')).status, 401)
		assert.equal((await request(app).get('/managerRequest/list').set(as(PLAYER_ID))).status, 403)
	})

	it('lists requests for admin, with status filter', async () => {
		const { app, seedPending } = setup()
		const pending = await seedPending()
		await request(app).post('/managerRequest/reject').set(as(ADMIN_ID)).send({ id: pending.id })
		await seedPending()

		const all = await request(app).get('/managerRequest/list').set(as(ADMIN_ID))
		assert.equal(all.status, 200)
		assert.equal(all.body.itemList.length, 2)

		const onlyPending = await request(app)
			.get('/managerRequest/list?status=PENDING')
			.set(as(ADMIN_ID))
		assert.equal(onlyPending.body.itemList.length, 1)
	})

	it('returns 400 for an invalid status', async () => {
		const { app } = setup()
		const res = await request(app).get('/managerRequest/list?status=NOPE').set(as(ADMIN_ID))
		assert.equal(res.status, 400)
	})
})

describe('POST /managerRequest/approve and reject', () => {
	it('returns 403 for a player', async () => {
		const { app, seedPending } = setup()
		const r = await seedPending()
		const res = await request(app)
			.post('/managerRequest/approve')
			.set(as(PLAYER_ID))
			.send({ id: r.id })
		assert.equal(res.status, 403)
	})

	it('returns 400 for missing or invalid id', async () => {
		const { app } = setup()
		const missing = await request(app).post('/managerRequest/approve').set(as(ADMIN_ID)).send({})
		assert.equal(missing.status, 400)
		const invalid = await request(app)
			.post('/managerRequest/approve')
			.set(as(ADMIN_ID))
			.send({ id: 'abc' })
		assert.equal(invalid.status, 400)
	})

	it('returns 404 for an unknown request', async () => {
		const { app } = setup()
		const res = await request(app)
			.post('/managerRequest/approve')
			.set(as(ADMIN_ID))
			.send({ id: randomUUID() })
		assert.equal(res.status, 404)
	})

	it('approve: sets APPROVED, grants MANAGER, emits audit event', async () => {
		const { app, users, seedPending, auditCalls } = setup()
		const r = await seedPending()
		const res = await request(app)
			.post('/managerRequest/approve')
			.set(as(ADMIN_ID))
			.send({ id: r.id })
		assert.equal(res.status, 200)
		assert.equal(res.body.status, 'APPROVED')
		assert.equal(res.body.decidedById, ADMIN_ID)
		assert.ok(users.get(PLAYER_ID).roles.includes('MANAGER'))
		assert.equal(auditCalls.length, 1)
		assert.equal(auditCalls[0].action, 'MANAGER_APPROVED')
	})

	it('reject: sets REJECTED, no MANAGER role, no audit event', async () => {
		const { app, users, seedPending, auditCalls } = setup()
		const r = await seedPending()
		const res = await request(app)
			.post('/managerRequest/reject')
			.set(as(ADMIN_ID))
			.send({ id: r.id })
		assert.equal(res.status, 200)
		assert.equal(res.body.status, 'REJECTED')
		assert.ok(!users.get(PLAYER_ID).roles.includes('MANAGER'))
		assert.equal(auditCalls.length, 0)
	})

	it('returns 409 when the request was already decided', async () => {
		const { app, seedPending } = setup()
		const r = await seedPending()
		await request(app).post('/managerRequest/approve').set(as(ADMIN_ID)).send({ id: r.id })
		const res = await request(app)
			.post('/managerRequest/reject')
			.set(as(ADMIN_ID))
			.send({ id: r.id })
		assert.equal(res.status, 409)
	})
})