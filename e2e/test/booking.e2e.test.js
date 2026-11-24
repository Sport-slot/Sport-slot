import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, describe, it } from 'node:test'
import { databaseUrl, dayOfWeekOf, futureDate, pragueIso, startStack } from './stack.js'

const venueName = `E2E Sportcentrum ${randomUUID().slice(0, 8)}`
const openingHoursList = [1, 2, 3, 4, 5, 6, 7].map((dayOfWeek) => ({ dayOfWeek, openTime: '08:00', closeTime: '22:00' }))

describe('booking flow through gateway, services and Postgres', { skip: !databaseUrl && 'E2E_DATABASE_URL is not set' }, () => {
	let stack
	let manager
	let player
	let otherPlayer
	let venueId
	let courtId
	let reservationId
	const date = futureDate(7)
	const startAt = pragueIso(date, '10:00')
	const endAt = pragueIso(date, '12:00')

	before(async () => {
		stack = await startStack()
		manager = await stack.signInAsManager('E2E Správce')
		player = await stack.signIn('E2E Hráč')
		otherPlayer = await stack.signIn('E2E Druhý hráč')
	})

	after(async () => {
		await stack?.stop()
	})

	it('signs in through Google callback and returns the user from user/me', async () => {
		const { status, body } = await stack.call('GET', '/user/me', { token: player.token })
		assert.equal(status, 200)
		assert.equal(body.id, player.user.id)
		assert.deepEqual(body.roles, ['PLAYER'])
	})

	it('rejects requests without a token', async () => {
		const { status } = await stack.call('GET', '/user/me')
		assert.equal(status, 401)
	})

	it('does not let a player create a venue', async () => {
		const { status } = await stack.call('POST', '/venue/create', {
			token: player.token,
			body: { name: 'Hráčovo hřiště', address: 'Ulice 1', city: 'Praha', openingHoursList },
		})
		assert.equal(status, 403)
	})

	it('lets a manager create a venue that shows up in listMine and venue/get', async () => {
		const created = await stack.call('POST', '/venue/create', {
			token: manager.token,
			body: { name: venueName, address: 'Testovací 1', city: 'Praha', description: 'Venue for e2e tests', openingHoursList },
		})
		assert.equal(created.status, 200)
		venueId = created.body.id

		const mine = await stack.call('GET', '/venue/listMine', { token: manager.token })
		assert.equal(mine.status, 200)
		assert.ok(JSON.stringify(mine.body).includes(venueId))

		const detail = await stack.call('GET', '/venue/get', { query: { id: venueId } })
		assert.equal(detail.status, 200)
		assert.equal(detail.body.name, venueName)
	})

	it('lets the owner update the venue and logs the change', async () => {
		const updated = await stack.call('POST', '/venue/update', {
			token: manager.token,
			body: { id: venueId, description: 'Updated by e2e', openingHoursList },
		})
		assert.equal(updated.status, 200)
		assert.equal(updated.body.description, 'Updated by e2e')
		assert.equal(updated.body.openingHoursList.length, openingHoursList.length)

		const forbidden = await stack.call('POST', '/venue/update', { token: player.token, body: { id: venueId, name: 'Hijacked' } })
		assert.equal(forbidden.status, 403)

		const detail = await stack.call('GET', '/venue/get', { query: { id: venueId } })
		assert.equal(detail.body.description, 'Updated by e2e')
		assert.equal(detail.body.name, venueName)

		const audit = await stack.db.auditLog.findMany({ where: { entityId: venueId, action: 'venue/update' }, select: { details: true } })
		assert.equal(audit.length, 1)
		assert.deepEqual(audit[0].details.changedKeys, ['description', 'openingHoursList'])
	})

	it('lets the manager add a court and a price rule', async () => {
		const court = await stack.call('POST', '/court/create', {
			token: manager.token,
			body: { venueId, name: 'Kurt 1', sport: 'tenis', surface: 'Antuka', indoor: false },
		})
		assert.equal(court.status, 200)
		courtId = court.body.id

		const price = await stack.call('POST', '/priceRule/create', {
			token: manager.token,
			body: { courtId, dayOfWeek: dayOfWeekOf(date), startTime: '08:00', endTime: '22:00', pricePerHour: 400 },
		})
		assert.equal(price.status, 200)

		const overlap = await stack.call('POST', '/priceRule/create', {
			token: manager.token,
			body: { courtId, dayOfWeek: dayOfWeekOf(date), startTime: '10:00', endTime: '12:00', pricePerHour: 500 },
		})
		assert.equal(overlap.status, 409)

		const list = await stack.call('GET', '/priceRule/listByCourt', { query: { courtId } })
		assert.equal(list.status, 200)
		assert.equal(list.body.itemList.length, 1)
	})

	it('shows the slot as free before booking', async () => {
		const { status, body } = await stack.call('GET', '/court/availability', { query: { courtId, date } })
		assert.equal(status, 200)
		const slot = body.slotList.find((item) => item.startTime === '10:00')
		assert.equal(slot.free, true)
	})

	it('lets a player book two hours and charges the price list', async () => {
		const { status, body } = await stack.call('POST', '/reservation/create', {
			token: player.token,
			body: { courtId, startAt, endAt },
		})
		assert.equal(status, 200)
		assert.equal(body.totalPrice, 800)
		assert.equal(body.status, 'ACTIVE')
		assert.equal(body.playerName, 'E2E Hráč')
		reservationId = body.id
	})

	it('marks the booked slots as taken and refuses a double booking', async () => {
		const availability = await stack.call('GET', '/court/availability', { query: { courtId, date } })
		const taken = availability.body.slotList.filter((item) => !item.free).map((item) => item.startTime)
		assert.ok(taken.includes('10:00') && taken.includes('11:00'))

		const clash = await stack.call('POST', '/reservation/create', {
			token: otherPlayer.token,
			body: { courtId, startAt: pragueIso(date, '11:00'), endAt: pragueIso(date, '13:00') },
		})
		assert.equal(clash.status, 409)
		assert.ok(Object.keys(clash.body.uuAppErrorMap).some((code) => code.endsWith('slotNotAvailable')))
	})

	it('does not let another player cancel the reservation', async () => {
		const { status } = await stack.call('POST', '/reservation/cancel', { token: otherPlayer.token, body: { id: reservationId } })
		assert.equal(status, 403)
	})

	it('lets the owner cancel and frees the slot again', async () => {
		const cancel = await stack.call('POST', '/reservation/cancel', { token: player.token, body: { id: reservationId } })
		assert.equal(cancel.status, 200)
		assert.equal(cancel.body.status, 'CANCELLED')

		const availability = await stack.call('GET', '/court/availability', { query: { courtId, date } })
		assert.equal(availability.body.slotList.find((item) => item.startTime === '10:00').free, true)
	})

	it('writes audit log entries for the booking', async () => {
		const actions = await stack.db.auditLog.findMany({ where: { entityId: reservationId }, select: { action: true } })
		assert.deepEqual(actions.map(({ action }) => action).sort(), ['reservation/cancel', 'reservation/create'])
	})

	it('hides a deactivated venue from booking', async () => {
		const deactivate = await stack.call('POST', '/venue/setActive', { token: manager.token, body: { id: venueId, active: false } })
		assert.equal(deactivate.status, 200)

		const booking = await stack.call('POST', '/reservation/create', {
			token: player.token,
			body: { courtId, startAt: pragueIso(date, '14:00'), endAt: pragueIso(date, '15:00') },
		})
		assert.equal(booking.status, 409)
	})
})
