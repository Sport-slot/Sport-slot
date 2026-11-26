import assert from 'node:assert/strict'
import { test } from 'node:test'
import request from 'supertest'
import { createApp } from '../src/app.js'

const GATEWAY_SECRET = 'test-gateway-secret-at-least-32-characters'
const PLAYER_ID = '00000000-0000-4000-8000-000000000007'
const OTHER_ID = '00000000-0000-4000-8000-000000000008'
const RESERVATION_ID = '00000000-0000-4000-8000-000000000301'
const MISSING_ID = '00000000-0000-4000-8000-000000000999'
const COURT_ID = '00000000-0000-4000-8000-000000000201'
const VENUE_ID = '00000000-0000-4000-8000-000000000101'
const NOW = new Date('2026-11-20T08:00:00Z')

const newSlot = { id: RESERVATION_ID, startAt: '2026-11-26T15:00:00Z', endAt: '2026-11-26T17:00:00Z' }

function time(value) {
	return new Date(`1970-01-01T${value}:00Z`)
}

function headers(userId = PLAYER_ID) {
	return { 'x-gateway-secret': GATEWAY_SECRET, 'x-user-id': userId, 'x-user-roles': 'PLAYER' }
}

function fakeDb({ startAt = '2026-11-25T14:00:00Z', status = 'ACTIVE', clash = null, raceLost = false, transactionError = null } = {}) {
	const reservation = {
		id: RESERVATION_ID,
		courtId: COURT_ID,
		venueId: VENUE_ID,
		playerId: PLAYER_ID,
		playerName: 'Jana Nováková',
		startAt: new Date(startAt),
		endAt: new Date(new Date(startAt).getTime() + 3600000),
		totalPrice: '300.00',
		status,
		createdAt: new Date('2026-11-18T10:00:00Z'),
		cancelledAt: null,
	}
	const calls = { clashQuery: null, updates: [], auditLogs: [] }
	const findUnique = async ({ where }) => (where.id === RESERVATION_ID ? { ...reservation } : null)
	return {
		calls,
		court: {
			findUnique: async () => ({
				id: COURT_ID,
				name: 'Hřiště 1',
				venueId: VENUE_ID,
				venue: { name: 'Sportcentrum', deactivatedAt: null, openingHours: [{ openTime: time('07:00'), closeTime: time('22:00') }] },
				priceRules: [
					{ startTime: time('07:00'), endTime: time('16:00'), pricePerHour: '300.00' },
					{ startTime: time('16:00'), endTime: time('22:00'), pricePerHour: '500.00' },
				],
			}),
		},
		reservation: {
			findUnique,
			findFirst: async (query) => {
				calls.clashQuery = query
				return clash
			},
		},
		$transaction: async (callback) => {
			if (transactionError) throw transactionError
			return callback({
				reservation: {
					findUnique,
					updateMany: async ({ where, data }) => {
						calls.updates.push({ where, data })
						if (raceLost) return { count: 0 }
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
			})
		},
	}
}

function update(db, body, requestHeaders = headers()) {
	return request(createApp({ db, gatewaySecret: GATEWAY_SECRET, now: () => NOW }))
		.post('/reservation/update')
		.set(requestHeaders)
		.send(body)
}

test('POST /reservation/update moves the reservation, reprices it and logs the change', async () => {
	const db = fakeDb()

	const response = await update(db, newSlot)

	assert.equal(response.status, 200)
	assert.equal(response.body.startAt, '2026-11-26T15:00:00.000Z')
	assert.equal(response.body.endAt, '2026-11-26T17:00:00.000Z')
	assert.equal(response.body.totalPrice, 1000)
	assert.equal(response.body.courtId, COURT_ID)
	assert.equal(response.body.status, 'ACTIVE')
	assert.deepEqual(response.body.uuAppErrorMap, {})
	assert.deepEqual(db.calls.clashQuery.where.id, { not: RESERVATION_ID })
	assert.deepEqual(db.calls.updates[0].where, { id: RESERVATION_ID, status: 'ACTIVE' })
	assert.equal(db.calls.updates[0].data.totalPrice, '1000.00')
	assert.equal(db.calls.auditLogs[0].action, 'reservation/update')
	assert.equal(db.calls.auditLogs[0].details.previousStartAt, '2026-11-25T14:00:00.000Z')
})

test('POST /reservation/update ignores courtId and warns about it', async () => {
	const response = await update(fakeDb(), { ...newSlot, courtId: MISSING_ID })

	assert.equal(response.status, 200)
	assert.equal(response.body.courtId, COURT_ID)
	assert.deepEqual(response.body.uuAppErrorMap['reservation/update/unsupportedKeys'].paramMap.unsupportedKeyList, ['courtId'])
})

test('POST /reservation/update rejects invalid dtoIn', async () => {
	const response = await update(fakeDb(), { startAt: newSlot.startAt, endAt: '2026-11-26T15:30:00Z' })

	assert.equal(response.status, 400)
	const error = response.body.uuAppErrorMap['reservation/update/invalidDtoIn']
	assert.ok(error.paramMap.missingKeyMap.id)
	assert.ok(error.paramMap.invalidValueKeyMap.endAt)
})

test('POST /reservation/update returns 404 for an unknown reservation', async () => {
	const response = await update(fakeDb(), { ...newSlot, id: MISSING_ID })

	assert.equal(response.status, 404)
	assert.ok(response.body.uuAppErrorMap['reservation/update/reservationDoesNotExist'])
})

test('POST /reservation/update forbids changing another player\'s reservation', async () => {
	const response = await update(fakeDb(), newSlot, headers(OTHER_ID))

	assert.equal(response.status, 403)
	assert.ok(response.body.uuAppErrorMap['reservation/update/notAuthorized'])
})

test('POST /reservation/update refuses a cancelled reservation', async () => {
	const response = await update(fakeDb({ status: 'CANCELLED' }), newSlot)

	assert.equal(response.status, 409)
	assert.ok(response.body.uuAppErrorMap['reservation/update/reservationNotActive'])
})

test('POST /reservation/update refuses changes less than 24 hours before the original start', async () => {
	const db = fakeDb({ startAt: '2026-11-21T07:00:00Z' })

	const response = await update(db, newSlot)

	assert.equal(response.status, 400)
	assert.equal(
		response.body.uuAppErrorMap['reservation/update/changeTooLate'].paramMap.changeableUntil,
		'2026-11-20T07:00:00.000Z',
	)
	assert.equal(db.calls.updates.length, 0)
})

test('POST /reservation/update checks the new slot like reservation/create', async () => {
	const response = await update(fakeDb(), { ...newSlot, startAt: '2026-11-26T21:00:00Z', endAt: '2026-11-26T22:00:00Z' })

	assert.equal(response.status, 400)
	assert.ok(response.body.uuAppErrorMap['reservation/update/outsideOpeningHours'])
})

test('POST /reservation/update returns 409 when the new slot is taken', async () => {
	const db = fakeDb({ clash: { id: MISSING_ID } })

	const response = await update(db, newSlot)

	assert.equal(response.status, 409)
	assert.ok(response.body.uuAppErrorMap['reservation/update/slotNotAvailable'])
	assert.equal(db.calls.updates.length, 0)
})

test('POST /reservation/update maps the database overlap constraint to slotNotAvailable', async () => {
	const response = await update(fakeDb({ transactionError: { code: '23P01' } }), newSlot)

	assert.equal(response.status, 409)
	assert.ok(response.body.uuAppErrorMap['reservation/update/slotNotAvailable'])
})

test('POST /reservation/update loses to a cancel that lands first', async () => {
	const db = fakeDb({ raceLost: true })

	const response = await update(db, newSlot)

	assert.equal(response.status, 409)
	assert.ok(response.body.uuAppErrorMap['reservation/update/reservationNotActive'])
	assert.equal(db.calls.auditLogs.length, 0)
})
