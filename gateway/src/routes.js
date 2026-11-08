export const routes = [
	{ prefix: '/api/auth', service: 'auth' },
	{ prefix: '/api/user', service: 'auth' },
	{ prefix: '/api/venue', service: 'venue' },
	{ prefix: '/api/venueImage', service: 'venue' },
	{ prefix: '/api/court', service: 'venue' },
	{ prefix: '/api/priceRule', service: 'venue' },
	{ prefix: '/api/reservation', service: 'reservation' },
	{ prefix: '/api/review', service: 'review' },
	{ prefix: '/api/audit', service: 'audit' },
]

export function serviceUrlsFromEnv(env = process.env) {
	return {
		auth: env.AUTH_SERVICE_URL ?? 'http://localhost:4001',
		venue: env.VENUE_SERVICE_URL ?? 'http://localhost:4002',
		reservation: env.RESERVATION_SERVICE_URL ?? 'http://localhost:4003',
		review: env.REVIEW_SERVICE_URL ?? 'http://localhost:4004',
		audit: env.AUDIT_SERVICE_URL ?? 'http://localhost:4005',
	}
}
