import { PrismaClient } from '@prisma/client';

/**
 * Check a user's socialScore and apply/remove jail status accordingly.
 *
 * - socialScore < 0 && !isJailed  → jail: demote to CITIZEN, strip mayor/PM/minister, sync senate chat
 * - socialScore >= 0 && isJailed  → unjail: clear isJailed flag (role stays CITIZEN)
 *
 * Can be called with a Prisma transaction client or the root PrismaClient.
 */
export async function checkAndApplyJailStatus(
    prisma: PrismaClient | Parameters<Parameters<PrismaClient['$transaction']>[0]>[0],
    userId: string,
) {
    const user = await (prisma as any).user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            socialScore: true,
            isJailed: true,
            role: true,
            roomId: true,
        },
    });
    if (!user) return;

    // ─── JAIL ────────────────────────────────────────────────────
    if (user.socialScore < 0 && !user.isJailed) {
        const ops: any[] = [];

        // Demote to CITIZEN + jail
        ops.push(
            (prisma as any).user.update({
                where: { id: userId },
                data: { isJailed: true, role: 'CITIZEN' },
            }),
        );

        // Clear room mayorId if they're the mayor
        if (user.roomId) {
            const room = await (prisma as any).room.findFirst({
                where: { id: user.roomId, mayorId: userId },
                select: { id: true, departmentId: true },
            });

            if (room) {
                ops.push(
                    (prisma as any).room.update({
                        where: { id: room.id },
                        data: { mayorId: null },
                    }),
                );

                // Clear dept leadership if applicable
                const dept = await (prisma as any).department.findUnique({
                    where: { id: room.departmentId },
                });
                if (dept) {
                    const deptUpdate: any = {};
                    if (dept.primeMinisterId === userId) deptUpdate.primeMinisterId = null;
                    if (dept.foreignMinisterId === userId) deptUpdate.foreignMinisterId = null;
                    if (dept.financeMinisterId === userId) deptUpdate.financeMinisterId = null;
                    if (Object.keys(deptUpdate).length > 0) {
                        ops.push(
                            (prisma as any).department.update({
                                where: { id: room.departmentId },
                                data: deptUpdate,
                            }),
                        );
                    }
                }
            } else {
                // Not a mayor but might still hold dept positions
                // (e.g. PM who is mayor of another room, but that room is in a different dept?)
                // Just check if they hold any dept leadership
                const depts = await (prisma as any).department.findMany({
                    where: {
                        OR: [
                            { primeMinisterId: userId },
                            { foreignMinisterId: userId },
                            { financeMinisterId: userId },
                        ],
                    },
                });
                for (const dept of depts) {
                    const deptUpdate: any = {};
                    if (dept.primeMinisterId === userId) deptUpdate.primeMinisterId = null;
                    if (dept.foreignMinisterId === userId) deptUpdate.foreignMinisterId = null;
                    if (dept.financeMinisterId === userId) deptUpdate.financeMinisterId = null;
                    if (Object.keys(deptUpdate).length > 0) {
                        ops.push(
                            (prisma as any).department.update({
                                where: { id: dept.id },
                                data: deptUpdate,
                            }),
                        );
                    }
                }
            }
        }

        // Execute all ops (we can't use $transaction inside a transaction,
        // so just await them sequentially)
        for (const op of ops) {
            await op;
        }

        return;
    }

    // ─── UNJAIL ──────────────────────────────────────────────────
    if (user.socialScore >= 0 && user.isJailed) {
        await (prisma as any).user.update({
            where: { id: userId },
            data: { isJailed: false },
        });
    }
}
