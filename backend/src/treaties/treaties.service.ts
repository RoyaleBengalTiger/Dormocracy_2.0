import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import {
    TreatyStatus,
    TreatyType,
    ParticipantStatus,
    ExchangeStatus,
    BreachCaseStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTreatyDto } from './dto/create-treaty.dto';
import { CreateClauseDto } from './dto/create-clause.dto';
import { CreateExchangeDto } from './dto/create-exchange.dto';
import { DeliverExchangeDto } from './dto/deliver-exchange.dto';
import { ReviewExchangeDto } from './dto/review-exchange.dto';
import { CreateBreachCaseDto } from './dto/create-breach-case.dto';
import { ResolveBreachCaseDto } from './dto/resolve-breach-case.dto';
import { RuleBreachCaseDto } from './dto/rule-breach-case.dto';
import { ChooseBreachPenaltyDto } from './dto/choose-breach-penalty.dto';
import { CreateBreachCompensationDto } from './dto/create-breach-compensation.dto';
import { checkAndApplyJailStatus } from '../common/jail.util';

/** Statuses that mean "no longer a stakeholder". */
const INACTIVE_STATUSES: ParticipantStatus[] = [ParticipantStatus.REJECTED, ParticipantStatus.LEFT];

/** Shared select for treaty list / detail queries. */
const TREATY_SELECT = {
    id: true,
    title: true,
    type: true,
    status: true,
    departmentId: true,
    endsAt: true,
    createdAt: true,
    updatedAt: true,
    createdBy: { select: { id: true, username: true } },
    chatRoom: { select: { id: true, closedAt: true } },
    participants: {
        select: {
            id: true,
            type: true,
            status: true,
            roomId: true,
            userId: true,
            respondedAt: true,
            room: { select: { id: true, roomNumber: true } },
            user: { select: { id: true, username: true } },
        },
    },
    clauses: {
        orderBy: { orderIndex: 'asc' as const },
        select: {
            id: true,
            content: true,
            orderIndex: true,
            createdBy: { select: { id: true, username: true } },
            createdAt: true,
        },
    },
} as const;

@Injectable()
export class TreatiesService {
    constructor(private readonly prisma: PrismaService) { }

    // ═══════════════════════════════════════════════════════════════
    // HELPERS
    // ═══════════════════════════════════════════════════════════════

    private async assertPMOfDepartment(userId: string) {
        const dept = await this.prisma.department.findFirst({
            where: { primeMinisterId: userId },
            select: { id: true, rooms: { select: { id: true } } },
        });
        if (!dept) throw new ForbiddenException('You are not PM of any department');
        return dept;
    }

