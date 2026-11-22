import express from 'express'
import { invalidDtoIn, unsupportedKeys } from '@sportslot/api-format'
import { adminIdFromGateway } from './gatewayAuth.js'

const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 100
const MAX_ACTION_LENGTH = 100
const MAX_ENTITY_TYPE_LENGTH = 50
const QUERY_KEYS = ['action', 'entityType', 'pageIndex', 'pageSize']

function toDtoOut(log) {
	return {
		id: log.id,
		userId: log.userId,
		action: log.action,
		entityType: log.entityType,
		entityId: log.entityId,
		details: log.details,
		createdAt: log.createdAt,
	}
}

function readText(query, key, maxLength, invalidTypeKeyMap, invalidValueKeyMap) {
	const value = query[key]

	if (value === undefined || value === '') return undefined

	if (typeof value !== 'string') {
		invalidTypeKeyMap[key] = `${key} musí být jeden řetězec.`
		return undefined
	}

	if (value.length > maxLength) {
		invalidValueKeyMap[key] = `${key} může mít nejvýše ${maxLength} znaků.`
		return undefined
	}

	return value
}

function readInteger(query, key, { min, max, fallback }, invalidTypeKeyMap, invalidValueKeyMap) {
	const value = query[key]

	if (value === undefined || value === '') return fallback

	if (typeof value !== 'string') {
		invalidTypeKeyMap[key] = `${key} musí být jedno číslo.`
		return fallback
	}

	const number = /^\d+$/.test(value) ? Number(value) : NaN

	if (!Number.isSafeInteger(number) || number < min || number > max) {
		invalidValueKeyMap[key] = `${key} musí být celé číslo od ${min} do ${max}.`
		return fallback
	}

	return number
}

export function createAuditLogRouter({ auditLogDao, gatewaySecret }) {
	const router = express.Router()

	router.get('/audit/list', async (req, res) => {
		adminIdFromGateway(req, gatewaySecret)

		const invalidTypeKeyMap = {}
		const invalidValueKeyMap = {}

		const action = readText(req.query, 'action', MAX_ACTION_LENGTH, invalidTypeKeyMap, invalidValueKeyMap)
		const entityType = readText(
			req.query,
			'entityType',
			MAX_ENTITY_TYPE_LENGTH,
			invalidTypeKeyMap,
			invalidValueKeyMap,
		)
		const pageIndex = readInteger(
			req.query,
			'pageIndex',
			{ min: 0, max: 1_000_000, fallback: 0 },
			invalidTypeKeyMap,
			invalidValueKeyMap,
		)
		const pageSize = readInteger(
			req.query,
			'pageSize',
			{ min: 1, max: MAX_PAGE_SIZE, fallback: DEFAULT_PAGE_SIZE },
			invalidTypeKeyMap,
			invalidValueKeyMap,
		)

		if (Object.keys(invalidTypeKeyMap).length || Object.keys(invalidValueKeyMap).length) {
			throw invalidDtoIn({ invalidTypeKeyMap, invalidValueKeyMap })
		}

		const { items, total } = await auditLogDao.list({ action, entityType, pageIndex, pageSize })

		res.json({
			itemList: items.map(toDtoOut),
			pageInfo: { pageIndex, pageSize, total },
			uuAppErrorMap: unsupportedKeys(req, req.query, QUERY_KEYS),
		})
	})

	return router
}