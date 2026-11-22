import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import request from 'supertest'
import { createApp } from '../src/app.js'

const SECRET = 'x'.repeat(32)
const ADMIN_ID = '00000000-0000-4000-8000-000000000001'

const as = (roles) => ({
	'x-gateway-secret': SECRET,
	'x-user-id': ADMIN_ID,
	'x-user-roles': roles,
})

function setup() {
	const calls = []
	const rows = [
		{
			id: '00000000-0000-4000-8000-0000000000a1',
			userId: ADMIN_ID,
			action: 'reservation/create',
			entityType: 'Reservation',
			entityId: '00000000-0000-4000-8000-0000000000b1',
			details: { courtId: 'x' },
			createdAt: new Date('2026-11-20T10:00:00Z'),
		},
		{
			id: '00000000-0000-4000-8000-0000000000a2',
			userId: null,
			action: 'priceRule/create',
			entityType: 'PriceRule',
			entityId: '00000000-0000-4000-8000-0000000000b2',
			details: null,
			createdAt: new Date('2026-11-19T10:00:00Z'),
		},
	]

	const auditLogDao = {
		list: async (params) => {
			calls.push(params)
			return { items: rows, total: 42 }
		},
	}

	const app = createApp({ auditLogDao, gatewaySecret: SECRET })

	return { app, calls }
}

describe('GET /audit/list', () => {
	it('returns 401 without gateway headers', async () => {
		const { app, calls } = setup()
		const res = await request(app).get('/audit/list')
		assert.equal(res.status, 401)
		assert.equal(calls.length, 0)
	})

	it('returns 401 for a wrong gateway secret', async () => {
		const { app } = setup()
		const res = await request(app)
			.get('/audit/list')
			.set({ ...as('PLAYER,ADMIN'), 'x-gateway-secret': 'y'.repeat(32) })
		assert.equal(res.status, 401)
	})

	it('returns 403 for a player', async () => {
		const { app, calls } = setup()
		const res = await request(app).get('/audit/list').set(as('PLAYER'))
		assert.equal(res.status, 403)
		assert.equal(calls.length, 0)
	})

	it('returns 403 for a manager who is not an admin', async () => {
		const { app } = setup()
		const res = await request(app).get('/audit/list').set(as('PLAYER,MANAGER'))
		assert.equal(res.status, 403)
	})

	it('lists records for an admin with default paging', async () => {
		const { app, calls } = setup()
		const res = await request(app).get('/audit/list').set(as('PLAYER,ADMIN'))
		assert.equal(res.status, 200)
		assert.equal(res.body.itemList.length, 2)
		assert.equal(res.body.itemList[0].action, 'reservation/create')
		assert.deepEqual(res.body.pageInfo, { pageIndex: 0, pageSize: 20, total: 42 })
		assert.deepEqual(calls[0], {
			action: undefined,
			entityType: undefined,
			pageIndex: 0,
			pageSize: 20,
		})
	})

	it('passes filters and paging to the DAO', async () => {
		const { app, calls } = setup()
		const res = await request(app)
			.get('/audit/list?action=reservation/create&entityType=Reservation&pageIndex=2&pageSize=5')
			.set(as('PLAYER,ADMIN'))
		assert.equal(res.status, 200)
		assert.deepEqual(calls[0], {
			action: 'reservation/create',
			entityType: 'Reservation',
			pageIndex: 2,
			pageSize: 5,
		})
		assert.deepEqual(res.body.pageInfo, { pageIndex: 2, pageSize: 5, total: 42 })
	})

	it('returns 400 for an invalid pageSize or pageIndex', async () => {
		const { app, calls } = setup()
		for (const query of ['pageSize=0', 'pageSize=101', 'pageSize=abc', 'pageIndex=-1', 'pageIndex=1.5']) {
			const res = await request(app).get(`/audit/list?${query}`).set(as('PLAYER,ADMIN'))
			assert.equal(res.status, 400, query)
		}
		assert.equal(calls.length, 0)
	})

	it('returns 400 for a repeated key', async () => {
		const { app } = setup()
		const res = await request(app)
			.get('/audit/list?pageSize=1&pageSize=2')
			.set(as('PLAYER,ADMIN'))
		assert.equal(res.status, 400)
	})

	it('returns 400 for a too long action filter', async () => {
		const { app } = setup()
		const res = await request(app)
			.get(`/audit/list?action=${'a'.repeat(101)}`)
			.set(as('PLAYER,ADMIN'))
		assert.equal(res.status, 400)
	})

	it('warns about unsupported keys but still succeeds', async () => {
		const { app } = setup()
		const res = await request(app).get('/audit/list?foo=1').set(as('PLAYER,ADMIN'))
		assert.equal(res.status, 200)
		assert.ok(Object.keys(res.body.uuAppErrorMap).some((key) => key.endsWith('unsupportedKeys')))
	})
})