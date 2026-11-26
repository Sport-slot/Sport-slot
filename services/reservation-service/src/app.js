import express from 'express'
import { errorHandler, notFound } from '@sportslot/api-format'
import { createReservationCancelRouter } from './routes/reservationCancel.js'
import { createReservationCreateRouter } from './routes/reservationCreate.js'
import { createReservationUpdateRouter } from './routes/reservationUpdate.js'
import { createReservationListMyRouter } from './routes/reservationListMy.js'

export function createApp({ db, gatewaySecret = process.env.GATEWAY_SECRET, now } = {}) {
	const app = express()
	app.use(express.json())
	app.get('/health', (_req, res) => {
		res.json({ status: 'ok', service: 'reservation-service' })
	})
	if (db) {
		app.use('/reservation', createReservationCreateRouter({ db, gatewaySecret, now }))
		app.use('/reservation', createReservationCancelRouter({ db, gatewaySecret, now }))
		app.use('/reservation', createReservationUpdateRouter({ db, gatewaySecret, now }))
		app.use('/reservation', createReservationListMyRouter({ db, gatewaySecret, now }))
	}
	app.use(notFound)
	app.use(errorHandler)
	return app
}
