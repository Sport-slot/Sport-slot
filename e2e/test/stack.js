import { randomBytes, randomUUID } from 'node:crypto'
import { createApp as createGatewayApp } from '../../gateway/src/app.js'
import { createApp as createAuthApp } from '../../services/auth-service/src/app.js'
import { createDb } from '../../services/auth-service/src/db.js'
import { createUserDao } from '../../services/auth-service/src/userDao.js'
import { createApp as createVenueApp } from '../../services/venue-service/src/app.js'
import { createVenueDao } from '../../services/venue-service/src/venueDao.js'
import { createApp as createReservationApp } from '../../services/reservation-service/src/app.js'

export const databaseUrl = process.env.E2E_DATABASE_URL

function listen(app) {
	return new Promise((resolve) => {
		const server = app.listen(0, '127.0.0.1', () => resolve(server))
	})
}

function urlOf(server) {
	return `http://127.0.0.1:${server.address().port}`
}

export async function startStack() {
	const jwtSecret = randomBytes(32).toString('hex')
	const gatewaySecret = randomBytes(32).toString('hex')
	const db = createDb(databaseUrl)
	const googleUsers = new Map()

	const auth = await listen(
		createAuthApp({
			userDao: createUserDao(db),
			verifyGoogleIdToken: async (idToken) => {
				const user = googleUsers.get(idToken)
				if (!user) throw new Error('Unknown test id token')
				return user
			},
			jwtSecret,
			gatewaySecret,
		}),
	)
	const venue = await listen(createVenueApp({ db, venueDao: createVenueDao(db), gatewaySecret }))
	const reservation = await listen(createReservationApp({ db, gatewaySecret }))
	const gateway = await listen(
		createGatewayApp(
			{ auth: urlOf(auth), venue: urlOf(venue), reservation: urlOf(reservation), review: urlOf(auth), audit: urlOf(auth) },
			{ jwtSecret, gatewaySecret },
		),
	)
	const baseUrl = `${urlOf(gateway)}/api`

	async function call(method, path, { token, body, query } = {}) {
		const url = new URL(`${baseUrl}${path}`)
		for (const [key, value] of Object.entries(query ?? {})) url.searchParams.set(key, value)
		const response = await fetch(url, {
			method,
			headers: {
				...(body ? { 'Content-Type': 'application/json' } : {}),
				...(token ? { Authorization: `Bearer ${token}` } : {}),
			},
			body: body ? JSON.stringify(body) : undefined,
		})
		return { status: response.status, body: await response.json().catch(() => null) }
	}

	async function signIn(name) {
		const idToken = randomUUID()
		googleUsers.set(idToken, { googleId: `e2e-${randomUUID()}`, email: `${idToken}@e2e.test`, name })
		const { status, body } = await call('POST', '/auth/googleCallback', { body: { idToken } })
		if (status !== 200) throw new Error(`Sign in failed with ${status}`)
		googleUsers.set(`again-${body.user.id}`, googleUsers.get(idToken))
		return body
	}

	async function signInAsManager(name) {
		const { user } = await signIn(name)
		await db.user.update({ where: { id: user.id }, data: { roles: ['PLAYER', 'MANAGER'] } })
		const { body } = await call('POST', '/auth/googleCallback', { body: { idToken: `again-${user.id}` } })
		return body
	}

	async function stop() {
		await Promise.all([gateway, auth, venue, reservation].map((server) => new Promise((resolve) => server.close(resolve))))
		await db.$disconnect()
	}

	return { db, call, signIn, signInAsManager, stop }
}

export function pragueIso(date, time) {
	const guess = new Date(`${date}T${time}:00Z`)
	const parts = Object.fromEntries(
		new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Prague', hour: '2-digit', hourCycle: 'h23' })
			.formatToParts(guess)
			.map(({ type, value }) => [type, value]),
	)
	const offsetHours = Number(parts.hour) - guess.getUTCHours()
	return new Date(guess.getTime() - offsetHours * 3600_000).toISOString()
}

export function futureDate(daysAhead) {
	const date = new Date(Date.now() + daysAhead * 86400_000)
	return date.toISOString().slice(0, 10)
}

export function dayOfWeekOf(date) {
	const day = new Date(`${date}T12:00:00Z`).getUTCDay()
	return day === 0 ? 7 : day
}
