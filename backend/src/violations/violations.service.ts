import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { ViolationStatus, ViolationVerdict } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateViolationDto } from './dto/create-violation.dto';
import { AppealViolationDto } from './dto/appeal-violation.dto';
import { CloseEvaluationDto } from './dto/close-evaluation.dto';
import { ChooseViolationPenaltyDto } from './dto/choose-violation-penalty.dto';
import { checkAndApplyJailStatus } from '../common/jail.util';

/** Shared select for violation list/detail queries. */
const VIOLATION_SELECT = {
    id: true,
    status: true,
    title: true,
    description: true,
    points: true,
    creditFine: true,
    penaltyMode: true,
    offenderChoice: true,
    creditsDeducted: true,
    pointsDeducted: true,
    creditsRefunded: true,
    roomId: true,
    expiresAt: true,
    archivedAt: true,
    pointsRefunded: true,
    refundedAt: true,
    appealedAt: true,
    appealNote: true,
    evaluationStartedAt: true,
    evaluationClosedAt: true,
    verdict: true,
    verdictNote: true,
    closedById: true,
    mayorViolationId: true,
    createdAt: true,
    offender: { select: { id: true, username: true } },
    createdBy: { select: { id: true, username: true } },
    chatRoom: { select: { id: true, closedAt: true } },
} as const;

@Injectable()
export class ViolationsService {
    private readonly logger = new Logger(ViolationsService.name);

    constructor(private readonly prisma: PrismaService) { }

    // ─── CREATE ──────────────────────────────────────────────────

