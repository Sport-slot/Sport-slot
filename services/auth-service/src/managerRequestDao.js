const REQUESTER = { select: { id: true, email: true, name: true } }

export function createManagerRequestDao(db) {
	return {
		get: (id) => db.managerRequest.findUnique({ where: { id } }),

		findPendingByUser: (userId) =>
			db.managerRequest.findFirst({ where: { userId, status: 'PENDING' } }),

		list: ({ status } = {}) =>
			db.managerRequest.findMany({
				where: status ? { status } : {},
				orderBy: { createdAt: 'asc' },
				include: { user: REQUESTER },
			}),

		create: ({ userId, message }) =>
			db.managerRequest.create({ data: { userId, message: message ?? null } }),

		isPendingConflict: (error) => error?.code === 'P2002',

		decide: (id, status, adminId) =>
			db.$transaction(async (tx) => {
				const { count } = await tx.managerRequest.updateMany({
					where: { id, status: 'PENDING' },
					data: { status, decidedById: adminId, decidedAt: new Date() },
				})

				if (count === 0) return null

				const request = await tx.managerRequest.findUnique({ where: { id } })

				if (status === 'APPROVED') {
					const user = await tx.user.findUnique({ where: { id: request.userId } })

					if (!user.roles.includes('MANAGER')) {
						await tx.user.update({
							where: { id: user.id },
							data: { roles: { push: 'MANAGER' } },
						})
					}

					await tx.auditLog.create({
						data: {
							userId: adminId,
							action: 'managerRequest/approve',
							entityType: 'ManagerRequest',
							entityId: request.id,
							details: { targetUserId: request.userId },
						},
					})
				}

				return request
			}),
	}
}