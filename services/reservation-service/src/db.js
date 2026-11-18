import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

export function createDb(databaseUrl = process.env.DATABASE_URL) {
	if (!databaseUrl) {
		throw new Error('DATABASE_URL is not configured')
	}

	return new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) })
}
