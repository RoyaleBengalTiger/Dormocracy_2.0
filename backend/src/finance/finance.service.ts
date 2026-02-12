import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AllocateFundsDto } from './dto/allocate-funds.dto';
import { RecallFundsDto } from './dto/recall-funds.dto';
import { CreateSocialScoreRequestDto } from './dto/create-social-score-request.dto';
import { OfferSocialScoreDto } from './dto/offer-social-score.dto';
import { checkAndApplyJailStatus } from '../common/jail.util';

@Injectable()
export class FinanceService {
    constructor(private readonly prisma: PrismaService) { }

    // ─── Helpers ────────────────────────────────────────────────────

    /** Get user's department via their room. */
    private async getUserDepartment(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                room: {
                    select: {
                        id: true,
                        departmentId: true,
                        department: {
                            select: {
                                id: true,
                                financeMinisterId: true,
                                primeMinisterId: true,
                                treasuryCredits: true,
                            },
                        },
                    },
                },
            },
        });
        if (!user || !user.room) throw new NotFoundException('User or room not found');
        return { user, department: user.room.department, roomId: user.room.id };
    }

    /** Assert caller is the finance minister (or admin). */
    private assertFinanceMinister(
        department: { financeMinisterId: string | null; primeMinisterId: string | null },
        userId: string,
        userRole: string,
    ) {
        if (userRole === 'ADMIN') return;
        if (department.financeMinisterId === userId) return;
        throw new ForbiddenException(
            'Only the finance minister or admin can perform this action',
        );
    }

    /** Assert caller is PM or admin. */
    private assertPmOrAdmin(
        department: { primeMinisterId: string | null },
        userId: string,
        userRole: string,
    ) {
        if (userRole === 'ADMIN') return;
        if (department.primeMinisterId === userId) return;
        throw new ForbiddenException('Only the PM or admin can perform this action');
    }

    // ─── Room Treasury for Mayor ────────────────────────────────────

    async getRoomTreasury(currentUserId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: currentUserId },
            select: {
                id: true,
                room: {
                    select: {
                        id: true,
                        roomNumber: true,
                        mayorId: true,
                        treasuryCredits: true,
                    },
                },
            },
        });
        if (!user || !user.room) throw new NotFoundException('User or room not found');
        if (user.room.mayorId !== currentUserId) {
            throw new ForbiddenException('Only the room mayor can view room treasury');
        }

        const recentTransactions = await this.prisma.treasuryTransaction.findMany({
            where: { roomId: user.room.id },
            orderBy: { createdAt: 'desc' },
            take: 50,
            select: {
                id: true,
                type: true,
                amount: true,
                note: true,
                createdAt: true,
                createdBy: { select: { id: true, username: true } },
            },
        });

        return {
            roomId: user.room.id,
            roomNumber: user.room.roomNumber,
            treasuryCredits: user.room.treasuryCredits,
            recentTransactions,
        };
    }

    // ─── Finance Overview ──────────────────────────────────────────

    async getOverview(currentUserId: string, currentUserRole: string) {
        const { department } = await this.getUserDepartment(currentUserId);
        this.assertFinanceMinister(department, currentUserId, currentUserRole);

        const dept = await this.prisma.department.findUnique({
            where: { id: department.id },
            select: {
                id: true,
                name: true,
                treasuryCredits: true,
                rooms: {
                    select: {
                        id: true,
                        roomNumber: true,
                        treasuryCredits: true,
                    },
                    orderBy: { roomNumber: 'asc' },
                },
            },
        });

        const recentTransactions = await this.prisma.treasuryTransaction.findMany({
            where: { departmentId: department.id },
            orderBy: { createdAt: 'desc' },
            take: 50,
            select: {
                id: true,
                type: true,
                amount: true,
                roomId: true,
                taskId: true,
                userId: true,
                note: true,
                createdAt: true,
                createdBy: { select: { id: true, username: true } },
                room: { select: { id: true, roomNumber: true } },
            },
        });

        return { department: dept, recentTransactions };
    }

    // ─── Allocate / Recall ─────────────────────────────────────────

    async allocateToRoom(
        roomId: string,
        dto: AllocateFundsDto,
        currentUserId: string,
        currentUserRole: string,
    ) {
        const { department } = await this.getUserDepartment(currentUserId);
        this.assertFinanceMinister(department, currentUserId, currentUserRole);

        // Verify room belongs to same department
        const room = await this.prisma.room.findUnique({
            where: { id: roomId },
            select: { id: true, departmentId: true },
        });
        if (!room) throw new NotFoundException('Room not found');
        if (room.departmentId !== department.id) {
            throw new ForbiddenException('Room does not belong to your department');
        }

        return this.prisma.$transaction(async (tx) => {
            // Check department treasury
            const dept = await tx.department.findUnique({
                where: { id: department.id },
                select: { treasuryCredits: true },
            });
            if (!dept || dept.treasuryCredits < dto.amount) {
                throw new BadRequestException(
                    `Insufficient department treasury: available ${dept?.treasuryCredits ?? 0}, requested ${dto.amount}`,
                );
            }

            await tx.department.update({
                where: { id: department.id },
                data: { treasuryCredits: { decrement: dto.amount } },
            });

            await tx.room.update({
                where: { id: roomId },
                data: { treasuryCredits: { increment: dto.amount } },
            });

            const transaction = await tx.treasuryTransaction.create({
                data: {
                    type: 'DEPT_ALLOCATE_TO_ROOM',
                    amount: dto.amount,
                    departmentId: department.id,
                    roomId,
                    createdById: currentUserId,
                    note: dto.note,
                },
            });

            return transaction;
        });
    }

    async recallFromRoom(
        roomId: string,
        dto: RecallFundsDto,
        currentUserId: string,
        currentUserRole: string,
    ) {
        const { department } = await this.getUserDepartment(currentUserId);
        this.assertFinanceMinister(department, currentUserId, currentUserRole);

        // Verify room belongs to same department
        const room = await this.prisma.room.findUnique({
            where: { id: roomId },
            select: { id: true, departmentId: true },
        });
        if (!room) throw new NotFoundException('Room not found');
        if (room.departmentId !== department.id) {
            throw new ForbiddenException('Room does not belong to your department');
        }

        return this.prisma.$transaction(async (tx) => {
            // Check room treasury
            const r = await tx.room.findUnique({
                where: { id: roomId },
                select: { treasuryCredits: true },
            });
            if (!r || r.treasuryCredits < dto.amount) {
                throw new BadRequestException(
                    `Insufficient room treasury: available ${r?.treasuryCredits ?? 0}, requested ${dto.amount}`,
                );
            }

            await tx.room.update({
                where: { id: roomId },
                data: { treasuryCredits: { decrement: dto.amount } },
            });

            await tx.department.update({
                where: { id: department.id },
                data: { treasuryCredits: { increment: dto.amount } },
            });

            const transaction = await tx.treasuryTransaction.create({
                data: {
                    type: 'DEPT_RECALL_FROM_ROOM',
                    amount: dto.amount,
                    departmentId: department.id,
                    roomId,
                    createdById: currentUserId,
                    note: dto.note,
                },
            });

            return transaction;
        });
    }

    // ─── Transactions List ─────────────────────────────────────────

    async getTransactions(
        currentUserId: string,
        currentUserRole: string,
        limit = 50,
    ) {
        const { department } = await this.getUserDepartment(currentUserId);
        this.assertFinanceMinister(department, currentUserId, currentUserRole);

        return this.prisma.treasuryTransaction.findMany({
            where: { departmentId: department.id },
            orderBy: { createdAt: 'desc' },
            take: Math.min(limit, 100),
            select: {
                id: true,
                type: true,
                amount: true,
                roomId: true,
                taskId: true,
                userId: true,
                note: true,
                createdAt: true,
                createdBy: { select: { id: true, username: true } },
                room: { select: { id: true, roomNumber: true } },
            },
        });
    }

    // ─── Social Score Purchase Flow ────────────────────────────────

    /** User creates a purchase request. */
    async createSocialScoreRequest(
        currentUserId: string,
        dto: CreateSocialScoreRequestDto,
    ) {
        const { department } = await this.getUserDepartment(currentUserId);

        return this.prisma.socialScorePurchaseRequest.create({
            data: {
                userId: currentUserId,
                departmentId: department.id,
                requestNote: dto.requestNote,
                status: 'REQUESTED',
            },
        });
    }

    /** PM views social score requests for their department. */
    async getSocialScoreRequests(
        currentUserId: string,
        currentUserRole: string,
        status?: string,
    ) {
        const { department } = await this.getUserDepartment(currentUserId);
        this.assertPmOrAdmin(department, currentUserId, currentUserRole);

        const where: any = { departmentId: department.id };
        if (status) where.status = status;

        return this.prisma.socialScorePurchaseRequest.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                user: { select: { id: true, username: true, credits: true, socialScore: true } },
                offeredBy: { select: { id: true, username: true } },
            },
        });
    }

    /** User views their own social score requests. */
    async getMySocialScoreRequests(currentUserId: string) {
        return this.prisma.socialScorePurchaseRequest.findMany({
            where: { userId: currentUserId },
            orderBy: { createdAt: 'desc' },
            include: {
                offeredBy: { select: { id: true, username: true } },
            },
        });
    }

    /** PM makes an offer. */
    async offerSocialScore(
        requestId: string,
        dto: OfferSocialScoreDto,
        currentUserId: string,
        currentUserRole: string,
    ) {
        const request = await this.prisma.socialScorePurchaseRequest.findUnique({
            where: { id: requestId },
            include: { department: { select: { primeMinisterId: true } } },
        });
        if (!request) throw new NotFoundException('Request not found');

        this.assertPmOrAdmin(
            request.department,
            currentUserId,
            currentUserRole,
        );

        if (request.status !== 'REQUESTED') {
            throw new BadRequestException(
                `Cannot make offer on request with status ${request.status}`,
            );
        }

        return this.prisma.socialScorePurchaseRequest.update({
            where: { id: requestId },
            data: {
                status: 'OFFERED',
                offeredById: currentUserId,
                offeredPriceCredits: dto.offeredPriceCredits,
                offeredSocialScore: dto.offeredSocialScore,
                offeredAt: new Date(),
            },
        });
    }

    /** User accepts an offer. */
    async acceptSocialScoreOffer(
        requestId: string,
        currentUserId: string,
    ) {
        return this.prisma.$transaction(async (tx) => {
            const request = await tx.socialScorePurchaseRequest.findUnique({
                where: { id: requestId },
            });
            if (!request) throw new NotFoundException('Request not found');
            if (request.userId !== currentUserId) {
                throw new ForbiddenException('Only the request owner can accept');
            }
            if (request.status !== 'OFFERED') {
                throw new BadRequestException(
                    `Cannot accept request with status ${request.status}`,
                );
            }
            if (!request.offeredPriceCredits || !request.offeredSocialScore) {
                throw new BadRequestException('Offer is incomplete');
            }

            // Check user has enough credits
            const user = await tx.user.findUnique({
                where: { id: currentUserId },
                select: { credits: true },
            });
            if (!user || user.credits < request.offeredPriceCredits) {
                throw new BadRequestException(
                    `Insufficient credits: you have ${user?.credits ?? 0}, price is ${request.offeredPriceCredits}`,
                );
            }

            // Deduct credits from user
            await tx.user.update({
                where: { id: currentUserId },
                data: { credits: { decrement: request.offeredPriceCredits } },
            });

            // Add social score to user
            await tx.user.update({
                where: { id: currentUserId },
                data: { socialScore: { increment: request.offeredSocialScore } },
            });

            // Add credits to department treasury
            await tx.department.update({
                where: { id: request.departmentId },
                data: { treasuryCredits: { increment: request.offeredPriceCredits } },
            });

            // Log transaction
            await tx.treasuryTransaction.create({
                data: {
                    type: 'USER_BUY_SOCIAL_SCORE',
                    amount: request.offeredPriceCredits,
                    departmentId: request.departmentId,
                    userId: currentUserId,
                    createdById: currentUserId,
                    note: `Social score purchase: ${request.offeredSocialScore} score for ${request.offeredPriceCredits} credits`,
                },
            });

            // Unjail if social score is now >= 0
            await checkAndApplyJailStatus(tx, currentUserId);

            // Update request status
            return tx.socialScorePurchaseRequest.update({
                where: { id: requestId },
                data: {
                    status: 'ACCEPTED',
                    respondedAt: new Date(),
                },
            });
        });
    }

    /** User rejects an offer. */
    async rejectSocialScoreOffer(
        requestId: string,
        currentUserId: string,
    ) {
        const request = await this.prisma.socialScorePurchaseRequest.findUnique({
            where: { id: requestId },
        });
        if (!request) throw new NotFoundException('Request not found');
        if (request.userId !== currentUserId) {
            throw new ForbiddenException('Only the request owner can reject');
        }
        if (request.status !== 'OFFERED') {
            throw new BadRequestException(
                `Cannot reject request with status ${request.status}`,
            );
        }

        return this.prisma.socialScorePurchaseRequest.update({
            where: { id: requestId },
            data: {
                status: 'REJECTED',
                respondedAt: new Date(),
            },
        });
    }
}
