import assert from 'node:assert/strict'
import { test } from 'node:test'
import request from 'supertest'
import { createApp } from '../src/app.js'

const GATEWAY_SECRET = 'test-gateway-secret-at-least-32-characters'
const PLAYER_ID = '00000000-0000-4000-8000-000000000007'
const OTHER_ID = '00000000-0000-4000-8000-000000000008'
const RESERVATION_ID = '00000000-0000-4000-8000-000000000301'
const MISSING_ID = '00000000-0000-4000-8000-000000000999'
const NOW = new Date('2026-11-20T08:00:00Z')

function headers(userId = PLAYER_ID) {
	return { 'x-gateway-secret': GATEWAY_SECRET, 'x-user-id': userId, 'x-user-roles': 'PLAYER' }
}

function fakeDb({ startAt = '2026-11-25T14:00:00Z', status = 'ACTIVE', cancelledAt = null, raceLost = false } = {}) {
	const reservation = {
		id: RESERVATION_ID,
		courtId: '00000000-0000-4000-8000-000000000202',
		venueId: '00000000-0000-4000-8000-000000000101',
		playerId: PLAYER_ID,
		playerName: 'Jana Nováková',
		startAt: new Date(startAt),
		endAt: new Date(new Date(startAt).getTime() + 3600000),
		totalPrice: '300.00',
		status,
		createdAt: new Date('2026-11-18T10:00:00Z'),
		cancelledAt,
	}
	const calls = { updates: [], auditLogs: [] }
	const findUnique = async ({ where }) => (where.id === RESERVATION_ID ? { ...reservation } : null)
	return {
		calls,
		reservation: { findUnique },
		$transaction: async (callback) =>
			callback({
				reservation: {
					findUnique,
					updateMany: async ({ where, data }) => {
						calls.updates.push({ where, data })
						if (raceLost) {
							Object.assign(reservation, { status: 'CANCELLED', cancelledAt: new Date('2026-11-20T07:59:00Z') })
							return { count: 0 }
						}
						Object.assign(reservation, data)
						return { count: 1 }
					},
				},
				auditLog: {
					create: async ({ data }) => {
						calls.auditLogs.push(data)
						return data
					},
				},
			}),
	}
}

function cancel(db, body, requestHeaders = headers()) {
	return request(createApp({ db, gatewaySecret: GATEWAY_SECRET, now: () => NOW }))
		.post('/reservation/cancel')
		.set(requestHeaders)
		.send(body)
}

test('POST /reservation/cancel cancels the player\'s own reservation and logs it', async () => {
	const db = fakeDb()

	const response = await cancel(db, { id: RESERVATION_ID })

	assert.equal(response.status, 200)
	assert.equal(response.body.status, 'CANCELLED')
	assert.equal(response.body.cancelledAt, NOW.toISOString())
	assert.equal(response.body.totalPrice, 300)
	assert.deepEqual(response.body.uuAppErrorMap, {})
	assert.deepEqual(db.calls.updates[0].where, { id: RESERVATION_ID, status: 'ACTIVE' })
	assert.equal(db.calls.auditLogs[0].action, 'reservation/cancel')
	assert.equal(db.calls.auditLogs[0].entityId, RESERVATION_ID)
})

test('POST /reservation/cancel refuses less than 24 hours before the start', async () => {
	const db = fakeDb({ startAt: '2026-11-21T07:59:00Z' })

	const response = await cancel(db, { id: RESERVATION_ID })

	assert.equal(response.status, 400)
	assert.deepEqual(response.body.uuAppErrorMap['reservation/cancel/cancellationTooLate'].paramMap, {
		startAt: '2026-11-21T07:59:00.000Z',
		cancellableUntil: '2026-11-20T07:59:00.000Z',
	})
	assert.equal(db.calls.updates.length, 0)
})

test('POST /reservation/cancel allows cancelling more than 24 hours ahead', async () => {
	const response = await cancel(fakeDb({ startAt: '2026-11-21T08:01:00Z' }), { id: RESERVATION_ID })

	assert.equal(response.status, 200)
	assert.equal(response.body.status, 'CANCELLED')
})

test('POST /reservation/cancel leaves an already cancelled reservation unchanged', async () => {
	const cancelledAt = new Date('2026-11-19T09:00:00Z')
	const db = fakeDb({ status: 'CANCELLED', cancelledAt })

	const response = await cancel(db, { id: RESERVATION_ID })

	assert.equal(response.status, 200)
	assert.equal(response.body.status, 'CANCELLED')
	assert.equal(response.body.cancelledAt, cancelledAt.toISOString())
	assert.equal(db.calls.updates.length, 0)
	assert.equal(db.calls.auditLogs.length, 0)
})

test('POST /reservation/cancel does not log twice when a concurrent cancel won', async () => {
	const db = fakeDb({ raceLost: true })

	const response = await cancel(db, { id: RESERVATION_ID })

	assert.equal(response.status, 200)
	assert.equal(response.body.status, 'CANCELLED')
	assert.equal(db.calls.auditLogs.length, 0)
})

test('POST /reservation/cancel forbids cancelling someone else\'s reservation', async () => {
	const db = fakeDb()

	const response = await cancel(db, { id: RESERVATION_ID }, headers(OTHER_ID))

	assert.equal(response.status, 403)
	assert.equal(db.calls.updates.length, 0)
})

test('POST /reservation/cancel returns 404 for an unknown reservation', async () => {
	const response = await cancel(fakeDb(), { id: MISSING_ID })

	assert.equal(response.status, 404)
	assert.ok(response.body.uuAppErrorMap['reservation/cancel/reservationDoesNotExist'])
})

test('POST /reservation/cancel validates the id', async () => {
	const missing = await cancel(fakeDb(), {})
	const invalid = await cancel(fakeDb(), { id: 'abc' })

	assert.equal(missing.status, 400)
	assert.ok(missing.body.uuAppErrorMap['reservation/cancel/invalidDtoIn'].paramMap.missingKeyMap.id)
	assert.equal(invalid.status, 400)
	assert.ok(invalid.body.uuAppErrorMap['reservation/cancel/invalidDtoIn'].paramMap.invalidValueKeyMap.id)
})

test('POST /reservation/cancel rejects a request without the gateway identity', async () => {
	const response = await cancel(fakeDb(), { id: RESERVATION_ID }, {})

	assert.equal(response.status, 401)
})
