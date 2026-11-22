import { createApp } from './app.js'
import { createDb } from './db.js'
import { createAuditLogDao } from './auditLogDao.js'

const port = Number(process.env.AUDIT_SERVICE_PORT ?? 4005)
const db = createDb()

const server = createApp({
	auditLogDao: createAuditLogDao(db),
}).listen(port, () => {
	console.log(`audit-service listening on http://localhost:${port}`)
})

function shutdown() {
	server.close(() => db.$disconnect())
}

process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)