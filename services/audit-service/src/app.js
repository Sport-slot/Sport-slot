import express from 'express'
import { errorHandler, notFound } from '@sportslot/api-format'
import { createAuditLogRouter } from './auditLogRouter.js'

export function createApp({
	auditLogDao,
	gatewaySecret = process.env.GATEWAY_SECRET,
} = {}) {
	const app = express()
	app.use(express.json())
	app.get('/health', (_req, res) => {
		res.json({ status: 'ok', service: 'audit-service' })
	})

	if (auditLogDao) {
		app.use(createAuditLogRouter({ auditLogDao, gatewaySecret }))
	}

	app.use(notFound)
	app.use(errorHandler)
	return app
}