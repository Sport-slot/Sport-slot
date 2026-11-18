import { createApp } from './app.js'
import { createDb } from './db.js'

const port = Number(process.env.RESERVATION_SERVICE_PORT ?? 4003)

const db = createDb()

const server = createApp({ db }).listen(port, () => {
	console.log(`reservation-service listening on http://localhost:${port}`)
})

function shutdown() {
	server.close(async () => {
		await db.$disconnect()
	})
}

process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)
