// venue/list a venue/get (BUC 3, US 6). Veřejné commandy: bez přihlášení, bez audit logu.
import { AppError, invalidDtoIn, unsupportedKeys } from '@sportslot/api-format'

// venueDao (napojí se na DB, až tým zapojí sdíleného klienta):
//   list()   -> [{ id, name, city, courts: [{ sport }] }]
//   get(id)  -> { id, name, address, city, description,
//                 openingHours: [{ dayOfWeek, openTime: '07:00', closeTime: '22:00' }],
//                 courts: [{ id, name, sport, surface, indoor }] } | null

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 100

// "Plzeň" -> "plzen" (AC1: bez ohledu na velikost písmen a diakritiku)
export function normalize(text) {
	return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()
}

// Court.sport může obsahovat víc sportů oddělených čárkou: "tenis, nohejbal, streetbal"
function sportsOf(court) {
	return court.sport
		.split(',')
		.map((sport) => sport.trim())
		.filter(Boolean)
}

function readText(dtoIn, key, invalidTypeKeyMap) {
	const value = dtoIn[key]
	if (value === undefined || value === '') return undefined
	if (typeof value !== 'string') {
		invalidTypeKeyMap[key] = 'Musí být text.'
		return undefined
	}
	return normalize(value)
}

function readInt(dtoIn, key, { min, max, fallback }, invalidTypeKeyMap, invalidValueKeyMap) {
	const value = dtoIn[key]
	if (value === undefined) return fallback
	if (typeof value !== 'string' || !/^\d+$/.test(value)) {
		invalidTypeKeyMap[key] = 'Musí být celé číslo.'
		return fallback
	}
	const number = Number(value)
	if (number < min || number > max) {
		invalidValueKeyMap[key] = `Musí být v rozsahu ${min}–${max}.`
		return fallback
	}
	return number
}

export async function listVenues(venueDao, req) {
	const dtoIn = req.query
	const invalidTypeKeyMap = {}
	const invalidValueKeyMap = {}
	const city = readText(dtoIn, 'city', invalidTypeKeyMap)
	const sport = readText(dtoIn, 'sport', invalidTypeKeyMap)
	const pageIndex = readInt(dtoIn, 'pageIndex', { min: 0, max: Number.MAX_SAFE_INTEGER, fallback: 0 }, invalidTypeKeyMap, invalidValueKeyMap)
	const pageSize = readInt(dtoIn, 'pageSize', { min: 1, max: MAX_PAGE_SIZE, fallback: DEFAULT_PAGE_SIZE }, invalidTypeKeyMap, invalidValueKeyMap)
	if (Object.keys(invalidTypeKeyMap).length > 0 || Object.keys(invalidValueKeyMap).length > 0) {
		throw invalidDtoIn({ invalidTypeKeyMap, invalidValueKeyMap })
	}

	// shortcut: filtruje a stránkuje v JS nad všemi sportovišti; přesunout do SQL, až jich budou tisíce.
	const matching = (await venueDao.list())
		.filter((venue) => venue.courts.length > 0) // AC6: sportoviště bez hřišť se nezobrazují
		.filter((venue) => !venue.deactivatedAt)
		.map((venue) => ({
			id: venue.id,
			name: venue.name,
			city: venue.city,
			imageUrl: venue.imageUrl ?? null,
			sports: [...new Set(venue.courts.flatMap(sportsOf))],
		}))
		.filter((venue) => !city || normalize(venue.city) === city)
		.filter((venue) => !sport || venue.sports.some((venueSport) => normalize(venueSport) === sport))
		.sort((a, b) => a.name.localeCompare(b.name, 'cs') || a.id.localeCompare(b.id))

	return {
		itemList: matching.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize),
		pageInfo: { pageIndex, pageSize, total: matching.length },
		uuAppErrorMap: unsupportedKeys(req, dtoIn, ['city', 'sport', 'pageIndex', 'pageSize']),
	}
}

function viewerIdFromGateway(req, gatewaySecret) {
	if (typeof gatewaySecret !== 'string' || gatewaySecret.length < 32) return null
	if (req.get('x-gateway-secret') !== gatewaySecret) return null
	const userId = req.get('x-user-id')
	return userId && UUID.test(userId) ? userId : null
}

export async function getVenue(venueDao, req, { gatewaySecret } = {}) {
	const dtoIn = req.query
	const { id } = dtoIn
	if (id === undefined) throw invalidDtoIn({ missingKeyMap: { id: 'Klíč id je povinný.' } })
	if (typeof id !== 'string') throw invalidDtoIn({ invalidTypeKeyMap: { id: 'Musí být text.' } })
	if (!UUID.test(id)) throw invalidDtoIn({ invalidValueKeyMap: { id: 'Musí být platné UUID.' } })

	const venue = await venueDao.get(id)
	if (!venue) throw new AppError('venueDoesNotExist', 'Sportoviště nenalezeno.', 404, { id })

	const { name, address, city, description, openingHours, courts } = venue
	return {
		id: venue.id,
		name,
		address,
		city,
		description,
		imageUrl: venue.imageUrl ?? null,
		active: !venue.deactivatedAt,
		deactivatedAt: venue.deactivatedAt ?? null,
		isOwner: Boolean(venue.managerId) && venue.managerId === viewerIdFromGateway(req, gatewaySecret),
		openingHours,
		courts,
		uuAppErrorMap: unsupportedKeys(req, dtoIn, ['id']),
	}
}
