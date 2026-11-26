import assert from 'node:assert/strict'
import { test } from 'node:test'
import request from 'supertest'
import { createApp } from '../src/app.js'

const GATEWAY_SECRET = 'test-gateway-secret-at-least-32-characters'
const PLAYER_ID = '00000000-0000-4000-8000-000000000007'
const COURT_ID = '00000000-0000-4000-8000-000000000202'
const NOW = new Date('2026-11-20T08:00:00Z')

function headers(overrides = {}) {
	return { 'x-gateway-secret': GATEWAY_SECRET, 'x-user-id': PLAYER_ID, 'x-user-roles': 'PLAYER', ...overrides }
}

function reservation(id, startAt, status = 'ACTIVE') {
	return {
		id,
		courtId: COURT_ID,
		venueId: '00000000-0000-4000-8000-000000000101',
		playerId: PLAYER_ID,
		playerName: 'Jana Nováková',
		startAt: new Date(startAt),
		endAt: new Date(new Date(startAt).getTime() + 3600000),
		totalPrice: '300.00',
		status,
		createdAt: new Date('2026-11-18T10:00:00Z'),
		cancelledAt: status === 'CANCELLED' ? new Date('2026-11-19T10:00:00Z') : null,
	}
}

function fakeDb({ items = [], total = items.length } = {}) {
	const calls = { count: [], findMany: [], courtFindMany: [] }
	return {
		calls,
		reservation: {
			count: async (args) => {
				calls.count.push(args)
				return total
			},
			findMany: async (args) => {
				calls.findMany.push(args)
				return items
			},
		},
		court: {
			findMany: async (args) => {
				calls.courtFindMany.push(args)
				return [{ id: COURT_ID, name: 'Hřiště 2', venue: { name: 'Sportcentrum' } }]
			},
		},
	}
}

function listMy(db, query = {}, requestHeaders = headers()) {
	return request(createApp({ db, gatewaySecret: GATEWAY_SECRET, now: () => NOW }))
		.get('/reservation/listMy')
		.query(query)
		.set(requestHeaders)
}

test('GET /reservation/listMy returns only the player\'s reservations with court and venue names', async () => {
	const db = fakeDb({ items: [reservation('a1', '2026-11-25T14:00:00Z'), reservation('a2', '2026-11-10T14:00:00Z', 'CANCELLED')] })

	const response = await listMy(db)

	assert.equal(response.status, 200)
	assert.deepEqual(db.calls.findMany[0].where, { playerId: PLAYER_ID })
	assert.equal(response.body.itemList.length, 2)
	assert.equal(response.body.itemList[0].courtName, 'Hřiště 2')
	assert.equal(response.body.itemList[0].venueName, 'Sportcentrum')
	assert.equal(response.body.itemList[0].totalPrice, 300)
	assert.equal(response.body.itemList[1].status, 'CANCELLED')
	assert.equal(response.body.itemList[1].cancelledAt, '2026-11-19T10:00:00.000Z')
	assert.deepEqual(response.body.pageInfo, { pageIndex: 0, pageSize: 20, total: 2 })
	assert.deepEqual(response.body.uuAppErrorMap, {})
})

test('GET /reservation/listMy with period=upcoming filters by end time and sorts ascending', async () => {
	const db = fakeDb()

	const response = await listMy(db, { period: 'upcoming' })

	assert.equal(response.status, 200)
	assert.deepEqual(db.calls.findMany[0].where, { playerId: PLAYER_ID, endAt: { gt: NOW } })
	assert.equal(db.calls.findMany[0].orderBy[0].startAt, 'asc')
})

test('GET /reservation/listMy with period=past filters by end time and sorts descending', async () => {
	const db = fakeDb()

	await listMy(db, { period: 'past' })

	assert.deepEqual(db.calls.findMany[0].where, { playerId: PLAYER_ID, endAt: { lte: NOW } })
	assert.equal(db.calls.findMany[0].orderBy[0].startAt, 'desc')
})

test('GET /reservation/listMy paginates', async () => {
	const db = fakeDb({ total: 45 })

	const response = await listMy(db, { pageIndex: '2', pageSize: '10' })

	assert.equal(response.status, 200)
	assert.equal(db.calls.findMany[0].skip, 20)
	assert.equal(db.calls.findMany[0].take, 10)
	assert.deepEqual(response.body.pageInfo, { pageIndex: 2, pageSize: 10, total: 45 })
})

test('GET /reservation/listMy accepts the maximum page size and rejects a larger one', async () => {
	const ok = await listMy(fakeDb(), { pageSize: '100' })
	const tooBig = await listMy(fakeDb(), { pageSize: '101' })

	assert.equal(ok.status, 200)
	assert.equal(tooBig.status, 400)
	assert.ok(tooBig.body.uuAppErrorMap['reservation/listMy/invalidDtoIn'].paramMap.invalidValueKeyMap.pageSize)
})

test('GET /reservation/listMy returns an empty list without looking up courts', async () => {
	const db = fakeDb()

	const response = await listMy(db)

	assert.equal(response.status, 200)
	assert.deepEqual(response.body.itemList, [])
	assert.equal(db.calls.courtFindMany.length, 0)
})

test('GET /reservation/listMy rejects invalid query values', async () => {
	const response = await listMy(fakeDb(), { pageIndex: '-1', pageSize: '0', period: 'later' })

	assert.equal(response.status, 400)
	const { invalidValueKeyMap } = response.body.uuAppErrorMap['reservation/listMy/invalidDtoIn'].paramMap
	assert.ok(invalidValueKeyMap.pageIndex && invalidValueKeyMap.pageSize && invalidValueKeyMap.period)
})

test('GET /reservation/listMy warns about unsupported keys', async () => {
	const response = await listMy(fakeDb(), { foo: 'bar' })

	assert.equal(response.status, 200)
	assert.deepEqual(response.body.uuAppErrorMap['reservation/listMy/unsupportedKeys'].paramMap, { unsupportedKeyList: ['foo'] })
})

test('GET /reservation/listMy returns 401 without a valid gateway secret or user', async () => {
	const wrongSecret = await listMy(fakeDb(), {}, headers({ 'x-gateway-secret': 'x'.repeat(40) }))
	const noUser = await listMy(fakeDb(), {}, headers({ 'x-user-id': 'not-a-uuid' }))

	assert.equal(wrongSecret.status, 401)
	assert.equal(noUser.status, 401)
	assert.ok(wrongSecret.body.uuAppErrorMap['reservation/listMy/notAuthenticated'])
})

test('GET /reservation/listMy returns 403 for users without the PLAYER role', async () => {
	const response = await listMy(fakeDb(), {}, headers({ 'x-user-roles': 'MANAGER' }))

	assert.equal(response.status, 403)
})
