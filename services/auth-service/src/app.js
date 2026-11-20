import express from 'express'
import {
	AppError,
	errorHandler,
	invalidDtoIn,
	notAuthenticated,
	notFound,
	unsupportedKeys,
} from '@sportslot/api-format'
import { createTokenIssuer } from './token.js'
import { createManagerRequestRouter } from './managerRequestRouter.js'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_ID_TOKEN_LENGTH = 4096

function hasSecret(secret) {
	return typeof secret === 'string' && secret.length >= 32
}

function toUserDtoOut(user) {
	return { id: user.id, email: user.email, name: user.name, roles: user.roles }
}

export function createApp({
	userDao,
	managerRequestDao,
	audit,
	verifyGoogleIdToken,
	jwtSecret = process.env.JWT_SECRET,
	gatewaySecret = process.env.GATEWAY_SECRET,
} = {}) {
	const app = express()
	const issueToken = hasSecret(jwtSecret) ? createTokenIssuer(jwtSecret) : null

	app.use(express.json())

	app.get('/health', (_req, res) => {
		res.json({ status: 'ok', service: 'auth-service' })
	})

	app.post('/auth/googleCallback', async (req, res) => {
		const dtoIn = req.body

		if (!dtoIn || typeof dtoIn !== 'object' || Array.isArray(dtoIn)) {
			throw invalidDtoIn({ invalidTypeKeyMap: { dtoIn: 'Tělo požadavku musí být JSON objekt.' } })
		}

		const { idToken } = dtoIn

		if (idToken === undefined) {
			throw invalidDtoIn({ missingKeyMap: { idToken: 'idToken je povinný.' } })
		}

		if (typeof idToken !== 'string') {
			throw invalidDtoIn({ invalidTypeKeyMap: { idToken: 'idToken musí být řetězec.' } })
		}

		if (!idToken || idToken.length > MAX_ID_TOKEN_LENGTH) {
			throw invalidDtoIn({ invalidValueKeyMap: { idToken: 'idToken není platný.' } })
		}

		if (!verifyGoogleIdToken || !issueToken) {
			throw new AppError('googleLoginUnavailable', 'Přihlášení přes Google není nakonfigurováno.', 503)
		}

		let googleUser

		try {
			googleUser = await verifyGoogleIdToken(idToken)
		} catch {
			throw new AppError('invalidGoogleToken', 'Přihlášení přes Google se nezdařilo.', 401)
		}

		const user = await userDao.upsertByGoogleId(googleUser)

		res.json({
			token: await issueToken(user),
			user: toUserDtoOut(user),
			uuAppErrorMap: unsupportedKeys(req, dtoIn, ['idToken']),
		})
	})

	app.get('/user/me', async (req, res) => {
		if (!hasSecret(gatewaySecret)) {
			throw new AppError('gatewayUnavailable', 'Ověření gateway není nakonfigurováno.', 503)
		}

		const userId = req.get('x-user-id')

		if (req.get('x-gateway-secret') !== gatewaySecret || !userId || !UUID_PATTERN.test(userId)) {
			throw notAuthenticated()
		}

		const user = await userDao.get(userId)

		if (!user) {
			throw new AppError('userDoesNotExist', 'Uživatel nenalezen.', 404, { id: userId })
		}

		res.json({ ...toUserDtoOut(user), uuAppErrorMap: unsupportedKeys(req, req.query, []) })
	})
		if (managerRequestDao) {
		app.use(createManagerRequestRouter({ userDao, managerRequestDao, gatewaySecret, audit }))
	}


	app.use(notFound)
	app.use(errorHandler)
	return app
}