    async create(dto: CreateViolationDto, userId: string) {
        const creator = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, roomId: true, role: true },
        });
        if (!creator) throw new NotFoundException('Authenticated user not found');

        const room = await this.prisma.room.findUnique({
            where: { id: creator.roomId },
            select: { id: true, mayorId: true, departmentId: true },
        });
        if (!room) throw new NotFoundException('Room not found');

        const isRoomMayor = room.mayorId === creator.id;
        const isAdmin = creator.role === 'ADMIN';
        if (!isRoomMayor && !isAdmin) {
            throw new ForbiddenException('Only the room mayor (or ADMIN) can create violations');
        }

        const offender = await this.prisma.user.findUnique({
            where: { id: dto.offenderId },
            select: { id: true, roomId: true, socialScore: true, credits: true },
        });
        if (!offender) throw new NotFoundException('Offender user not found');
        if (offender.roomId !== creator.roomId) {
            throw new BadRequestException('Offender must be a member of the same room');
        }

        const creditFine = dto.creditFine ?? 0;
        const penaltyMode = dto.penaltyMode ?? 'BOTH_MANDATORY';

        // D1: Handle penalty modes
        if (penaltyMode === 'BOTH_MANDATORY') {
            // Deduct both immediately
            const socialDeduction = Math.min(dto.points, offender.socialScore);
            const creditDeduction = Math.min(creditFine, offender.credits);

            return this.prisma.$transaction(async (tx) => {
                await tx.user.update({
                    where: { id: dto.offenderId },
                    data: {
                        socialScore: { decrement: socialDeduction },
                        credits: { decrement: creditDeduction },
                    },
                });

                // Deposit credit fine into department treasury
                if (creditDeduction > 0) {
                    await tx.department.update({
                        where: { id: room.departmentId },
                        data: { treasuryCredits: { increment: creditDeduction } },
                    });
                    await tx.treasuryTransaction.create({
                        data: {
                            type: 'VIOLATION_FINE_INCOME',
                            amount: creditDeduction,
                            departmentId: room.departmentId,
                            userId: dto.offenderId,
                            createdById: creator.id,
                            note: `Violation fine: ${dto.title}`,
                        },
                    });
                }

                const v = await tx.violation.create({
                    data: {
                        roomId: creator.roomId,
                        offenderId: dto.offenderId,
                        createdById: creator.id,
                        title: dto.title,
                        description: dto.description,
                        points: dto.points,
                        creditFine,
                        penaltyMode: 'BOTH_MANDATORY',
                        pointsDeducted: socialDeduction,
                        creditsDeducted: creditDeduction,
                        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
                    },
                    select: VIOLATION_SELECT,
                });

                // Link treasury transaction to violation
                if (creditDeduction > 0) {
                    await tx.treasuryTransaction.updateMany({
                        where: {
                            type: 'VIOLATION_FINE_INCOME',
                            userId: dto.offenderId,
                            createdById: creator.id,
                            violationId: null,
                        },
                        data: { violationId: v.id },
                    });
                }

                // Check jail status after socialScore decrement
                await checkAndApplyJailStatus(tx, dto.offenderId);

                return v;
            });
        }

        // EITHER_CHOICE: create violation without deductions — offender must choose
        return this.prisma.violation.create({
            data: {
                roomId: creator.roomId,
                offenderId: dto.offenderId,
                createdById: creator.id,
                title: dto.title,
                description: dto.description,
                points: dto.points,
                creditFine,
                penaltyMode: 'EITHER_CHOICE',
                expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
            },
            select: VIOLATION_SELECT,
        });
    }

    // ─── LIST (room-scoped) ──────────────────────────────────────

    async findAll(userId: string, offenderId?: string, status?: ViolationStatus) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { roomId: true },
        });
        if (!user) throw new NotFoundException('User not found');

        if (offenderId) {
            const off = await this.prisma.user.findUnique({
                where: { id: offenderId },
                select: { roomId: true },
            });
            if (!off || off.roomId !== user.roomId) {
                throw new BadRequestException('Requested offender is not in your room');
            }
        }

        return this.prisma.violation.findMany({
            where: {
                roomId: user.roomId,
                ...(offenderId ? { offenderId } : {}),
                ...(status ? { status } : {}),
            },
            orderBy: { createdAt: 'desc' },
            select: VIOLATION_SELECT,
        });
    }

    // ─── APPEAL ──────────────────────────────────────────────────

    async appeal(violationId: string, userId: string, dto: AppealViolationDto) {
        const violation = await this.prisma.violation.findUnique({
            where: { id: violationId },
            select: { id: true, offenderId: true, status: true },
        });
        if (!violation) throw new NotFoundException('Violation not found');

        if (violation.offenderId !== userId) {
            throw new ForbiddenException('Only the offender can appeal their violation');
        }

        if (violation.status !== ViolationStatus.ACTIVE) {
            throw new BadRequestException('Only ACTIVE violations can be appealed');
        }

        return this.prisma.violation.update({
            where: { id: violationId },
            data: {
                status: ViolationStatus.APPEALED,
                appealedAt: new Date(),
                appealNote: dto.note ?? null,
            },
            select: VIOLATION_SELECT,
        });
    }

    // ─── PM INBOX (department-scoped appealed/evaluating violations) ──

    async getAppeals(userId: string) {
        // Find the department where this user is PM
        const dept = await this.prisma.department.findFirst({
            where: { primeMinisterId: userId },
            select: {
                id: true,
                rooms: { select: { id: true } },
            },
        });

        if (!dept) {
            throw new ForbiddenException('You are not a Prime Minister of any department');
        }

        const roomIds = dept.rooms.map((r) => r.id);

        return this.prisma.violation.findMany({
            where: {
                roomId: { in: roomIds },
                status: { in: [ViolationStatus.APPEALED, ViolationStatus.IN_EVALUATION] },
            },
            orderBy: { appealedAt: 'desc' },
            select: VIOLATION_SELECT,
        });
    }

    // ─── INVITED CASES ───────────────────────────────────────────

    async getInvited(userId: string) {
        const violations = await this.prisma.violation.findMany({
            where: {
                chatRoom: {
                    type: 'VIOLATION_CASE',
                    members: { some: { userId } },
                },
            },
            orderBy: { updatedAt: 'desc' },
            select: {
                id: true,
                title: true,
                points: true,
                status: true,
                appealedAt: true,
                evaluationStartedAt: true,
                createdAt: true,
                updatedAt: true,
                offender: { select: { id: true, username: true } },
                createdBy: { select: { id: true, username: true } },
                room: {
                    select: {
                        id: true,
                        roomNumber: true,
                        departmentId: true,
                        department: { select: { id: true, name: true } },
                    },
                },
                chatRoom: { select: { id: true } },
            },
        });

        return violations.map(v => ({
            ...v,
            chatRoomId: v.chatRoom?.id,
        }));
    }

    // ─── FIND ONE (Case Details) ─────────────────────────────────

    async findOne(id: string, userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { roomId: true },
        });
        if (!user) throw new NotFoundException('User not found');

        const violation = await this.prisma.violation.findUnique({
            where: { id },
            select: VIOLATION_SELECT,
        });

        if (!violation) throw new NotFoundException('Violation not found');

        if (violation.roomId === user.roomId) {
            return violation;
        }

        if (violation.chatRoom) {
            const membership = await this.prisma.chatRoomMember.findUnique({
                where: {
                    chatRoomId_userId: {
                        chatRoomId: violation.chatRoom.id,
                        userId,
                    },
                },
            });
            if (membership) {
                return violation;
            }
        }

        throw new ForbiddenException('You do not have permission to view this violation');
    }

    // ─── START EVALUATION ────────────────────────────────────────

    async startEvaluation(violationId: string, userId: string) {
        const violation = await this.prisma.violation.findUnique({
            where: { id: violationId },
            include: {
                room: { select: { departmentId: true } },
            },
        });
        if (!violation) throw new NotFoundException('Violation not found');

        if (violation.status !== ViolationStatus.APPEALED) {
            throw new BadRequestException('Only APPEALED violations can start evaluation');
        }

        // Check user is PM of the offender's department
        const dept = await this.prisma.department.findFirst({
            where: {
                id: violation.room.departmentId,
                primeMinisterId: userId,
            },
        });
        if (!dept) {
            throw new ForbiddenException('You are not the PM of this department');
        }

        // Create case chat with members: PM, mayor (who issued), offender
        const result = await this.prisma.$transaction(async (tx) => {
            // Build unique initial member list (PM, Mayor who issued, Offender)
            const memberIds = [
                userId,                 // PM
                violation.createdById,  // Mayor
                violation.offenderId,   // Offender
            ].filter(Boolean);

            // Deduplicate (handles PM==Mayor, PM==Offender, etc.)
            const uniqueMemberIds = Array.from(new Set(memberIds));
            const chatRoom = await tx.chatRoom.create({
                data: {
                    type: 'VIOLATION_CASE',
                    violationId,
                    members: {
                        create: uniqueMemberIds.map((id) => ({ userId: id })),
                    },
                },
                select: { id: true },
            });

            const updated = await tx.violation.update({
                where: { id: violationId },
                data: {
                    status: ViolationStatus.IN_EVALUATION,
                    evaluationStartedAt: new Date(),
                },
                select: VIOLATION_SELECT,
            });

            return updated;
        });

        return result;
    }

    // ─── CASE CHAT: GET MESSAGES ─────────────────────────────────

    async getCaseChatMessages(
        violationId: string,
        userId: string,
        limit = 50,
        cursor?: string,
    ) {
        const violation = await this.prisma.violation.findUnique({
            where: { id: violationId },
            select: { chatRoom: { select: { id: true, closedAt: true } } },
        });
        if (!violation?.chatRoom) {
            throw new NotFoundException('Case chat not found');
        }

        // Ensure user is a member
        const membership = await this.prisma.chatRoomMember.findUnique({
            where: {
                chatRoomId_userId: {
                    chatRoomId: violation.chatRoom.id,
                    userId,
                },
            },
        });
        if (!membership) {
            throw new ForbiddenException('You are not a member of this case chat');
        }

        const messages = await this.prisma.chatMessage.findMany({
            where: {
                chatRoomId: violation.chatRoom.id,
                deletedAt: null,
            },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: limit,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
            select: {
                id: true,
                content: true,
                createdAt: true,
                sender: { select: { id: true, username: true, role: true } },
            },
        });

        const nextCursor = messages.length ? messages[messages.length - 1].id : null;

        return {
            chatRoomId: violation.chatRoom.id,
            closed: !!violation.chatRoom.closedAt,
            items: messages,
            nextCursor,
        };
    }

    // ─── CASE CHAT: SEND MESSAGE ─────────────────────────────────

    async sendCaseChatMessage(violationId: string, userId: string, content: string) {
        const violation = await this.prisma.violation.findUnique({
            where: { id: violationId },
            select: { chatRoom: { select: { id: true, closedAt: true } } },
        });
        if (!violation?.chatRoom) throw new NotFoundException('Case chat not found');
        if (violation.chatRoom.closedAt) {
            throw new ForbiddenException('This case chat is closed — no new messages allowed');
        }

        const membership = await this.prisma.chatRoomMember.findUnique({
            where: {
                chatRoomId_userId: {
                    chatRoomId: violation.chatRoom.id,
                    userId,
                },
            },
        });
        if (!membership) {
            throw new ForbiddenException('You are not a member of this case chat');
        }

        return this.prisma.chatMessage.create({
            data: {
                chatRoomId: violation.chatRoom.id,
                senderId: userId,
                content,
            },
            select: {
                id: true,
                content: true,
                createdAt: true,
                chatRoomId: true,
                sender: { select: { id: true, username: true, role: true } },
            },
        });
    }

    // ─── CASE CHAT: GET MEMBERS ──────────────────────────────────

    async getCaseChatMembers(violationId: string, userId: string) {
        const violation = await this.prisma.violation.findUnique({
            where: { id: violationId },
            select: { chatRoom: { select: { id: true } } },
        });
        if (!violation?.chatRoom) throw new NotFoundException('Case chat not found');

        const membership = await this.prisma.chatRoomMember.findUnique({
            where: {
                chatRoomId_userId: {
                    chatRoomId: violation.chatRoom.id,
                    userId,
                },
            },
        });
        if (!membership) throw new ForbiddenException('You are not a member');

        return this.prisma.chatRoomMember.findMany({
            where: { chatRoomId: violation.chatRoom.id },
            select: {
                id: true,
                userId: true,
                user: { select: { id: true, username: true, role: true } },
                joinedAt: true,
            },
        });
    }

    // ─── CASE CHAT: ADD MEMBER (PM only, dept-only) ──────────────

    async addCaseChatMember(violationId: string, pmUserId: string, targetUserId: string) {
        const violation = await this.prisma.violation.findUnique({
            where: { id: violationId },
            include: {
                chatRoom: { select: { id: true, closedAt: true } },
                room: { select: { departmentId: true } },
            },
        });
        if (!violation?.chatRoom) throw new NotFoundException('Case chat not found');
        if (violation.chatRoom.closedAt) throw new ForbiddenException('Chat is closed');

        // Must be PM of the department
        const dept = await this.prisma.department.findFirst({
            where: { id: violation.room.departmentId, primeMinisterId: pmUserId },
        });
        if (!dept) throw new ForbiddenException('You are not PM of this department');

        // Target must be in the same department
        const target = await this.prisma.user.findUnique({
            where: { id: targetUserId },
            select: { id: true, room: { select: { departmentId: true } } },
        });
        if (!target) throw new NotFoundException('Target user not found');
        if (target.room.departmentId !== violation.room.departmentId) {
            throw new BadRequestException('User must be in the same department');
        }

        // Upsert to handle duplicates
        return this.prisma.chatRoomMember.upsert({
            where: {
                chatRoomId_userId: {
                    chatRoomId: violation.chatRoom.id,
                    userId: targetUserId,
                },
            },
            create: {
                chatRoomId: violation.chatRoom.id,
                userId: targetUserId,
            },
            update: {}, // no-op if already exists
            select: {
                id: true,
                userId: true,
                user: { select: { id: true, username: true, role: true } },
                joinedAt: true,
            },
        });
    }

    // ─── CASE CHAT: KICK MEMBER (PM only) ────────────────────────

    async kickCaseChatMember(violationId: string, pmUserId: string, targetUserId: string) {
        const violation = await this.prisma.violation.findUnique({
            where: { id: violationId },
            include: {
                chatRoom: { select: { id: true, closedAt: true } },
                room: { select: { departmentId: true } },
            },
        });
        if (!violation?.chatRoom) throw new NotFoundException('Case chat not found');
        if (violation.chatRoom.closedAt) throw new ForbiddenException('Chat is closed');

        const dept = await this.prisma.department.findFirst({
            where: { id: violation.room.departmentId, primeMinisterId: pmUserId },
        });
        if (!dept) throw new ForbiddenException('You are not PM of this department');

        // Cannot kick PM, offender, or issuer (core members)
        if (
            targetUserId === pmUserId ||
            targetUserId === violation.offenderId ||
            targetUserId === violation.createdById
        ) {
            throw new BadRequestException('Cannot remove core case members (PM, offender, issuer)');
        }

        const deleted = await this.prisma.chatRoomMember.deleteMany({
            where: {
                chatRoomId: violation.chatRoom.id,
                userId: targetUserId,
            },
        });

        if (deleted.count === 0) {
            throw new NotFoundException('User is not a member of this case chat');
        }

        return { removed: true };
    }

    // ─── CLOSE EVALUATION (PM verdict) ──────────────────────────

    async closeEvaluation(violationId: string, pmUserId: string, dto: CloseEvaluationDto) {
        const violation = await this.prisma.violation.findUnique({
            where: { id: violationId },
            include: {
                chatRoom: { select: { id: true } },
                room: { select: { departmentId: true } },
                offender: { select: { id: true, socialScore: true, credits: true } },
            },
        });
        if (!violation) throw new NotFoundException('Violation not found');

        if (violation.status !== ViolationStatus.IN_EVALUATION) {
            throw new BadRequestException('Only IN_EVALUATION violations can be closed');
        }

        const dept = await this.prisma.department.findFirst({
            where: { id: violation.room.departmentId, primeMinisterId: pmUserId },
        });
        if (!dept) throw new ForbiddenException('You are not PM of this department');

        return this.prisma.$transaction(async (tx) => {
            // Lock the case chat
            if (violation.chatRoom) {
                await tx.chatRoom.update({
                    where: { id: violation.chatRoom.id },
                    data: { closedAt: new Date() },
                });
            }

            let newStatus: ViolationStatus;
            let mayorViolationId: string | null = null;

            switch (dto.verdict) {
                case ViolationVerdict.UPHELD:
                    newStatus = ViolationStatus.CLOSED_UPHELD;
                    break;

                case ViolationVerdict.OVERTURNED:
                    newStatus = ViolationStatus.CLOSED_OVERTURNED;
                    // D3: Refund social score (idempotent: only if not already refunded)
                    if (violation.pointsRefunded === 0 && violation.pointsDeducted > 0) {
                        await tx.user.update({
                            where: { id: violation.offenderId },
                            data: { socialScore: { increment: violation.pointsDeducted } },
                        });
                    }
                    // D3: Refund credits (idempotent)
                    if (violation.creditsRefunded === 0 && violation.creditsDeducted > 0) {
                        await tx.user.update({
                            where: { id: violation.offenderId },
                            data: { credits: { increment: violation.creditsDeducted } },
                        });
                        // Reverse treasury deposit
                        await tx.department.update({
                            where: { id: violation.room.departmentId },
                            data: { treasuryCredits: { decrement: violation.creditsDeducted } },
                        });
                        await tx.treasuryTransaction.create({
                            data: {
                                type: 'VIOLATION_REFUND',
                                amount: violation.creditsDeducted,
                                departmentId: violation.room.departmentId,
                                violationId,
                                userId: violation.offenderId,
                                createdById: pmUserId,
                                note: `Violation refund (overturned): ${violation.title}`,
                            },
                        });
                    }
                    // Unjail if score recovers from refund
                    await checkAndApplyJailStatus(tx, violation.offenderId);
                    break;

                case ViolationVerdict.PUNISH_MAYOR:
                    // Overturn original violation + refund
                    newStatus = ViolationStatus.CLOSED_OVERTURNED;
                    // D3: Refund social score
                    if (violation.pointsRefunded === 0 && violation.pointsDeducted > 0) {
                        await tx.user.update({
                            where: { id: violation.offenderId },
                            data: { socialScore: { increment: violation.pointsDeducted } },
                        });
                    }
                    // Unjail offender if score recovers from refund
                    await checkAndApplyJailStatus(tx, violation.offenderId);
                    // D3: Refund credits
                    if (violation.creditsRefunded === 0 && violation.creditsDeducted > 0) {
                        await tx.user.update({
                            where: { id: violation.offenderId },
                            data: { credits: { increment: violation.creditsDeducted } },
                        });
                        await tx.department.update({
                            where: { id: violation.room.departmentId },
                            data: { treasuryCredits: { decrement: violation.creditsDeducted } },
                        });
                        await tx.treasuryTransaction.create({
                            data: {
                                type: 'VIOLATION_REFUND',
                                amount: violation.creditsDeducted,
                                departmentId: violation.room.departmentId,
                                violationId,
                                userId: violation.offenderId,
                                createdById: pmUserId,
                                note: `Violation refund (punish mayor): ${violation.title}`,
                            },
                        });
                    }

                    // Create new violation against the mayor
                    const penaltyPoints = dto.mayorPenaltyPoints ?? violation.points;
                    const penaltyTitle = dto.mayorPenaltyTitle ?? `PM ruling: penalty for issuing "${violation.title}"`;

                    const mayor = await tx.user.findUnique({
                        where: { id: violation.createdById },
                        select: { id: true, socialScore: true, roomId: true },
                    });
                    if (mayor) {
                        const mayorDeduction = Math.min(penaltyPoints, mayor.socialScore);
                        await tx.user.update({
                            where: { id: mayor.id },
                            data: { socialScore: { decrement: mayorDeduction } },
                        });

                        const mayorViolation = await tx.violation.create({
                            data: {
                                roomId: mayor.roomId,
                                offenderId: mayor.id,
                                createdById: pmUserId, // PM created it
                                title: penaltyTitle,
                                description: dto.verdictNote ?? null,
                                points: penaltyPoints,
                                pointsDeducted: mayorDeduction,
                                status: ViolationStatus.ACTIVE,
                            },
                        });
                        mayorViolationId = mayorViolation.id;

                        // Check jail for mayor after penalty
                        await checkAndApplyJailStatus(tx, mayor.id);
                    }
                    break;
            }

            return tx.violation.update({
                where: { id: violationId },
                data: {
                    status: newStatus!,
                    evaluationClosedAt: new Date(),
                    verdict: dto.verdict,
                    verdictNote: dto.verdictNote ?? null,
                    closedById: pmUserId,
                    mayorViolationId,
                    ...(dto.verdict !== ViolationVerdict.UPHELD && violation.pointsRefunded === 0
                        ? { pointsRefunded: violation.pointsDeducted || violation.points, refundedAt: new Date() }
                        : {}),
                    ...(dto.verdict !== ViolationVerdict.UPHELD && violation.creditsRefunded === 0 && violation.creditsDeducted > 0
                        ? { creditsRefunded: violation.creditsDeducted }
                        : {}),
                },
                select: VIOLATION_SELECT,
            });
        });
    }

    // ─── D2: CHOOSE PENALTY (offender, EITHER_CHOICE only) ───────

    async choosePenalty(violationId: string, userId: string, dto: ChooseViolationPenaltyDto) {
        const violation = await this.prisma.violation.findUnique({
            where: { id: violationId },
            include: {
                offender: { select: { id: true, socialScore: true, credits: true } },
                room: { select: { departmentId: true } },
            },
        });
        if (!violation) throw new NotFoundException('Violation not found');
        if (violation.offenderId !== userId) throw new ForbiddenException('Only the offender can choose penalty');
        if (violation.penaltyMode !== 'EITHER_CHOICE') throw new BadRequestException('Penalty mode is not EITHER_CHOICE');
        if (violation.offenderChoice) throw new BadRequestException('Penalty already chosen');

        return this.prisma.$transaction(async (tx) => {
            let pointsDeducted = 0;
            let creditsDeducted = 0;

            if (dto.choice === 'SOCIAL_SCORE') {
                pointsDeducted = Math.min(violation.points, violation.offender.socialScore);
                await tx.user.update({
                    where: { id: userId },
                    data: { socialScore: { decrement: pointsDeducted } },
                });
            } else {
                creditsDeducted = Math.min(violation.creditFine, violation.offender.credits);
                await tx.user.update({
                    where: { id: userId },
                    data: { credits: { decrement: creditsDeducted } },
                });
                // Deposit into department treasury
                if (creditsDeducted > 0) {
                    await tx.department.update({
                        where: { id: violation.room.departmentId },
                        data: { treasuryCredits: { increment: creditsDeducted } },
                    });
                    await tx.treasuryTransaction.create({
                        data: {
                            type: 'VIOLATION_FINE_INCOME',
                            amount: creditsDeducted,
                            departmentId: violation.room.departmentId,
                            violationId,
                            userId,
                            createdById: userId,
                            note: `Violation penalty choice (credits): ${violation.title}`,
                        },
                    });
                }
            }

            // Check jail status after penalty choice
            await checkAndApplyJailStatus(tx, userId);

            return tx.violation.update({
                where: { id: violationId },
                data: {
                    offenderChoice: dto.choice as any,
                    pointsDeducted,
                    creditsDeducted,
                },
                select: VIOLATION_SELECT,
            });
        });
    }

    // ─── EXPIRY JOB ──────────────────────────────────────────────

    /**
     * Archives expired violations and refunds points.
     * Idempotent: only processes violations that haven't been archived yet.
     */
    async processExpiredViolations() {
        const now = new Date();

        const expiredViolations = await this.prisma.violation.findMany({
            where: {
                expiresAt: { lte: now },
                status: ViolationStatus.ACTIVE,
                archivedAt: null,
            },
            include: {
                offender: { select: { id: true, socialScore: true } },
            },
        });

        this.logger.log(`Processing ${expiredViolations.length} expired violations`);

        for (const v of expiredViolations) {
            try {
                await this.prisma.$transaction(async (tx) => {
                    // Double-check idempotency inside transaction
                    const current = await tx.violation.findUnique({
                        where: { id: v.id },
                        select: { archivedAt: true, pointsRefunded: true },
                    });
                    if (current?.archivedAt) return; // already processed

                    // Refund points (only if not already refunded)
                    if (!current?.pointsRefunded || current.pointsRefunded === 0) {
                        await tx.user.update({
                            where: { id: v.offenderId },
                            data: { socialScore: { increment: v.points } },
                        });
                        // Unjail if score recovers
                        await checkAndApplyJailStatus(tx, v.offenderId);
                    }

                    await tx.violation.update({
                        where: { id: v.id },
                        data: {
                            status: ViolationStatus.EXPIRED,
                            archivedAt: now,
                            pointsRefunded: v.points,
                            refundedAt: now,
                        },
                    });
                });
            } catch (err) {
                this.logger.error(`Failed to expire violation ${v.id}`, err);
            }
        }

        return { processed: expiredViolations.length };
    }
}
