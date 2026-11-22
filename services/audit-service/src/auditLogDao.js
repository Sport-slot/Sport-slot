export function createAuditLogDao(db) {
	return {
		list: async ({ action, entityType, pageIndex, pageSize }) => {
			const where = {
				...(action && { action }),
				...(entityType && { entityType }),
			}

			const [items, total] = await Promise.all([
				db.auditLog.findMany({
					where,
					orderBy: { createdAt: 'desc' },
					skip: pageIndex * pageSize,
					take: pageSize,
				}),
				db.auditLog.count({ where }),
			])

			return { items, total }
		},
	}
}