import assert from 'node:assert/strict'
import { test } from 'node:test'
import request from 'supertest'
import { createApp } from '../src/app.js'

const GATEWAY_SECRET = 'test-gateway-secret-at-least-32-characters'
const PLAYER_ID = '00000000-0000-4000-8000-000000000007'
const COURT_ID = '00000000-0000-4000-8000-000000000201'
const VENUE_ID = '00000000-0000-4000-8000-000000000101'
const MISSING_ID = '00000000-0000-4000-8000-000000000999'
const NOW = new Date('2026-11-20T08:00:00Z')

function time(value) {
	return new Date(`1970-01-01T${value}:00Z`)
}

function headers(roles = 'PLAYER') {
	return { 'x-gateway-secret': GATEWAY_SECRET, 'x-user-id': PLAYER_ID, 'x-user-roles': roles }
}

function fakeDb({
	deactivatedAt = null,
	openingHours = [{ openTime: time('07:00'), closeTime: time('22:00') }],
	priceRules = [
		{ startTime: time('07:00'), endTime: time('16:00'), pricePerHour: '300.00' },
		{ startTime: time('16:00'), endTime: time('22:00'), pricePerHour: '500.00' },
	],
	clash = null,
	transactionError = null,
} = {}) {
	const calls = { courtQuery: null, reservations: [], auditLogs: [] }
	return {
		calls,
		court: {
			findUnique: async (query) => {
				calls.courtQuery = query
				if (query.where.id !== COURT_ID) return null
				return {
					id: COURT_ID,
					name: 'Hřiště 2',
					venueId: VENUE_ID,
					venue: { name: 'Sportcentrum', deactivatedAt, openingHours },
					priceRules,
				}
			},
		},
		user: {
			findUnique: async ({ where }) => (where.id === PLAYER_ID ? { name: 'Jana Nováková' } : null),
		},
		reservation: {
			findFirst: async () => clash,
		},
		$transaction: async (callback) => {
			if (transactionError) throw transactionError
			return callback({
				reservation: {
					create: async ({ data }) => {
						calls.reservations.push(data)
						return {
							id: '00000000-0000-4000-8000-000000000301',
							...data,
							status: 'ACTIVE',
							createdAt: NOW,
						}
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

function post(db, body, requestHeaders = headers()) {
	return request(createApp({ db, gatewaySecret: GATEWAY_SECRET, now: () => NOW }))
		.post('/reservation/create')
		.set(requestHeaders)
		.send(body)
}

const slot = { courtId: COURT_ID, startAt: '2026-11-20T14:00:00Z', endAt: '2026-11-20T16:00:00Z' }

test('POST /reservation/create books a free slot and prices it from the price list', async () => {
	const db = fakeDb()

	const response = await post(db, slot)

	assert.equal(response.status, 200)
	assert.equal(response.body.totalPrice, 800)
	assert.equal(response.body.status, 'ACTIVE')
	assert.equal(response.body.playerName, 'Jana Nováková')
	assert.equal(response.body.venueName, 'Sportcentrum')
	assert.equal(response.body.startAt, '2026-11-20T14:00:00.000Z')
	assert.deepEqual(response.body.uuAppErrorMap, {})
	assert.equal(db.calls.courtQuery.select.priceRules.where.dayOfWeek, 5)
	assert.equal(db.calls.reservations[0].totalPrice, '800.00')
	assert.equal(db.calls.reservations[0].playerId, PLAYER_ID)
	assert.equal(db.calls.auditLogs[0].action, 'reservation/create')
	assert.equal(db.calls.auditLogs[0].entityId, '00000000-0000-4000-8000-000000000301')
})

test('POST /reservation/create rejects a request without the gateway identity', async () => {
	const response = await post(fakeDb(), slot, {})

	assert.equal(response.status, 401)
	assert.ok(response.body.uuAppErrorMap['reservation/create/notAuthenticated'])
})

test('POST /reservation/create reports missing keys', async () => {
	const response = await post(fakeDb(), {})

	assert.equal(response.status, 400)
	const { missingKeyMap } = response.body.uuAppErrorMap['reservation/create/invalidDtoIn'].paramMap
	assert.deepEqual(Object.keys(missingKeyMap).sort(), ['courtId', 'endAt', 'startAt'])
})

test('POST /reservation/create requires whole hours', async () => {
	const response = await post(fakeDb(), { ...slot, endAt: '2026-11-20T14:30:00Z' })

	assert.equal(response.status, 400)
	assert.ok(response.body.uuAppErrorMap['reservation/create/invalidDtoIn'].paramMap.invalidValueKeyMap.endAt)
})

test('POST /reservation/create rejects a slot that already started', async () => {
	const response = await post(fakeDb(), { ...slot, startAt: '2026-11-20T07:00:00Z', endAt: '2026-11-20T08:00:00Z' })

	assert.equal(response.status, 400)
	assert.ok(response.body.uuAppErrorMap['reservation/create/reservationInPast'])
})

test('POST /reservation/create returns 404 for an unknown court', async () => {
	const response = await post(fakeDb(), { ...slot, courtId: MISSING_ID })

	assert.equal(response.status, 404)
	assert.ok(response.body.uuAppErrorMap['reservation/create/courtDoesNotExist'])
})

test('POST /reservation/create refuses a deactivated venue', async () => {
	const db = fakeDb({ deactivatedAt: new Date('2026-11-10T08:00:00Z') })

	const response = await post(db, slot)

	assert.equal(response.status, 409)
	assert.ok(response.body.uuAppErrorMap['reservation/create/venueIsNotActive'])
	assert.equal(db.calls.reservations.length, 0)
})

test('POST /reservation/create refuses a slot outside opening hours', async () => {
	const response = await post(fakeDb(), { ...slot, startAt: '2026-11-20T20:00:00Z', endAt: '2026-11-20T22:00:00Z' })

	assert.equal(response.status, 400)
	const error = response.body.uuAppErrorMap['reservation/create/outsideOpeningHours']
	assert.deepEqual(error.paramMap, { date: '2026-11-20', openTime: '07:00', closeTime: '22:00' })
})

test('POST /reservation/create refuses a slot that does not start on the hourly grid', async () => {
	const response = await post(fakeDb(), { ...slot, startAt: '2026-11-20T14:30:00Z', endAt: '2026-11-20T15:30:00Z' })

	assert.equal(response.status, 400)
	assert.ok(response.body.uuAppErrorMap['reservation/create/outsideOpeningHours'])
})

test('POST /reservation/create refuses a day when the venue is closed', async () => {
	const response = await post(fakeDb({ openingHours: [] }), slot)

	assert.equal(response.status, 400)
	assert.equal(response.body.uuAppErrorMap['reservation/create/outsideOpeningHours'].paramMap.openTime, null)
})

test('POST /reservation/create refuses a slot without a price', async () => {
	const db = fakeDb({ priceRules: [{ startTime: time('07:00'), endTime: time('16:00'), pricePerHour: '300.00' }] })

	const response = await post(db, slot)

	assert.equal(response.status, 400)
	assert.deepEqual(response.body.uuAppErrorMap['reservation/create/priceNotSet'].paramMap, {
		startTime: '16:00',
		endTime: '17:00',
	})
	assert.equal(db.calls.reservations.length, 0)
})

test('POST /reservation/create refuses a slot that is already booked', async () => {
	const db = fakeDb({ clash: { id: '00000000-0000-4000-8000-000000000302' } })

	const response = await post(db, slot)

	assert.equal(response.status, 409)
	assert.ok(response.body.uuAppErrorMap['reservation/create/slotNotAvailable'])
	assert.equal(db.calls.reservations.length, 0)
})

test('POST /reservation/create maps a concurrent booking caught by the database to slotNotAvailable', async () => {
	const error = Object.assign(new Error('conflicting key value violates exclusion constraint'), {
		cause: { code: '23P01' },
	})

	const response = await post(fakeDb({ transactionError: error }), slot)

	assert.equal(response.status, 409)
	assert.ok(response.body.uuAppErrorMap['reservation/create/slotNotAvailable'])
})

test('POST /reservation/create warns about unsupported keys', async () => {
	const response = await post(fakeDb(), { ...slot, price: 1 })

	assert.equal(response.status, 200)
	assert.deepEqual(response.body.uuAppErrorMap['reservation/create/unsupportedKeys'].paramMap, {
		unsupportedKeyList: ['price'],
	})
})
