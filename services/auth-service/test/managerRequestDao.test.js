import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createManagerRequestDao } from '../src/managerRequestDao.js'

const ADMIN_ID = '00000000-0000-4000-8000-000000000001'
const PLAYER_ID = '00000000-0000-4000-8000-000000000002'
const REQUEST_ID = '00000000-0000-4000-8000-000000000010'

function fakeDb() {
	const request = { id: REQUEST_ID, userId: PLAYER_ID, status: 'PENDING' }
	const user = { id: PLAYER_ID, roles: ['PLAYER'] }
	const audit = []
	const tx = {
		managerRequest: {
			updateMany: async ({ where, data }) => {
				if (where.id !== request.id || request.status !== 'PENDING') return { count: 0 }
				Object.assign(request, data)
				return { count: 1 }
			},
			findUnique: async () => ({ ...request }),
		},
		user: {
			findUnique: async () => ({ ...user }),
			update: async ({ data }) => {
				user.roles.push(data.roles.push)
			},
		},
		auditLog: {
			create: async ({ data }) => {
				audit.push(data)
			},
		},
	}
	let transactions = 0
	return {
		db: {
			$transaction: async (callback) => {
				transactions += 1
				return callback(tx)
			},
		},
		audit,
		user,
		transactions: () => transactions,
	}
}

describe('managerRequestDao.decide', () => {
	it('grants MANAGER and writes the audit entry in the same transaction', async () => {
		const { db, audit, user, transactions } = fakeDb()

		const decided = await createManagerRequestDao(db).decide(REQUEST_ID, 'APPROVED', ADMIN_ID)

		assert.equal(decided.status, 'APPROVED')
		assert.deepEqual(user.roles, ['PLAYER', 'MANAGER'])
		assert.equal(transactions(), 1)
		assert.deepEqual(audit, [
			{
				userId: ADMIN_ID,
				action: 'managerRequest/approve',
				entityType: 'ManagerRequest',
				entityId: REQUEST_ID,
				details: { targetUserId: PLAYER_ID },
			},
		])
	})

	it('rejects without changing roles or writing an approval entry', async () => {
		const { db, audit, user } = fakeDb()

		const decided = await createManagerRequestDao(db).decide(REQUEST_ID, 'REJECTED', ADMIN_ID)

		assert.equal(decided.status, 'REJECTED')
		assert.deepEqual(user.roles, ['PLAYER'])
		assert.deepEqual(audit, [])
	})

	it('returns null when the request was already decided', async () => {
		const { db } = fakeDb()
		const dao = createManagerRequestDao(db)
		await dao.decide(REQUEST_ID, 'REJECTED', ADMIN_ID)

		assert.equal(await dao.decide(REQUEST_ID, 'APPROVED', ADMIN_ID), null)
	})
})
