import assert from 'node:assert/strict'
import { test } from 'node:test'
import request from 'supertest'
import { createApp } from '../src/app.js'

const SPORTCENTRUM = '00000000-0000-4000-8000-000000000101'
const PLZEN = '00000000-0000-4000-8000-000000000102'
const EMPTY = '00000000-0000-4000-8000-000000000103'
const MISSING = '00000000-0000-4000-8000-000000000999'
const DEACTIVATED = '00000000-0000-4000-8000-000000000104'

const venues = [
	{
		id: SPORTCENTRUM,
		name: 'Sportcentrum',
		address: 'Sportovní 1',
		city: 'Praha',
		description: 'Venkovní areál se čtyřmi hřišti.',
		imageUrl: '/images/venues/football.webp',
		managerId: '00000000-0000-4000-8000-000000000001',
		openingHours: [{ dayOfWeek: 1, openTime: '07:00', closeTime: '22:00' }],
		courts: [
			{ id: 'c1', name: 'Hřiště 1', sport: 'fotbal', surface: 'Umělý trávník', indoor: false },
			{ id: 'c2', name: 'Hřiště 2', sport: 'tenis, nohejbal, streetbal', surface: 'Akrylát', indoor: false },
		],
	},
	{
		id: PLZEN,
		name: 'Areál Plzeň',
		address: 'Hlavní 2',
		city: 'Plzeň',
		description: null,
		openingHours: [],
		courts: [{ id: 'c3', name: 'Kurt A', sport: 'Tenis', surface: 'Antuka', indoor: false }],
	},
	{ id: EMPTY, name: 'Bez hřišť', address: 'Prázdná 3', city: 'Praha', description: null, openingHours: [], courts: [] },
	{
		id: DEACTIVATED,
		name: 'Zavřená hala',
		address: 'Stará 4',
		city: 'Praha',
		description: null,
		managerId: '00000000-0000-4000-8000-000000000001',
		deactivatedAt: new Date('2026-11-08T10:00:00Z'),
		openingHours: [],
		courts: [{ id: 'c4', name: 'Kurt Z', sport: 'tenis', surface: 'Antuka', indoor: true }],
	},
]

const venueDao = {
	list: async () => venues,
	get: async (id) => venues.find((venue) => venue.id === id) ?? null,
}

const app = createApp({ venueDao })

test('venue/list without filters returns venues with courts, sorted, 20 per page', async () => {
	const response = await request(app).get('/venue/list')
	assert.equal(response.status, 200)
	assert.deepEqual(response.body, {
		itemList: [
			{ id: PLZEN, name: 'Areál Plzeň', city: 'Plzeň', imageUrl: null, sports: ['Tenis'] },
			{ id: SPORTCENTRUM, name: 'Sportcentrum', city: 'Praha', imageUrl: '/images/venues/football.webp', sports: ['fotbal', 'tenis', 'nohejbal', 'streetbal'] },
		],
		pageInfo: { pageIndex: 0, pageSize: 20, total: 2 },
		uuAppErrorMap: {},
	})
})

test('venue/list city filter ignores case and diacritics', async () => {
	for (const city of ['plzen', 'PLZEŇ', ' Plzeň ']) {
		const response = await request(app).get('/venue/list').query({ city })
		assert.deepEqual(
			response.body.itemList.map((venue) => venue.id),
			[PLZEN],
			city,
		)
	}
})

test('venue/list sport filter matches any sport of a multi-sport court', async () => {
	const nohejbal = await request(app).get('/venue/list').query({ sport: 'nohejbal' })
	assert.deepEqual(nohejbal.body.itemList.map((venue) => venue.id), [SPORTCENTRUM])

	const tenis = await request(app).get('/venue/list').query({ sport: 'tenis' })
	assert.deepEqual(tenis.body.itemList.map((venue) => venue.id), [PLZEN, SPORTCENTRUM])

	const both = await request(app).get('/venue/list').query({ sport: 'tenis', city: 'praha' })
	assert.deepEqual(both.body.itemList.map((venue) => venue.id), [SPORTCENTRUM])

	const none = await request(app).get('/venue/list').query({ sport: 'golf' })
	assert.deepEqual(none.body.itemList, [])
	assert.equal(none.body.pageInfo.total, 0)
})

