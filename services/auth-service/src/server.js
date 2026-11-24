import { createApp } from './app.js'
import { createDb } from './db.js'
import { createGoogleTokenVerifier } from './googleToken.js'
import { createUserDao } from './userDao.js'
import { createManagerRequestDao } from './managerRequestDao.js'

const port = Number(process.env.AUTH_SERVICE_PORT ?? 4001)
const googleClientId = process.env.GOOGLE_CLIENT_ID

if (!googleClientId) {
	console.warn('GOOGLE_CLIENT_ID is not set, auth/googleCallback will answer 503')
}

const db = createDb()

const server = createApp({
	userDao: createUserDao(db),
	managerRequestDao: createManagerRequestDao(db),
	verifyGoogleIdToken: googleClientId ? createGoogleTokenVerifier(googleClientId) : undefined,
}).listen(port, () => {
	console.log(`auth-service listening on http://localhost:${port}`)
})

function shutdown() {
	server.close(() => db.$disconnect())
}

process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)