    /**
     * Asserts user is an active stakeholder (PM or active participant).
     * Returns the treaty summary for further checks.
     */
    private async assertTreatyStakeholder(treatyId: string, userId: string) {
        const treaty = await this.prisma.treaty.findUnique({
            where: { id: treatyId },
            select: {
                id: true,
                createdById: true,
                departmentId: true,
                status: true,
                type: true,
                participants: {
                    select: { type: true, roomId: true, userId: true, status: true },
                },
            },
        });
        if (!treaty) throw new NotFoundException('Treaty not found');

        if (this.isUserStakeholder(treaty, userId)) return treaty;

        // Need to look up user's room for room-based participation
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { roomId: true },
        });
        if (!user) throw new NotFoundException('User not found');

        const roomParticipant = treaty.participants.find(
            (p) => p.type === 'ROOM' && p.roomId === user.roomId && !INACTIVE_STATUSES.includes(p.status),
        );
        if (roomParticipant) return treaty;

        throw new ForbiddenException('You are not a stakeholder in this treaty');
    }

    /** Quick check without DB lookup for room membership */
    private isUserStakeholder(
        treaty: { createdById: string; participants: { type: string; userId: string | null; status: ParticipantStatus }[] },
        userId: string,
    ): boolean {
        if (treaty.createdById === userId) return true;
        return treaty.participants.some(
            (p) => p.type === 'USER' && p.userId === userId && !INACTIVE_STATUSES.includes(p.status),
        );
    }

    /**
     * Recompute the desired chat membership set from active participants + PM,
     * then add missing / remove excess members.
     * Must be called inside a transaction.
     */
    private async syncChatMembership(treatyId: string, tx: any) {
        const treaty = await tx.treaty.findUnique({
            where: { id: treatyId },
            select: {
                createdById: true,
                chatRoom: { select: { id: true } },
                participants: {
                    where: { status: { notIn: INACTIVE_STATUSES } },
                    select: { type: true, roomId: true, userId: true },
                },
            },
        });
        if (!treaty?.chatRoom) return;

        // Compute desired member set
        const desiredIds = new Set<string>();
        desiredIds.add(treaty.createdById); // PM always

        for (const p of treaty.participants) {
            if (p.type === 'USER' && p.userId) {
                desiredIds.add(p.userId);
            } else if (p.type === 'ROOM' && p.roomId) {
                const roomUsers = await tx.user.findMany({
                    where: { roomId: p.roomId },
                    select: { id: true },
                });
                roomUsers.forEach((u: any) => desiredIds.add(u.id));
            }
        }

        // Current members
        const currentMembers = await tx.chatRoomMember.findMany({
            where: { chatRoomId: treaty.chatRoom.id },
            select: { userId: true },
        });
        const currentIds = new Set<string>(currentMembers.map((m: any) => m.userId));

        // Add missing
        const toAdd = [...desiredIds].filter((id) => !currentIds.has(id));
        if (toAdd.length > 0) {
            await tx.chatRoomMember.createMany({
                data: toAdd.map((userId) => ({ chatRoomId: treaty.chatRoom!.id, userId })),
                skipDuplicates: true,
            });
        }

        // Remove excess
        const toRemove = [...currentIds].filter((id) => !desiredIds.has(id));
        if (toRemove.length > 0) {
            await tx.chatRoomMember.deleteMany({
                where: { chatRoomId: treaty.chatRoom.id, userId: { in: toRemove } },
            });
        }
    }

    /**
     * After any accept/reject/leave: check if all remaining (non-LEFT, non-REJECTED)
     * participants have ACCEPTED → auto-activate if LOCKED.
     */
    private async recomputeAndMaybeActivate(treatyId: string, tx: any) {
        const treaty = await tx.treaty.findUnique({
            where: { id: treatyId },
            select: { status: true },
        });
        if (!treaty || treaty.status !== TreatyStatus.LOCKED) return;

        const remaining = await tx.treatyParticipant.findMany({
            where: { treatyId, status: { notIn: INACTIVE_STATUSES } },
            select: { status: true },
        });

        // Need at least one active participant to activate
        if (remaining.length === 0) return;

        const allAccepted = remaining.every((p: any) => p.status === ParticipantStatus.ACCEPTED);
        if (allAccepted) {
            await tx.treaty.update({
                where: { id: treatyId },
                data: { status: TreatyStatus.ACTIVE },
            });
        }
    }

    private async assertPMOrMayorInDept(userId: string, departmentId: string) {
        const dept = await this.prisma.department.findFirst({
            where: { id: departmentId, primeMinisterId: userId },
        });
        if (dept) return;

        const room = await this.prisma.room.findFirst({
            where: { departmentId, mayorId: userId },
        });
        if (room) return;

        throw new ForbiddenException('Only PM or a Mayor in this department can manage clauses');
    }

    // ═══════════════════════════════════════════════════════════════
    // CREATE TREATY (PM only) — starts in NEGOTIATION, no participants
    // ═══════════════════════════════════════════════════════════════

    async create(dto: CreateTreatyDto, userId: string) {
        const dept = await this.assertPMOfDepartment(userId);

        if (new Date(dto.endsAt) <= new Date()) {
            throw new BadRequestException('Treaty end date must be in the future');
        }

        return this.prisma.$transaction(async (tx) => {
            const treaty = await tx.treaty.create({
                data: {
                    title: dto.title,
                    type: dto.type,
                    status: TreatyStatus.NEGOTIATION,
                    departmentId: dept.id,
                    createdById: userId,
                    endsAt: new Date(dto.endsAt),
                },
            });

            // A1: Add PM as treaty participant immediately
            await tx.treatyParticipant.create({
                data: {
                    treatyId: treaty.id,
                    type: 'USER',
                    userId,
                    status: ParticipantStatus.ACCEPTED,
                    respondedAt: new Date(),
                },
            });

            // Create chat room with PM
            await tx.chatRoom.create({
                data: {
                    type: 'TREATY_GROUP',
                    treatyId: treaty.id,
                    members: { create: [{ userId }] },
                },
            });

            return tx.treaty.findUnique({
                where: { id: treaty.id },
                select: TREATY_SELECT,
            });
        });
    }

    // ═══════════════════════════════════════════════════════════════
    // LIST TREATIES — stakeholder-only visibility
    // ═══════════════════════════════════════════════════════════════

    async findAll(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, roomId: true, room: { select: { departmentId: true } } },
        });
        if (!user) throw new NotFoundException('User not found');

        return this.prisma.treaty.findMany({
            where: {
                departmentId: user.room.departmentId,
                mode: { not: 'INTER_DEPT' },
                OR: [
                    { createdById: userId },
                    {
                        participants: {
                            some: {
                                status: { notIn: INACTIVE_STATUSES },
                                OR: [
                                    { type: 'USER', userId },
                                    { type: 'ROOM', roomId: user.roomId },
                                ],
                            },
                        },
                    },
                ],
            },
            orderBy: { createdAt: 'desc' },
            select: TREATY_SELECT,
        });
    }

    // ═══════════════════════════════════════════════════════════════
    // GET ONE TREATY (stakeholder-guarded)
    // ═══════════════════════════════════════════════════════════════

    async findOne(treatyId: string, userId: string) {
        await this.assertTreatyStakeholder(treatyId, userId);
        return this.prisma.treaty.findUnique({
            where: { id: treatyId },
            select: TREATY_SELECT,
        });
    }

    // ═══════════════════════════════════════════════════════════════
    // ADVANCE: only NEGOTIATION → LOCKED (PM only)
    // ═══════════════════════════════════════════════════════════════

    async advance(treatyId: string, userId: string) {
        const dept = await this.assertPMOfDepartment(userId);
        const treaty = await this.prisma.treaty.findUnique({
            where: { id: treatyId },
            select: { id: true, status: true, departmentId: true, type: true, clauses: { select: { id: true } } },
        });
        if (!treaty) throw new NotFoundException('Treaty not found');
        if (treaty.departmentId !== dept.id) throw new ForbiddenException('Treaty is not in your department');

        if (treaty.status !== TreatyStatus.NEGOTIATION) {
            throw new BadRequestException('Can only advance from NEGOTIATION to LOCKED');
        }

        if (treaty.type === TreatyType.EXCHANGE && treaty.clauses.length === 0) {
            throw new BadRequestException('Exchange treaties must have at least one clause');
        }

        return this.prisma.treaty.update({
            where: { id: treatyId },
            data: { status: TreatyStatus.LOCKED },
            select: TREATY_SELECT,
        });
    }

    // ═══════════════════════════════════════════════════════════════
    // PARTICIPANT MANAGEMENT (PM only, NEGOTIATION only)
    // ═══════════════════════════════════════════════════════════════

    async addRoomParticipant(treatyId: string, userId: string, roomId: string) {
        const dept = await this.assertPMOfDepartment(userId);
        const treaty = await this.prisma.treaty.findUnique({
            where: { id: treatyId },
            select: { id: true, status: true, departmentId: true },
        });
        if (!treaty) throw new NotFoundException('Treaty not found');
        if (treaty.departmentId !== dept.id) throw new ForbiddenException('Treaty not in your department');
        if (treaty.status !== TreatyStatus.NEGOTIATION) {
            throw new BadRequestException('Participants can only be added during NEGOTIATION');
        }

        const room = await this.prisma.room.findUnique({
            where: { id: roomId },
            select: { id: true, departmentId: true },
        });
        if (!room || room.departmentId !== dept.id) {
            throw new BadRequestException('Room not found or not in your department');
        }

        const existing = await this.prisma.treatyParticipant.findUnique({
            where: { treatyId_roomId: { treatyId, roomId } },
        });
        if (existing) throw new BadRequestException('Room is already a participant');

        return this.prisma.$transaction(async (tx) => {
            // A3: Remove individually-added USER participants whose rooms match
            const roomUsers = await tx.user.findMany({
                where: { roomId },
                select: { id: true },
            });
            const roomUserIds = roomUsers.map((u: any) => u.id);
            if (roomUserIds.length > 0) {
                await tx.treatyParticipant.deleteMany({
                    where: {
                        treatyId,
                        type: 'USER',
                        userId: { in: roomUserIds },
                    },
                });
            }

            await tx.treatyParticipant.create({
                data: { treatyId, type: 'ROOM', roomId },
            });
            await this.syncChatMembership(treatyId, tx);
            return tx.treaty.findUnique({ where: { id: treatyId }, select: TREATY_SELECT });
        });
    }

    async addUserParticipant(treatyId: string, userId: string, targetUserId: string) {
        const dept = await this.assertPMOfDepartment(userId);
        const treaty = await this.prisma.treaty.findUnique({
            where: { id: treatyId },
            select: { id: true, status: true, departmentId: true },
        });
        if (!treaty) throw new NotFoundException('Treaty not found');
        if (treaty.departmentId !== dept.id) throw new ForbiddenException('Treaty not in your department');
        if (treaty.status !== TreatyStatus.NEGOTIATION) {
            throw new BadRequestException('Participants can only be added during NEGOTIATION');
        }

        const target = await this.prisma.user.findUnique({
            where: { id: targetUserId },
            select: { id: true, room: { select: { departmentId: true } } },
        });
        if (!target || target.room.departmentId !== dept.id) {
            throw new BadRequestException('User not found or not in your department');
        }

        const existing = await this.prisma.treatyParticipant.findUnique({
            where: { treatyId_userId: { treatyId, userId: targetUserId } },
        });
        if (existing) throw new BadRequestException('User is already a participant');

        return this.prisma.$transaction(async (tx) => {
            await tx.treatyParticipant.create({
                data: { treatyId, type: 'USER', userId: targetUserId },
            });
            await this.syncChatMembership(treatyId, tx);
            return tx.treaty.findUnique({ where: { id: treatyId }, select: TREATY_SELECT });
        });
    }

    async removeRoomParticipant(treatyId: string, userId: string, roomId: string) {
        const dept = await this.assertPMOfDepartment(userId);
        const treaty = await this.prisma.treaty.findUnique({
            where: { id: treatyId },
            select: { id: true, status: true, departmentId: true },
        });
        if (!treaty) throw new NotFoundException('Treaty not found');
        if (treaty.departmentId !== dept.id) throw new ForbiddenException('Treaty not in your department');
        if (treaty.status !== TreatyStatus.NEGOTIATION) {
            throw new BadRequestException('Participants can only be removed during NEGOTIATION');
        }

        const participant = await this.prisma.treatyParticipant.findUnique({
            where: { treatyId_roomId: { treatyId, roomId } },
        });
        if (!participant) throw new NotFoundException('Room participation not found');

        return this.prisma.$transaction(async (tx) => {
            await tx.treatyParticipant.delete({ where: { id: participant.id } });
            await this.syncChatMembership(treatyId, tx);
            return tx.treaty.findUnique({ where: { id: treatyId }, select: TREATY_SELECT });
        });
    }

    async removeUserParticipant(treatyId: string, userId: string, targetUserId: string) {
        const dept = await this.assertPMOfDepartment(userId);
        const treaty = await this.prisma.treaty.findUnique({
            where: { id: treatyId },
            select: { id: true, status: true, departmentId: true },
        });
        if (!treaty) throw new NotFoundException('Treaty not found');
        if (treaty.departmentId !== dept.id) throw new ForbiddenException('Treaty not in your department');
        if (treaty.status !== TreatyStatus.NEGOTIATION) {
            throw new BadRequestException('Participants can only be removed during NEGOTIATION');
        }

        const participant = await this.prisma.treatyParticipant.findUnique({
            where: { treatyId_userId: { treatyId, userId: targetUserId } },
        });
        if (!participant) throw new NotFoundException('User participation not found');

        return this.prisma.$transaction(async (tx) => {
            await tx.treatyParticipant.delete({ where: { id: participant.id } });
            await this.syncChatMembership(treatyId, tx);
            return tx.treaty.findUnique({ where: { id: treatyId }, select: TREATY_SELECT });
        });
    }

    // ═══════════════════════════════════════════════════════════════
    // A2: USER CANDIDATES (PM only, NEGOTIATION only)
    // ═══════════════════════════════════════════════════════════════

    async getUserCandidates(treatyId: string, userId: string) {
        const dept = await this.assertPMOfDepartment(userId);
        const treaty = await this.prisma.treaty.findUnique({
            where: { id: treatyId },
            select: { id: true, departmentId: true, status: true },
        });
        if (!treaty) throw new NotFoundException('Treaty not found');
        if (treaty.departmentId !== dept.id) throw new ForbiddenException('Treaty not in your department');

        // Get active/pending participants
        const participants = await this.prisma.treatyParticipant.findMany({
            where: { treatyId, status: { notIn: INACTIVE_STATUSES } },
            select: { type: true, userId: true, roomId: true },
        });

        // Existing individually-added user IDs
        const existingUserIds = new Set(
            participants.filter((p) => p.type === 'USER' && p.userId).map((p) => p.userId!),
        );

        // Room-based participants — get all user IDs from those rooms
        const existingRoomIds = participants
            .filter((p) => p.type === 'ROOM' && p.roomId)
            .map((p) => p.roomId!);

        const usersInParticipantRooms = existingRoomIds.length > 0
            ? await this.prisma.user.findMany({
                where: { roomId: { in: existingRoomIds } },
                select: { id: true },
            })
            : [];
        const roomCoveredIds = new Set(usersInParticipantRooms.map((u) => u.id));

        // Get all department users
        const deptRoomIds = dept.rooms.map((r) => r.id);
        const allDeptUsers = await this.prisma.user.findMany({
            where: { roomId: { in: deptRoomIds } },
            select: { id: true, username: true, email: true, roomId: true },
        });

        // Filter: not individually added AND not covered by a room participant
        return allDeptUsers.filter(
            (u) => !existingUserIds.has(u.id) && !roomCoveredIds.has(u.id),
        );
    }

    // ═══════════════════════════════════════════════════════════════
    // CLAUSES (PM/Mayor, NEGOTIATION only)
    // ═══════════════════════════════════════════════════════════════

    async addClause(treatyId: string, userId: string, dto: CreateClauseDto) {
        const treaty = await this.prisma.treaty.findUnique({
            where: { id: treatyId },
            select: { id: true, status: true, departmentId: true, clauses: { select: { orderIndex: true }, orderBy: { orderIndex: 'desc' }, take: 1 } },
        });
        if (!treaty) throw new NotFoundException('Treaty not found');
        if (treaty.status !== TreatyStatus.NEGOTIATION) {
            throw new BadRequestException('Clauses can only be added during NEGOTIATION');
        }

        await this.assertPMOrMayorInDept(userId, treaty.departmentId);

        const nextIndex = (treaty.clauses[0]?.orderIndex ?? -1) + 1;
        return this.prisma.treatyClause.create({
            data: { treatyId, content: dto.content, orderIndex: nextIndex, createdById: userId },
            select: {
                id: true, content: true, orderIndex: true,
                createdBy: { select: { id: true, username: true } },
                createdAt: true,
            },
        });
    }

    async updateClause(treatyId: string, clauseId: string, userId: string, dto: CreateClauseDto) {
        const treaty = await this.prisma.treaty.findUnique({
            where: { id: treatyId },
            select: { id: true, status: true, departmentId: true },
        });
        if (!treaty) throw new NotFoundException('Treaty not found');
        if (treaty.status !== TreatyStatus.NEGOTIATION) {
            throw new BadRequestException('Clauses can only be edited during NEGOTIATION');
        }
        await this.assertPMOrMayorInDept(userId, treaty.departmentId);

        const clause = await this.prisma.treatyClause.findFirst({ where: { id: clauseId, treatyId } });
        if (!clause) throw new NotFoundException('Clause not found');

        return this.prisma.treatyClause.update({
            where: { id: clauseId },
            data: { content: dto.content },
            select: {
                id: true, content: true, orderIndex: true,
                createdBy: { select: { id: true, username: true } },
                createdAt: true,
            },
        });
    }

    async deleteClause(treatyId: string, clauseId: string, userId: string) {
        const treaty = await this.prisma.treaty.findUnique({
            where: { id: treatyId },
            select: { id: true, status: true, departmentId: true },
        });
        if (!treaty) throw new NotFoundException('Treaty not found');
        if (treaty.status !== TreatyStatus.NEGOTIATION) {
            throw new BadRequestException('Clauses can only be removed during NEGOTIATION');
        }
        await this.assertPMOrMayorInDept(userId, treaty.departmentId);

        const clause = await this.prisma.treatyClause.findFirst({ where: { id: clauseId, treatyId } });
        if (!clause) throw new NotFoundException('Clause not found');

        await this.prisma.treatyClause.delete({ where: { id: clauseId } });
        return { deleted: true };
    }

    // ═══════════════════════════════════════════════════════════════
    // ACCEPT / REJECT (LOCKED only)
    // ═══════════════════════════════════════════════════════════════

    async acceptParticipation(treatyId: string, userId: string) {
        return this.respondToParticipation(treatyId, userId, ParticipantStatus.ACCEPTED);
    }

    async rejectParticipation(treatyId: string, userId: string) {
        return this.respondToParticipation(treatyId, userId, ParticipantStatus.REJECTED);
    }

    private async respondToParticipation(treatyId: string, userId: string, response: ParticipantStatus) {
        const treaty = await this.prisma.treaty.findUnique({
            where: { id: treatyId },
            select: {
                id: true, status: true, createdById: true,
                participants: { select: { id: true, type: true, roomId: true, userId: true, status: true } },
            },
        });
        if (!treaty) throw new NotFoundException('Treaty not found');
        if (treaty.status !== TreatyStatus.LOCKED) {
            throw new BadRequestException('Treaty must be LOCKED to accept/reject');
        }

        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, roomId: true },
        });
        if (!user) throw new NotFoundException('User not found');

        // Find participant: direct user first, then room via mayor
        let participant = treaty.participants.find(
            (p) => p.type === 'USER' && p.userId === userId,
        );
        if (!participant) {
            const room = await this.prisma.room.findFirst({
                where: { id: user.roomId, mayorId: userId },
            });
            if (room) {
                participant = treaty.participants.find(
                    (p) => p.type === 'ROOM' && p.roomId === room.id,
                );
            }
        }

        if (!participant) throw new ForbiddenException('You are not a participant');
        if (participant.status !== ParticipantStatus.PENDING) {
            throw new BadRequestException('You have already responded');
        }

        return this.prisma.$transaction(async (tx) => {
            await tx.treatyParticipant.update({
                where: { id: participant!.id },
                data: { status: response, respondedAt: new Date() },
            });

            await this.syncChatMembership(treatyId, tx);
            await this.recomputeAndMaybeActivate(treatyId, tx);

            return tx.treaty.findUnique({ where: { id: treatyId }, select: TREATY_SELECT });
        });
    }

    // ═══════════════════════════════════════════════════════════════
    // LEAVE (LOCKED only)
    // ═══════════════════════════════════════════════════════════════

    /** Individual user leaves their own USER participation */
    async leaveTreaty(treatyId: string, userId: string) {
        const treaty = await this.prisma.treaty.findUnique({
            where: { id: treatyId },
            select: {
                id: true, status: true,
                participants: { select: { id: true, type: true, userId: true, roomId: true, status: true } },
            },
        });
        if (!treaty) throw new NotFoundException('Treaty not found');
        if (treaty.status !== TreatyStatus.LOCKED) {
            throw new BadRequestException('Can only leave during LOCKED stage');
        }

        const participant = treaty.participants.find(
            (p) => p.type === 'USER' && p.userId === userId && !INACTIVE_STATUSES.includes(p.status),
        );
        if (!participant) throw new ForbiddenException('You do not have an individual participation to leave');

        return this.prisma.$transaction(async (tx) => {
            await tx.treatyParticipant.update({
                where: { id: participant.id },
                data: { status: ParticipantStatus.LEFT, respondedAt: new Date() },
            });
            await this.syncChatMembership(treatyId, tx);
            await this.recomputeAndMaybeActivate(treatyId, tx);
            return tx.treaty.findUnique({ where: { id: treatyId }, select: TREATY_SELECT });
        });
    }

    /** Mayor leaves a room participation from the treaty */
    async leaveRoomFromTreaty(treatyId: string, userId: string, roomId: string) {
        const treaty = await this.prisma.treaty.findUnique({
            where: { id: treatyId },
            select: {
                id: true, status: true,
                participants: { select: { id: true, type: true, roomId: true, status: true } },
            },
        });
        if (!treaty) throw new NotFoundException('Treaty not found');
        if (treaty.status !== TreatyStatus.LOCKED) {
            throw new BadRequestException('Can only leave during LOCKED stage');
        }

        // Verify caller is the mayor of this room
        const room = await this.prisma.room.findFirst({
            where: { id: roomId, mayorId: userId },
        });
        if (!room) throw new ForbiddenException('You are not the mayor of this room');

        const participant = treaty.participants.find(
            (p) => p.type === 'ROOM' && p.roomId === roomId && !INACTIVE_STATUSES.includes(p.status),
        );
        if (!participant) throw new NotFoundException('Room is not an active participant');

        return this.prisma.$transaction(async (tx) => {
            await tx.treatyParticipant.update({
                where: { id: participant.id },
                data: { status: ParticipantStatus.LEFT, respondedAt: new Date() },
            });
            await this.syncChatMembership(treatyId, tx);
            await this.recomputeAndMaybeActivate(treatyId, tx);
            return tx.treaty.findUnique({ where: { id: treatyId }, select: TREATY_SELECT });
        });
    }

    // ═══════════════════════════════════════════════════════════════
    // TREATY CHAT
    // ═══════════════════════════════════════════════════════════════

    async getChatMessages(treatyId: string, userId: string, limit = 50, cursor?: string) {
        await this.assertTreatyStakeholder(treatyId, userId);

        const treaty = await this.prisma.treaty.findUnique({
            where: { id: treatyId },
            select: { chatRoom: { select: { id: true, closedAt: true } } },
        });
        if (!treaty?.chatRoom) throw new NotFoundException('Treaty chat not found');

        const membership = await this.prisma.chatRoomMember.findUnique({
            where: { chatRoomId_userId: { chatRoomId: treaty.chatRoom.id, userId } },
        });
        if (!membership) throw new ForbiddenException('You are not a member of this treaty chat');

        const messages = await this.prisma.chatMessage.findMany({
            where: { chatRoomId: treaty.chatRoom.id, deletedAt: null },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: limit,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
            select: {
                id: true, content: true, createdAt: true,
                sender: { select: { id: true, username: true, role: true } },
            },
        });

        return {
            chatRoomId: treaty.chatRoom.id,
            closed: !!treaty.chatRoom.closedAt,
            items: messages,
            nextCursor: messages.length ? messages[messages.length - 1].id : null,
        };
    }

    async sendChatMessage(treatyId: string, userId: string, content: string) {
        await this.assertTreatyStakeholder(treatyId, userId);

        const treaty = await this.prisma.treaty.findUnique({
            where: { id: treatyId },
            select: { chatRoom: { select: { id: true, closedAt: true } } },
        });
        if (!treaty?.chatRoom) throw new NotFoundException('Treaty chat not found');
        if (treaty.chatRoom.closedAt) throw new ForbiddenException('Treaty chat is closed');

        const membership = await this.prisma.chatRoomMember.findUnique({
            where: { chatRoomId_userId: { chatRoomId: treaty.chatRoom.id, userId } },
        });
        if (!membership) throw new ForbiddenException('You are not a member of this treaty chat');

        return this.prisma.chatMessage.create({
            data: { chatRoomId: treaty.chatRoom.id, senderId: userId, content },
            select: {
                id: true, content: true, createdAt: true, chatRoomId: true,
                sender: { select: { id: true, username: true, role: true } },
            },
        });
    }

    // ═══════════════════════════════════════════════════════════════
    // EXCHANGES
    // ═══════════════════════════════════════════════════════════════

    async createExchange(treatyId: string, userId: string, dto: CreateExchangeDto) {
        const treaty = await this.assertTreatyStakeholder(treatyId, userId);
        if (treaty.type !== TreatyType.EXCHANGE) throw new BadRequestException('Exchanges are only available in EXCHANGE treaties');
        if (treaty.status !== TreatyStatus.ACTIVE) throw new BadRequestException('Treaty must be ACTIVE to create exchanges');

        return this.prisma.exchange.create({
            data: { treatyId, type: dto.type, title: dto.title, description: dto.description, bounty: dto.bounty, buyerId: userId },
            select: {
                id: true, type: true, status: true, title: true,
                description: true, bounty: true, createdAt: true,
                seller: { select: { id: true, username: true } },
                buyer: { select: { id: true, username: true } },
                deliveryNotes: true, deliveredAt: true, reviewedAt: true,
            },
        });
    }

    async listExchanges(treatyId: string, userId: string) {
        await this.assertTreatyStakeholder(treatyId, userId);
        return this.prisma.exchange.findMany({
            where: { treatyId },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true, type: true, status: true, title: true,
                description: true, bounty: true, createdAt: true,
                seller: { select: { id: true, username: true } },
                buyer: { select: { id: true, username: true } },
                deliveryNotes: true, deliveredAt: true, reviewedAt: true,
            },
        });
    }

    async acceptExchange(treatyId: string, exchangeId: string, userId: string) {
        await this.assertTreatyStakeholder(treatyId, userId);
        const exchange = await this.prisma.exchange.findFirst({ where: { id: exchangeId, treatyId } });
        if (!exchange) throw new NotFoundException('Exchange not found');
        if (exchange.status !== ExchangeStatus.OPEN) throw new BadRequestException('Exchange is not open');
        if (exchange.buyerId === userId) throw new BadRequestException('Cannot accept your own exchange');

        // Check if user is jailed
        const acceptor = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { isJailed: true },
        });
        if (acceptor?.isJailed) throw new ForbiddenException('Jailed users cannot accept exchanges');

        return this.prisma.exchange.update({
            where: { id: exchangeId },
            data: { sellerId: userId, status: ExchangeStatus.ACCEPTED },
            select: {
                id: true, type: true, status: true, title: true,
                description: true, bounty: true, createdAt: true,
                seller: { select: { id: true, username: true } },
                buyer: { select: { id: true, username: true } },
                deliveryNotes: true, deliveredAt: true, reviewedAt: true,
            },
        });
    }

    async deliverExchange(treatyId: string, exchangeId: string, userId: string, dto: DeliverExchangeDto) {
        await this.assertTreatyStakeholder(treatyId, userId);
        const exchange = await this.prisma.exchange.findFirst({ where: { id: exchangeId, treatyId } });
        if (!exchange) throw new NotFoundException('Exchange not found');
        if (exchange.status !== ExchangeStatus.ACCEPTED) throw new BadRequestException('Exchange has not been accepted yet');
        if (exchange.sellerId !== userId) throw new ForbiddenException('Only the seller can mark delivery');

        return this.prisma.exchange.update({
            where: { id: exchangeId },
            data: { status: ExchangeStatus.DELIVERED, deliveryNotes: dto.deliveryNotes ?? null, deliveredAt: new Date() },
            select: {
                id: true, type: true, status: true, title: true,
                description: true, bounty: true, createdAt: true,
                seller: { select: { id: true, username: true } },
                buyer: { select: { id: true, username: true } },
                deliveryNotes: true, deliveredAt: true, reviewedAt: true,
            },
        });
    }

    async reviewExchange(treatyId: string, exchangeId: string, userId: string, dto: ReviewExchangeDto) {
        await this.assertTreatyStakeholder(treatyId, userId);
        const exchange = await this.prisma.exchange.findFirst({ where: { id: exchangeId, treatyId } });
        if (!exchange) throw new NotFoundException('Exchange not found');
        if (exchange.status !== ExchangeStatus.DELIVERED) throw new BadRequestException('Exchange has not been delivered yet');
        if (exchange.buyerId !== userId) throw new ForbiddenException('Only the buyer can review delivery');

        if (dto.approve) {
            return this.prisma.$transaction(async (tx) => {
                const buyer = await tx.user.findUnique({ where: { id: userId }, select: { credits: true } });
                if (!buyer || buyer.credits < exchange.bounty) throw new BadRequestException('Insufficient credits');
                if (!exchange.sellerId) throw new BadRequestException('Exchange has no seller assigned');

                await tx.user.update({ where: { id: userId }, data: { credits: { decrement: exchange.bounty } } });
                await tx.user.update({ where: { id: exchange.sellerId }, data: { credits: { increment: exchange.bounty } } });

                return tx.exchange.update({
                    where: { id: exchangeId },
                    data: { status: ExchangeStatus.APPROVED, reviewedAt: new Date() },
                    select: {
                        id: true, type: true, status: true, title: true,
                        description: true, bounty: true, createdAt: true,
                        seller: { select: { id: true, username: true } },
                        buyer: { select: { id: true, username: true } },
                        deliveryNotes: true, deliveredAt: true, reviewedAt: true,
                    },
                });
            });
        } else {
            return this.prisma.exchange.update({
                where: { id: exchangeId },
                data: { status: ExchangeStatus.REJECTED, reviewedAt: new Date() },
                select: {
                    id: true, type: true, status: true, title: true,
                    description: true, bounty: true, createdAt: true,
                    seller: { select: { id: true, username: true } },
                    buyer: { select: { id: true, username: true } },
                    deliveryNotes: true, deliveredAt: true, reviewedAt: true,
                },
            });
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // STAKEHOLDERS (for dropdown pickers)
    // ═══════════════════════════════════════════════════════════════

    async getStakeholders(treatyId: string, userId: string) {
        await this.assertTreatyStakeholder(treatyId, userId);

        const stakeholders = await this.prisma.$queryRaw<
            Array<{ id: string; username: string; email: string; roomNumber: string | null }>
        >`
            WITH
            /* 1. Treaty creator (PM) */
            creator AS (
                SELECT t."createdById" AS "userId"
                FROM "Treaty" t
                WHERE t."id" = ${treatyId}
            ),
            /* 2. Direct USER participants (excluding REJECTED/LEFT) */
            direct_users AS (
                SELECT tp."userId"
                FROM "TreatyParticipant" tp
                WHERE tp."treatyId" = ${treatyId}
                  AND tp."type" = 'USER'
                  AND tp."status" NOT IN ('REJECTED', 'LEFT')
                  AND tp."userId" IS NOT NULL
            ),
            /* 3. Users belonging to ROOM participants (excluding REJECTED/LEFT) */
            room_users AS (
                SELECT u."id" AS "userId"
                FROM "TreatyParticipant" tp
                JOIN "User" u ON u."roomId" = tp."roomId"
                WHERE tp."treatyId" = ${treatyId}
                  AND tp."type" = 'ROOM'
                  AND tp."status" NOT IN ('REJECTED', 'LEFT')
                  AND tp."roomId" IS NOT NULL
            ),
            /* Union all three sources and deduplicate */
            all_stakeholder_ids AS (
                SELECT "userId" FROM creator
                UNION
                SELECT "userId" FROM direct_users
                UNION
                SELECT "userId" FROM room_users
            )
            SELECT u."id", u."username", u."email", r."roomNumber"
            FROM all_stakeholder_ids asi
            JOIN "User" u ON u."id" = asi."userId"
            LEFT JOIN "Room" r ON r."id" = u."roomId"
            ORDER BY u."username" ASC
        `;

        return stakeholders;
    }

    // ═══════════════════════════════════════════════════════════════
    // BREACH CASES
    // ═══════════════════════════════════════════════════════════════

    private readonly BREACH_CASE_SELECT = {
        id: true, status: true, title: true, description: true,
        exchangeId: true, createdAt: true,
        filer: { select: { id: true, username: true } },
        accusedUser: { select: { id: true, username: true } },
        clauses: { select: { clause: { select: { id: true, content: true } } } },
        chatRoom: { select: { id: true, closedAt: true } },
        evaluatedAt: true,
        ruledAt: true,
        ruledBy: { select: { id: true, username: true } },
        rulingType: true,
        rulingTargetUserId: true,
        rulingTarget: { select: { id: true, username: true } },
        penaltyMode: true,
        socialPenalty: true,
        creditFine: true,
        criminalChoice: true,
        resolutionNote: true, resolvedAt: true,
        resolvedBy: { select: { id: true, username: true } },
    } as const;

    async createBreachCase(treatyId: string, userId: string, dto: CreateBreachCaseDto) {
        const treaty = await this.assertTreatyStakeholder(treatyId, userId);
        if (treaty.status !== TreatyStatus.ACTIVE) throw new BadRequestException('Breach cases can only be filed on ACTIVE treaties');

        try { await this.assertTreatyStakeholder(treatyId, dto.accusedUserId); }
        catch { throw new BadRequestException('Accused user is not a treaty stakeholder'); }

        const clauses = await this.prisma.treatyClause.findMany({ where: { id: { in: dto.clauseIds }, treatyId } });
        if (clauses.length !== dto.clauseIds.length) throw new BadRequestException('One or more clause IDs are invalid');

        return this.prisma.breachCase.create({
            data: {
                treatyId, filerId: userId, accusedUserId: dto.accusedUserId,
                title: dto.title, description: dto.description, exchangeId: dto.exchangeId ?? null,
                clauses: { create: dto.clauseIds.map((clauseId) => ({ clauseId })) },
            },
            select: this.BREACH_CASE_SELECT,
        });
    }

    async listBreachCases(treatyId: string, userId: string) {
        await this.assertTreatyStakeholder(treatyId, userId);
        return this.prisma.breachCase.findMany({
            where: { treatyId },
            orderBy: { createdAt: 'desc' },
            select: this.BREACH_CASE_SELECT,
        });
    }

    // ─── Start Evaluation (PM only) ────────────────────────────

    async startBreachEvaluation(treatyId: string, breachCaseId: string, userId: string) {
        const dept = await this.assertPMOfDepartment(userId);
        const breach = await this.prisma.breachCase.findFirst({
            where: { id: breachCaseId, treatyId },
            select: { id: true, status: true, filerId: true, accusedUserId: true, chatRoom: { select: { id: true } }, treaty: { select: { departmentId: true } } },
        });
        if (!breach) throw new NotFoundException('Breach case not found');
        if (breach.treaty.departmentId !== dept.id) throw new ForbiddenException('Not in your department');
        if (breach.status !== BreachCaseStatus.OPEN) throw new BadRequestException('Breach case is not OPEN');

        // If chat already exists, just return
        if (breach.chatRoom) {
            return this.prisma.breachCase.findUnique({ where: { id: breachCaseId }, select: this.BREACH_CASE_SELECT });
        }

        const memberIds = Array.from(new Set([userId, breach.filerId, breach.accusedUserId]));

        return this.prisma.$transaction(async (tx) => {
            await tx.chatRoom.create({
                data: {
                    type: 'BREACH_CASE',
                    breachCaseId,
                    members: { create: memberIds.map((id) => ({ userId: id })) },
                },
            });

            return tx.breachCase.update({
                where: { id: breachCaseId },
                data: { status: BreachCaseStatus.IN_REVIEW, evaluatedAt: new Date() },
                select: this.BREACH_CASE_SELECT,
            });
        });
    }

    // ─── Manage Case Chat Members (PM only) ────────────────────

    async addBreachChatMember(treatyId: string, breachCaseId: string, userId: string, targetUserId: string) {
        const dept = await this.assertPMOfDepartment(userId);
        const breach = await this.prisma.breachCase.findFirst({
            where: { id: breachCaseId, treatyId },
            select: { id: true, status: true, chatRoom: { select: { id: true } }, treaty: { select: { departmentId: true } } },
        });
        if (!breach) throw new NotFoundException('Breach case not found');
        if (breach.treaty.departmentId !== dept.id) throw new ForbiddenException('Not in your department');
        if (!['IN_REVIEW', 'AWAITING_CRIMINAL_CHOICE'].includes(breach.status)) {
            throw new BadRequestException('Case must be in review');
        }
        if (!breach.chatRoom) throw new BadRequestException('Case chat not created yet');

        // Verify the target is a treaty stakeholder
        await this.assertTreatyStakeholder(treatyId, targetUserId);

        await this.prisma.chatRoomMember.createMany({
            data: [{ chatRoomId: breach.chatRoom.id, userId: targetUserId }],
            skipDuplicates: true,
        });
        return { added: true };
    }

    async removeBreachChatMember(treatyId: string, breachCaseId: string, userId: string, targetUserId: string) {
        const dept = await this.assertPMOfDepartment(userId);
        if (targetUserId === userId) throw new BadRequestException('PM cannot remove self from case chat');

        const breach = await this.prisma.breachCase.findFirst({
            where: { id: breachCaseId, treatyId },
            select: { id: true, status: true, chatRoom: { select: { id: true } }, treaty: { select: { departmentId: true } } },
        });
        if (!breach) throw new NotFoundException('Breach case not found');
        if (breach.treaty.departmentId !== dept.id) throw new ForbiddenException('Not in your department');
        if (!['IN_REVIEW', 'AWAITING_CRIMINAL_CHOICE'].includes(breach.status)) {
            throw new BadRequestException('Case must be in review');
        }
        if (!breach.chatRoom) throw new BadRequestException('Case chat not created yet');

        await this.prisma.chatRoomMember.deleteMany({
            where: { chatRoomId: breach.chatRoom.id, userId: targetUserId },
        });
        return { removed: true };
    }

    // ─── PM Ruling ─────────────────────────────────────────────

    async ruleBreachCase(treatyId: string, breachCaseId: string, userId: string, dto: RuleBreachCaseDto) {
        const dept = await this.assertPMOfDepartment(userId);
        const breach = await this.prisma.breachCase.findFirst({
            where: { id: breachCaseId, treatyId },
            select: { id: true, status: true, filerId: true, accusedUserId: true, chatRoom: { select: { id: true } }, treaty: { select: { departmentId: true } } },
        });
        if (!breach) throw new NotFoundException('Breach case not found');
        if (breach.treaty.departmentId !== dept.id) throw new ForbiddenException('Not in your department');
        if (breach.status !== BreachCaseStatus.IN_REVIEW) throw new BadRequestException('Case must be IN_REVIEW to rule');

        const now = new Date();

        // ─── DISMISS (NONE) ────────────────────────────────────
        if (dto.rulingType === 'NONE') {
            return this.prisma.$transaction(async (tx) => {
                // Close case chat if exists
                if (breach.chatRoom) {
                    await tx.chatRoom.update({ where: { id: breach.chatRoom.id }, data: { closedAt: now } });
                }
                return tx.breachCase.update({
                    where: { id: breachCaseId },
                    data: {
                        rulingType: 'NONE', penaltyMode: 'NONE',
                        ruledAt: now, ruledById: userId,
                        resolutionNote: dto.resolutionNote ?? null,
                        resolvedById: userId, resolvedAt: now,
                        status: BreachCaseStatus.RESOLVED,
                    },
                    select: this.BREACH_CASE_SELECT,
                });
            });
        }

        // ─── AGAINST someone ───────────────────────────────────
        if (!dto.penaltyMode) throw new BadRequestException('penaltyMode required when ruling against someone');
        const socialPenalty = dto.socialPenalty ?? 0;
        const creditFine = dto.creditFine ?? 0;
        if (socialPenalty === 0 && creditFine === 0) throw new BadRequestException('At least one penalty must be > 0');

        const criminalUserId = dto.rulingType === 'AGAINST_ACCUSED' ? breach.accusedUserId : breach.filerId;

        if (dto.penaltyMode === 'BOTH_MANDATORY') {
            return this.prisma.$transaction(async (tx) => {
                // Apply both penalties immediately
                await tx.user.update({
                    where: { id: criminalUserId },
                    data: {
                        socialScore: { decrement: socialPenalty },
                        credits: { decrement: creditFine },
                    },
                });
                // B2: Deposit credit fine into department treasury
                if (creditFine > 0) {
                    await tx.department.update({
                        where: { id: dept.id },
                        data: { treasuryCredits: { increment: creditFine } },
                    });
                    await tx.treasuryTransaction.create({
                        data: {
                            type: 'BREACH_FINE_INCOME',
                            amount: creditFine,
                            departmentId: dept.id,
                            breachCaseId,
                            userId: criminalUserId,
                            createdById: userId,
                            note: `Breach fine from case ${breachCaseId}`,
                        },
                    });
                }
                // Check jail after penalty
                await checkAndApplyJailStatus(tx, criminalUserId);
                // Close case chat
                if (breach.chatRoom) {
                    await tx.chatRoom.update({ where: { id: breach.chatRoom.id }, data: { closedAt: now } });
                }
                return tx.breachCase.update({
                    where: { id: breachCaseId },
                    data: {
                        rulingType: dto.rulingType as any,
                        rulingTargetUserId: criminalUserId,
                        penaltyMode: 'BOTH_MANDATORY',
                        socialPenalty, creditFine,
                        ruledAt: now, ruledById: userId,
                        resolutionNote: dto.resolutionNote ?? null,
                        resolvedById: userId, resolvedAt: now,
                        status: BreachCaseStatus.RESOLVED,
                    },
                    select: this.BREACH_CASE_SELECT,
                });
            });
        }

        // EITHER_CHOICE — do NOT apply penalties yet
        return this.prisma.breachCase.update({
            where: { id: breachCaseId },
            data: {
                rulingType: dto.rulingType as any,
                rulingTargetUserId: criminalUserId,
                penaltyMode: 'EITHER_CHOICE',
                socialPenalty, creditFine,
                ruledAt: now, ruledById: userId,
                resolutionNote: dto.resolutionNote ?? null,
                status: BreachCaseStatus.AWAITING_CRIMINAL_CHOICE,
            },
            select: this.BREACH_CASE_SELECT,
        });
    }

    // ─── Criminal Chooses Penalty ──────────────────────────────

    async chooseBreachPenalty(treatyId: string, breachCaseId: string, userId: string, dto: ChooseBreachPenaltyDto) {
        const breach = await this.prisma.breachCase.findFirst({
            where: { id: breachCaseId, treatyId },
            select: {
                id: true, status: true, rulingTargetUserId: true,
                socialPenalty: true, creditFine: true,
                chatRoom: { select: { id: true } },
                treaty: { select: { departmentId: true } },
            },
        });
        if (!breach) throw new NotFoundException('Breach case not found');
        if (breach.status !== BreachCaseStatus.AWAITING_CRIMINAL_CHOICE) {
            throw new BadRequestException('Case is not awaiting criminal choice');
        }
        if (breach.rulingTargetUserId !== userId) {
            throw new ForbiddenException('Only the penalized party can choose');
        }

        const now = new Date();
        return this.prisma.$transaction(async (tx) => {
            if (dto.choice === 'SOCIAL') {
                await tx.user.update({
                    where: { id: userId },
                    data: { socialScore: { decrement: breach.socialPenalty ?? 0 } },
                });
            } else {
                const creditAmt = breach.creditFine ?? 0;
                await tx.user.update({
                    where: { id: userId },
                    data: { credits: { decrement: creditAmt } },
                });
                // B2: Deposit credit fine into department treasury
                if (creditAmt > 0) {
                    await tx.department.update({
                        where: { id: breach.treaty.departmentId },
                        data: { treasuryCredits: { increment: creditAmt } },
                    });
                    await tx.treasuryTransaction.create({
                        data: {
                            type: 'BREACH_FINE_INCOME',
                            amount: creditAmt,
                            departmentId: breach.treaty.departmentId,
                            breachCaseId,
                            userId,
                            createdById: userId,
                            note: `Breach penalty choice (credits) for case ${breachCaseId}`,
                        },
                    });
                }
            }
            // Check jail after penalty choice
            await checkAndApplyJailStatus(tx, userId);
            // Close case chat
            if (breach.chatRoom) {
                await tx.chatRoom.update({ where: { id: breach.chatRoom.id }, data: { closedAt: now } });
            }
            return tx.breachCase.update({
                where: { id: breachCaseId },
                data: {
                    criminalChoice: dto.choice as any,
                    resolvedAt: now,
                    status: BreachCaseStatus.RESOLVED,
                },
                select: this.BREACH_CASE_SELECT,
            });
        });
    }

    // ─── B1: Breach Compensation (PM → multiple users) ─────────

    async createBreachCompensations(treatyId: string, breachCaseId: string, userId: string, dto: CreateBreachCompensationDto) {
        const dept = await this.assertPMOfDepartment(userId);
        const breach = await this.prisma.breachCase.findFirst({
            where: { id: breachCaseId, treatyId },
            select: {
                id: true, status: true,
                chatRoom: { select: { id: true, members: { select: { userId: true } } } },
                treaty: { select: { departmentId: true } },
            },
        });
        if (!breach) throw new NotFoundException('Breach case not found');
        if (breach.treaty.departmentId !== dept.id) throw new ForbiddenException('Not in your department');

        // Validate eligible user IDs = breach chat members
        const chatMemberIds = new Set(
            breach.chatRoom?.members.map((m: any) => m.userId) ?? [],
        );
        const totalAmount = dto.compensations.reduce((sum, c) => sum + c.amount, 0);
        if (totalAmount <= 0) throw new BadRequestException('Total compensation must be > 0');

        for (const c of dto.compensations) {
            if (c.amount <= 0) throw new BadRequestException(`Invalid amount for user ${c.userId}`);
            if (!chatMemberIds.has(c.userId)) {
                throw new BadRequestException(`User ${c.userId} is not a member of this breach case`);
            }
        }

        // Check department treasury
        const deptData = await this.prisma.department.findUnique({
            where: { id: dept.id },
            select: { treasuryCredits: true },
        });
        if (!deptData || deptData.treasuryCredits < totalAmount) {
            throw new BadRequestException('Insufficient department treasury for compensation');
        }

        return this.prisma.$transaction(async (tx) => {
            // Decrement department treasury
            await tx.department.update({
                where: { id: dept.id },
                data: { treasuryCredits: { decrement: totalAmount } },
            });

            // Increment each user's credits and log transaction
            for (const c of dto.compensations) {
                await tx.user.update({
                    where: { id: c.userId },
                    data: { credits: { increment: c.amount } },
                });
                await tx.treasuryTransaction.create({
                    data: {
                        type: 'BREACH_COMPENSATION',
                        amount: c.amount,
                        departmentId: dept.id,
                        breachCaseId,
                        userId: c.userId,
                        createdById: userId,
                        note: dto.note ?? `Breach compensation for case ${breachCaseId}`,
                    },
                });
            }

            return { compensated: dto.compensations.length, totalAmount };
        });
    }

    // ─── Breach Case Chat ──────────────────────────────────────

    async getBreachChatMessages(treatyId: string, breachCaseId: string, userId: string, limit = 50, cursor?: string) {
        const breach = await this.prisma.breachCase.findFirst({
            where: { id: breachCaseId, treatyId },
            select: { chatRoom: { select: { id: true, closedAt: true } } },
        });
        if (!breach?.chatRoom) throw new NotFoundException('Breach case chat not found');

        // Verify membership
        const membership = await this.prisma.chatRoomMember.findUnique({
            where: { chatRoomId_userId: { chatRoomId: breach.chatRoom.id, userId } },
        });
        if (!membership) throw new ForbiddenException('You are not a member of this case chat');

        const messages = await this.prisma.chatMessage.findMany({
            where: { chatRoomId: breach.chatRoom.id, deletedAt: null },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: limit,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
            select: {
                id: true, content: true, createdAt: true,
                sender: { select: { id: true, username: true, role: true } },
            },
        });

        return {
            chatRoomId: breach.chatRoom.id,
            closed: !!breach.chatRoom.closedAt,
            items: messages,
            nextCursor: messages.length ? messages[messages.length - 1].id : null,
        };
    }

    async sendBreachChatMessage(treatyId: string, breachCaseId: string, userId: string, content: string) {
        const breach = await this.prisma.breachCase.findFirst({
            where: { id: breachCaseId, treatyId },
            select: { chatRoom: { select: { id: true, closedAt: true } } },
        });
        if (!breach?.chatRoom) throw new NotFoundException('Breach case chat not found');
        if (breach.chatRoom.closedAt) throw new ForbiddenException('Case chat is closed');

        const membership = await this.prisma.chatRoomMember.findUnique({
            where: { chatRoomId_userId: { chatRoomId: breach.chatRoom.id, userId } },
        });
        if (!membership) throw new ForbiddenException('You are not a member of this case chat');

        return this.prisma.chatMessage.create({
            data: { chatRoomId: breach.chatRoom.id, senderId: userId, content },
            select: {
                id: true, content: true, createdAt: true, chatRoomId: true,
                sender: { select: { id: true, username: true, role: true } },
            },
        });
    }

    async getBreachChatMembers(treatyId: string, breachCaseId: string, userId: string) {
        const breach = await this.prisma.breachCase.findFirst({
            where: { id: breachCaseId, treatyId },
            select: { chatRoom: { select: { id: true } } },
        });
        if (!breach?.chatRoom) throw new NotFoundException('Breach case chat not found');

        const membership = await this.prisma.chatRoomMember.findUnique({
            where: { chatRoomId_userId: { chatRoomId: breach.chatRoom.id, userId } },
        });
        if (!membership) throw new ForbiddenException('You are not a member of this case chat');

        return this.prisma.chatRoomMember.findMany({
            where: { chatRoomId: breach.chatRoom.id },
            select: {
                userId: true,
                joinedAt: true,
                user: { select: { id: true, username: true, role: true } },
            },
        });
    }
}