test('venue/list pages with pageIndex and pageSize', async () => {
	const response = await request(app).get('/venue/list').query({ pageIndex: 1, pageSize: 1 })
	assert.deepEqual(response.body.itemList.map((venue) => venue.id), [SPORTCENTRUM])
	assert.deepEqual(response.body.pageInfo, { pageIndex: 1, pageSize: 1, total: 2 })
})

test('venue/list rejects bad paging and repeated keys with invalidDtoIn', async () => {
	const response = await request(app).get('/venue/list?pageSize=0&pageIndex=abc&city=a&city=b')
	assert.equal(response.status, 400)
	assert.deepEqual(response.body.uuAppErrorMap['venue/list/invalidDtoIn'].paramMap, {
		invalidTypeKeyMap: { pageIndex: 'Musí být celé číslo.', city: 'Musí být text.' },
		invalidValueKeyMap: { pageSize: 'Musí být v rozsahu 1–100.' },
		missingKeyMap: {},
	})
})

test('venue/list warns about unsupported keys but still succeeds', async () => {
	const response = await request(app).get('/venue/list').query({ foo: 'x' })
	assert.equal(response.status, 200)
	assert.deepEqual(response.body.uuAppErrorMap['venue/list/unsupportedKeys'].paramMap, { unsupportedKeyList: ['foo'] })
})

test('venue/get returns the detail without internal fields', async () => {
	const response = await request(app).get('/venue/get').query({ id: SPORTCENTRUM })
	assert.equal(response.status, 200)
	const { managerId, ...expected } = venues[0]
	assert.ok(managerId)
	assert.deepEqual(response.body, { ...expected, active: true, deactivatedAt: null, isOwner: false, uuAppErrorMap: {} })
})

test('venue/get validates id', async () => {
	const missing = await request(app).get('/venue/get')
	assert.equal(missing.status, 400)
	assert.deepEqual(missing.body.uuAppErrorMap['venue/get/invalidDtoIn'].paramMap.missingKeyMap, { id: 'Klíč id je povinný.' })

	const notUuid = await request(app).get('/venue/get').query({ id: '123' })
	assert.equal(notUuid.status, 400)
	assert.deepEqual(notUuid.body.uuAppErrorMap['venue/get/invalidDtoIn'].paramMap.invalidValueKeyMap, { id: 'Musí být platné UUID.' })
})

test('venue/get with unknown id is 404 venueDoesNotExist', async () => {
	const response = await request(app).get('/venue/get').query({ id: MISSING })
	assert.equal(response.status, 404)
	assert.deepEqual(response.body.uuAppErrorMap['venue/get/venueDoesNotExist'], {
		type: 'error',
		message: 'Sportoviště nenalezeno.',
		paramMap: { id: MISSING },
	})
})

test('venue/list hides deactivated venues', async () => {
	const response = await request(app).get('/venue/list')
	assert.equal(response.status, 200)
	assert.ok(!response.body.itemList.some((venue) => venue.id === DEACTIVATED))
})

test('venue/get still returns a deactivated venue with its state', async () => {
	const response = await request(app).get('/venue/get').query({ id: DEACTIVATED })
	assert.equal(response.status, 200)
	assert.equal(response.body.active, false)
	assert.equal(response.body.deactivatedAt, '2026-11-08T10:00:00.000Z')
	assert.equal(response.body.managerId, undefined)
	assert.equal(response.body.isOwner, false)
})

test('venue/get marks the owner only when identity comes through the gateway', async () => {
	const gatewaySecret = 'test-gateway-secret-at-least-32-characters'
	const securedApp = createApp({ venueDao, gatewaySecret })
	const owner = '00000000-0000-4000-8000-000000000001'

	const viaGateway = await request(securedApp).get('/venue/get').query({ id: DEACTIVATED }).set({ 'x-gateway-secret': gatewaySecret, 'x-user-id': owner })
	assert.equal(viaGateway.body.isOwner, true)

	const spoofed = await request(securedApp).get('/venue/get').query({ id: DEACTIVATED }).set({ 'x-gateway-secret': 'wrong', 'x-user-id': owner })
	assert.equal(spoofed.body.isOwner, false)
})
