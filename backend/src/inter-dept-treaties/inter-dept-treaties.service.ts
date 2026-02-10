import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import {
    TreatyMode,
    TreatyStatus,
    TreatyDepartmentStatus,
    BreachCaseStatus,
    BreachVerdictStatus,
    ParticipantStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInterDeptTreatyDto } from './dto/create-inter-dept-treaty.dto';
import { CreateClauseDto } from './dto/create-clause.dto';
import { CreateInterDeptBreachCaseDto } from './dto/create-breach-case.dto';
import { ProposeVerdictDto } from './dto/propose-verdict.dto';
import { VoteVerdictDto, VoteAction } from './dto/vote-verdict.dto';
import { RespondAction } from './dto/respond-department.dto';
import { checkAndApplyJailStatus } from '../common/jail.util';

const INTER_DEPT_TREATY_SELECT = {
    id: true,
    title: true,
    type: true,
    status: true,
    mode: true,
    departmentId: true,
    hostForeignMinisterId: true,
    endsAt: true,
    createdAt: true,
    updatedAt: true,
    createdBy: { select: { id: true, username: true } },
    hostForeignMinister: { select: { id: true, username: true } },
    department: { select: { id: true, name: true } },
    chatRoom: { select: { id: true, closedAt: true } },
    treatyDepartments: {
        select: {
            id: true,
            departmentId: true,
            status: true,
            invitedById: true,
            respondedById: true,
            respondedAt: true,
            createdAt: true,
            department: { select: { id: true, name: true, foreignMinisterId: true, foreignMinister: { select: { id: true, username: true } } } },
            invitedBy: { select: { id: true, username: true } },
            respondedBy: { select: { id: true, username: true } },
        },
    },
    participants: {
        select: {
            id: true,
            type: true,
            status: true,
            roomId: true,
            userId: true,
            respondedAt: true,
            room: { select: { id: true, roomNumber: true, departmentId: true } },
            user: { select: { id: true, username: true, roomId: true } },
        },
    },
    clauses: {
        orderBy: { orderIndex: 'asc' as const },
        select: {
            id: true,
            content: true,
            orderIndex: true,
            isLocked: true,
            lockedById: true,
            lockedBy: { select: { id: true, username: true } },
            lockedAt: true,
            createdBy: { select: { id: true, username: true } },
            createdAt: true,
        },
    },
} as const;

@Injectable()
export class InterDeptTreatiesService {
    constructor(private readonly prisma: PrismaService) { }

    // ═════════════════════════════════════════════════════════════
    // HELPER: Assert user is foreign minister of a department
    // ═════════════════════════════════════════════════════════════

    private async assertForeignMinisterOfDepartment(userId: string) {
        const dept = await this.prisma.department.findFirst({
            where: { foreignMinisterId: userId },
        });
        if (!dept) {
            throw new ForbiddenException('You are not a foreign minister of any department');
        }
        return dept;
    }

    // ═════════════════════════════════════════════════════════════
    // HELPER: Assert user is host FM of treaty
    // ═════════════════════════════════════════════════════════════

    private async assertHostFM(treatyId: string, userId: string) {
        const treaty = await this.prisma.treaty.findUnique({
            where: { id: treatyId },
            select: { hostForeignMinisterId: true, mode: true },
        });
        if (!treaty) throw new NotFoundException('Treaty not found');
        if (treaty.mode !== TreatyMode.INTER_DEPT) throw new BadRequestException('Not an inter-dept treaty');
        if (treaty.hostForeignMinisterId !== userId) {
            throw new ForbiddenException('Only the host foreign minister can perform this action');
        }
        return treaty;
    }

    // ═════════════════════════════════════════════════════════════
    // HELPER: Assert user can access inter-dept treaty
    // ═════════════════════════════════════════════════════════════

    private async assertInterDeptAccess(treatyId: string, userId: string) {
        const treaty = await this.prisma.treaty.findUnique({
            where: { id: treatyId },
            select: {
                id: true,
                mode: true,
                hostForeignMinisterId: true,
                treatyDepartments: {
                    where: { status: { in: [TreatyDepartmentStatus.ACCEPTED, TreatyDepartmentStatus.PENDING] } },
                    select: { departmentId: true, status: true },
                },
                participants: {
                    where: { status: { notIn: [ParticipantStatus.REJECTED, ParticipantStatus.LEFT] } },
                    select: { type: true, roomId: true, userId: true },
                },
            },
        });
        if (!treaty) throw new NotFoundException('Treaty not found');
        if (treaty.mode !== TreatyMode.INTER_DEPT) throw new BadRequestException('Not an inter-dept treaty');

        // 1) Host FM always has access
        if (treaty.hostForeignMinisterId === userId) return treaty;

        // 2) FM of any ACCEPTED or PENDING department (PENDING FMs need access to accept/reject)
        const visibleDeptIds = treaty.treatyDepartments.map(td => td.departmentId);
        const fmDept = await this.prisma.department.findFirst({
            where: { foreignMinisterId: userId, id: { in: visibleDeptIds } },
        });
        if (fmDept) return treaty;

        // 3) Active participant whose dept is in ACCEPTED list
        const acceptedDeptIds = treaty.treatyDepartments
            .filter(td => td.status === TreatyDepartmentStatus.ACCEPTED)
            .map(td => td.departmentId);
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { roomId: true, room: { select: { departmentId: true } } },
        });
        if (!user) throw new ForbiddenException('Access denied');

        const userDeptAccepted = acceptedDeptIds.includes(user.room.departmentId);
        if (!userDeptAccepted) throw new ForbiddenException('Your department is not accepted in this treaty');

        // Check if user is a direct or room participant
        for (const p of treaty.participants) {
            if (p.type === 'USER' && p.userId === userId) return treaty;
            if (p.type === 'ROOM' && p.roomId === user.roomId) return treaty;
        }

        throw new ForbiddenException('You are not a participant in this inter-dept treaty');
    }

    // ═════════════════════════════════════════════════════════════
    // HELPER: Assert user is FM of an ACCEPTED dept for this treaty
    // ═════════════════════════════════════════════════════════════

    private async assertAcceptedDeptFM(treatyId: string, userId: string) {
        const dept = await this.assertForeignMinisterOfDepartment(userId);
        const td = await this.prisma.treatyDepartment.findUnique({
            where: { treatyId_departmentId: { treatyId, departmentId: dept.id } },
        });
        if (!td || td.status !== TreatyDepartmentStatus.ACCEPTED) {
            throw new ForbiddenException('Your department must be ACCEPTED in this treaty');
        }
        return dept;
    }

    // ═════════════════════════════════════════════════════════════
    // SYNC INTER-DEPT TREATY CHAT
    // ═════════════════════════════════════════════════════════════

    private async syncInterDeptTreatyChat(treatyId: string, tx: any) {
        const treaty = await tx.treaty.findUnique({
            where: { id: treatyId },
            select: {
                hostForeignMinisterId: true,
                chatRoom: { select: { id: true } },
                treatyDepartments: {
                    where: { status: TreatyDepartmentStatus.ACCEPTED },
                    select: { departmentId: true },
                },
                participants: {
                    where: { status: { notIn: [ParticipantStatus.REJECTED, ParticipantStatus.LEFT] } },
                    select: { type: true, roomId: true, userId: true },
                },
            },
        });
        if (!treaty?.chatRoom) return;

        const desiredIds = new Set<string>();

        // Host FM always
        if (treaty.hostForeignMinisterId) desiredIds.add(treaty.hostForeignMinisterId);

        // FMs of ACCEPTED departments
        const acceptedDeptIds = treaty.treatyDepartments.map((td: any) => td.departmentId);
        if (acceptedDeptIds.length > 0) {
            const depts = await tx.department.findMany({
                where: { id: { in: acceptedDeptIds }, foreignMinisterId: { not: null } },
                select: { foreignMinisterId: true },
            });
            depts.forEach((d: any) => { if (d.foreignMinisterId) desiredIds.add(d.foreignMinisterId); });
        }

        // Direct user participants
        for (const p of treaty.participants) {
            if (p.type === 'USER' && p.userId) desiredIds.add(p.userId);
            else if (p.type === 'ROOM' && p.roomId) {
                const roomUsers = await tx.user.findMany({ where: { roomId: p.roomId }, select: { id: true } });
                roomUsers.forEach((u: any) => desiredIds.add(u.id));
            }
        }

        // Current members
        const currentMembers = await tx.chatRoomMember.findMany({
            where: { chatRoomId: treaty.chatRoom.id },
            select: { userId: true },
        });
        const currentIds = new Set<string>(currentMembers.map((m: any) => m.userId));

        const toAdd = [...desiredIds].filter(id => !currentIds.has(id));
        if (toAdd.length > 0) {
            await tx.chatRoomMember.createMany({
                data: toAdd.map(userId => ({ chatRoomId: treaty.chatRoom!.id, userId })),
                skipDuplicates: true,
            });
        }

        const toRemove = [...currentIds].filter(id => !desiredIds.has(id));
        if (toRemove.length > 0) {
            await tx.chatRoomMember.deleteMany({
                where: { chatRoomId: treaty.chatRoom.id, userId: { in: toRemove } },
            });
        }
    }

    // ═════════════════════════════════════════════════════════════
    // CREATE INTER-DEPT TREATY
    // ═════════════════════════════════════════════════════════════

    async create(dto: CreateInterDeptTreatyDto, userId: string) {
        const dept = await this.assertForeignMinisterOfDepartment(userId);

        if (new Date(dto.endsAt) <= new Date()) {
            throw new BadRequestException('Treaty end date must be in the future');
        }

        // Verify all departmentIds exist and are different from host
        const memberDepts = await this.prisma.department.findMany({
            where: { id: { in: dto.departmentIds } },
        });
        if (memberDepts.length !== dto.departmentIds.length) {
            throw new BadRequestException('One or more department IDs are invalid');
        }
        const nonHostDeptIds = dto.departmentIds.filter(id => id !== dept.id);
        if (nonHostDeptIds.length === 0) {
            throw new BadRequestException('Must invite at least one other department');
        }

        return this.prisma.$transaction(async (tx) => {
            const treaty = await tx.treaty.create({
                data: {
                    title: dto.title,
                    type: dto.type,
                    status: TreatyStatus.NEGOTIATION,
                    mode: TreatyMode.INTER_DEPT,
                    departmentId: dept.id,
                    createdById: userId,
                    hostForeignMinisterId: userId,
                    endsAt: new Date(dto.endsAt),
                },
            });

            // Insert TreatyDepartment rows
            const deptRows = [
                {
                    treatyId: treaty.id,
                    departmentId: dept.id,
                    status: TreatyDepartmentStatus.ACCEPTED,
                    invitedById: userId,
                    respondedById: userId,
                    respondedAt: new Date(),
                },
                ...nonHostDeptIds.map(deptId => ({
                    treatyId: treaty.id,
                    departmentId: deptId,
                    status: TreatyDepartmentStatus.PENDING,
                    invitedById: userId,
                })),
            ];
            await tx.treatyDepartment.createMany({ data: deptRows });

            // Create chat room with host FM
            await tx.chatRoom.create({
                data: {
                    type: 'TREATY_GROUP',
                    treatyId: treaty.id,
                    members: { create: [{ userId }] },
                },
            });

            return tx.treaty.findUnique({
                where: { id: treaty.id },
                select: INTER_DEPT_TREATY_SELECT,
            });
        });
    }

    // ═════════════════════════════════════════════════════════════
    // LIST INTER-DEPT TREATIES
    // ═════════════════════════════════════════════════════════════

    async findAll(userId: string) {
        // Find user's department
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { room: { select: { departmentId: true } } },
        });
        if (!user) throw new NotFoundException('User not found');

        // Find department where user is FM
        const fmDept = await this.prisma.department.findFirst({
            where: { foreignMinisterId: userId },
            select: { id: true },
        });

        // Build OR conditions for visibility
        const orConditions: any[] = [
            { hostForeignMinisterId: userId },
        ];

        // FM of any ACCEPTED department
        if (fmDept) {
            orConditions.push({
                treatyDepartments: {
                    some: { departmentId: fmDept.id, status: TreatyDepartmentStatus.ACCEPTED },
                },
            });
            // Also show treaties where this dept has PENDING invitation (FM should see invites)
            orConditions.push({
                treatyDepartments: {
                    some: { departmentId: fmDept.id, status: TreatyDepartmentStatus.PENDING },
                },
            });
        }

        // User is a participant
        orConditions.push({
            participants: {
                some: {
                    OR: [
                        { userId, status: { notIn: [ParticipantStatus.REJECTED, ParticipantStatus.LEFT] } },
                        { roomId: user.room.departmentId ? undefined : undefined }, // skip if no dept
                    ],
                },
            },
        });

        // Participant via room
        const userWithRoom = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { roomId: true },
        });
        if (userWithRoom?.roomId) {
            orConditions.push({
                participants: {
                    some: { roomId: userWithRoom.roomId, status: { notIn: [ParticipantStatus.REJECTED, ParticipantStatus.LEFT] } },
                },
            });
        }

        return this.prisma.treaty.findMany({
            where: {
                mode: TreatyMode.INTER_DEPT,
                OR: orConditions,
            },
            select: INTER_DEPT_TREATY_SELECT,
            orderBy: { createdAt: 'desc' },
        });
    }

    // ═════════════════════════════════════════════════════════════
    // GET INTER-DEPT TREATY DETAIL
    // ═════════════════════════════════════════════════════════════

    async findOne(treatyId: string, userId: string) {
        await this.assertInterDeptAccess(treatyId, userId);
        const treaty = await this.prisma.treaty.findUnique({
            where: { id: treatyId },
            select: INTER_DEPT_TREATY_SELECT,
        });
        if (!treaty) throw new NotFoundException('Treaty not found');
        return treaty;
    }

    // ═════════════════════════════════════════════════════════════
    // INVITE DEPARTMENT
    // ═════════════════════════════════════════════════════════════

    async inviteDepartment(treatyId: string, userId: string, departmentId: string) {
        await this.assertHostFM(treatyId, userId);

        const dept = await this.prisma.department.findUnique({ where: { id: departmentId } });
        if (!dept) throw new NotFoundException('Department not found');

        await this.prisma.treatyDepartment.upsert({
            where: { treatyId_departmentId: { treatyId, departmentId } },
            update: { status: TreatyDepartmentStatus.PENDING },
            create: {
                treatyId,
                departmentId,
                status: TreatyDepartmentStatus.PENDING,
                invitedById: userId,
            },
        });

        return this.findOne(treatyId, userId);
    }

    // ═════════════════════════════════════════════════════════════
    // RESPOND TO DEPARTMENT INVITATION
    // ═════════════════════════════════════════════════════════════

    async respondDepartment(treatyId: string, departmentId: string, userId: string, action: RespondAction) {
        // Verify user is FM of that department
        const dept = await this.prisma.department.findUnique({ where: { id: departmentId } });
        if (!dept) throw new NotFoundException('Department not found');
        if (dept.foreignMinisterId !== userId) {
            throw new ForbiddenException('Only the foreign minister of that department can respond');
        }

        const td = await this.prisma.treatyDepartment.findUnique({
            where: { treatyId_departmentId: { treatyId, departmentId } },
        });
        if (!td) throw new NotFoundException('Invitation not found');
        if (td.status !== TreatyDepartmentStatus.PENDING) {
            throw new BadRequestException('This invitation has already been responded to');
        }

        const newStatus = action === RespondAction.ACCEPT
            ? TreatyDepartmentStatus.ACCEPTED
            : TreatyDepartmentStatus.REJECTED;

        return this.prisma.$transaction(async (tx) => {
            await tx.treatyDepartment.update({
                where: { id: td.id },
                data: {
                    status: newStatus,
                    respondedById: userId,
                    respondedAt: new Date(),
                },
            });

            // Sync chat membership
            await this.syncInterDeptTreatyChat(treatyId, tx);

            return tx.treaty.findUnique({
                where: { id: treatyId },
                select: INTER_DEPT_TREATY_SELECT,
            });
        });
    }

    // ═════════════════════════════════════════════════════════════
    // PARTICIPANTS (rooms/users)
    // ═════════════════════════════════════════════════════════════

    async addRoomParticipant(treatyId: string, userId: string, roomId: string) {
        const dept = await this.assertAcceptedDeptFM(treatyId, userId);

        const treaty = await this.prisma.treaty.findUnique({ where: { id: treatyId }, select: { status: true } });
        if (!treaty) throw new NotFoundException('Treaty not found');
        if (treaty.status !== TreatyStatus.NEGOTIATION) {
            throw new BadRequestException('Participants can only be managed during NEGOTIATION');
        }

        const room = await this.prisma.room.findUnique({ where: { id: roomId }, select: { id: true, departmentId: true } });
        if (!room) throw new NotFoundException('Room not found');
        if (room.departmentId !== dept.id) throw new ForbiddenException('You can only add rooms from your own department');

        return this.prisma.$transaction(async (tx) => {
            // Remove individually-added USER participants from this room
            const roomUsers = await tx.user.findMany({ where: { roomId }, select: { id: true } });
            const roomUserIds = roomUsers.map((u: any) => u.id);
            if (roomUserIds.length > 0) {
                await tx.treatyParticipant.deleteMany({
                    where: { treatyId, type: 'USER', userId: { in: roomUserIds } },
                });
            }

            // Add room participant (upsert)
            await tx.treatyParticipant.upsert({
                where: { treatyId_roomId: { treatyId, roomId } },
                update: { status: ParticipantStatus.ACCEPTED },
                create: {
                    treatyId,
                    type: 'ROOM',
                    roomId,
                    status: ParticipantStatus.ACCEPTED,
                    respondedAt: new Date(),
                },
            });

            await this.syncInterDeptTreatyChat(treatyId, tx);

            return tx.treaty.findUnique({ where: { id: treatyId }, select: INTER_DEPT_TREATY_SELECT });
        });
    }

    async addUserParticipant(treatyId: string, userId: string, targetUserId: string) {
        const dept = await this.assertAcceptedDeptFM(treatyId, userId);

        const treaty = await this.prisma.treaty.findUnique({ where: { id: treatyId }, select: { status: true } });
        if (!treaty) throw new NotFoundException('Treaty not found');
        if (treaty.status !== TreatyStatus.NEGOTIATION) {
            throw new BadRequestException('Participants can only be managed during NEGOTIATION');
        }

        const targetUser = await this.prisma.user.findUnique({
            where: { id: targetUserId },
            select: { id: true, roomId: true, room: { select: { departmentId: true } } },
        });
        if (!targetUser) throw new NotFoundException('User not found');
        if (targetUser.room.departmentId !== dept.id) throw new ForbiddenException('You can only add users from your own department');

        // Check if user's room is already a ROOM participant
        const roomParticipant = await this.prisma.treatyParticipant.findUnique({
            where: { treatyId_roomId: { treatyId, roomId: targetUser.roomId } },
        });
        if (roomParticipant && roomParticipant.status !== ParticipantStatus.REJECTED && roomParticipant.status !== ParticipantStatus.LEFT) {
            throw new BadRequestException('This user\'s room is already a ROOM participant — no need to add individually');
        }

        return this.prisma.$transaction(async (tx) => {
            await tx.treatyParticipant.upsert({
                where: { treatyId_userId: { treatyId, userId: targetUserId } },
                update: { status: ParticipantStatus.ACCEPTED },
                create: {
                    treatyId,
                    type: 'USER',
                    userId: targetUserId,
                    status: ParticipantStatus.ACCEPTED,
                    respondedAt: new Date(),
                },
            });

            await this.syncInterDeptTreatyChat(treatyId, tx);

            return tx.treaty.findUnique({ where: { id: treatyId }, select: INTER_DEPT_TREATY_SELECT });
        });
    }

    async removeRoomParticipant(treatyId: string, userId: string, roomId: string) {
        const dept = await this.assertAcceptedDeptFM(treatyId, userId);

        const treaty = await this.prisma.treaty.findUnique({ where: { id: treatyId }, select: { status: true } });
        if (!treaty) throw new NotFoundException('Treaty not found');
        if (treaty.status !== TreatyStatus.NEGOTIATION) {
            throw new BadRequestException('Participants can only be removed during NEGOTIATION');
        }

        const room = await this.prisma.room.findUnique({ where: { id: roomId }, select: { departmentId: true } });
        if (!room || room.departmentId !== dept.id) throw new ForbiddenException('You can only remove rooms from your own department');

        return this.prisma.$transaction(async (tx) => {
            await tx.treatyParticipant.deleteMany({ where: { treatyId, roomId } });
            await this.syncInterDeptTreatyChat(treatyId, tx);
            return tx.treaty.findUnique({ where: { id: treatyId }, select: INTER_DEPT_TREATY_SELECT });
        });
    }

    async removeUserParticipant(treatyId: string, userId: string, targetUserId: string) {
        const dept = await this.assertAcceptedDeptFM(treatyId, userId);

        const treaty = await this.prisma.treaty.findUnique({ where: { id: treatyId }, select: { status: true } });
        if (!treaty) throw new NotFoundException('Treaty not found');
        if (treaty.status !== TreatyStatus.NEGOTIATION) {
            throw new BadRequestException('Participants can only be removed during NEGOTIATION');
        }

        const targetUser = await this.prisma.user.findUnique({
            where: { id: targetUserId },
            select: { room: { select: { departmentId: true } } },
        });
        if (!targetUser || targetUser.room.departmentId !== dept.id) throw new ForbiddenException('You can only remove users from your own department');

        return this.prisma.$transaction(async (tx) => {
            await tx.treatyParticipant.deleteMany({ where: { treatyId, userId: targetUserId } });
            await this.syncInterDeptTreatyChat(treatyId, tx);
            return tx.treaty.findUnique({ where: { id: treatyId }, select: INTER_DEPT_TREATY_SELECT });
        });
    }

    // ═════════════════════════════════════════════════════════════
    // CANDIDATE ENDPOINTS
    // ═════════════════════════════════════════════════════════════

    async getRoomCandidates(treatyId: string, userId: string) {
        const dept = await this.assertAcceptedDeptFM(treatyId, userId);

        // Get rooms from FM's dept that are NOT already ROOM participants
        const existingRoomParticipants = await this.prisma.treatyParticipant.findMany({
            where: { treatyId, type: 'ROOM', status: { notIn: [ParticipantStatus.REJECTED, ParticipantStatus.LEFT] } },
            select: { roomId: true },
        });
        const existingRoomIds = existingRoomParticipants.map(p => p.roomId).filter(Boolean) as string[];

        return this.prisma.room.findMany({
            where: {
                departmentId: dept.id,
                id: { notIn: existingRoomIds },
            },
            select: {
                id: true,
                roomNumber: true,
                users: { select: { id: true, username: true } },
            },
        });
    }

    async getUserCandidates(treatyId: string, userId: string) {
        const dept = await this.assertAcceptedDeptFM(treatyId, userId);

        // Get existing USER participants
        const existingUserParticipants = await this.prisma.treatyParticipant.findMany({
            where: { treatyId, type: 'USER', status: { notIn: [ParticipantStatus.REJECTED, ParticipantStatus.LEFT] } },
            select: { userId: true },
        });
        const existingUserIds = existingUserParticipants.map(p => p.userId).filter(Boolean) as string[];

        // Get rooms that are already ROOM participants (users in those rooms should be excluded)
        const existingRoomParticipants = await this.prisma.treatyParticipant.findMany({
            where: { treatyId, type: 'ROOM', status: { notIn: [ParticipantStatus.REJECTED, ParticipantStatus.LEFT] } },
            select: { roomId: true },
        });
        const existingRoomIds = existingRoomParticipants.map(p => p.roomId).filter(Boolean) as string[];

        return this.prisma.user.findMany({
            where: {
                room: { departmentId: dept.id },
                id: { notIn: existingUserIds },
                roomId: { notIn: existingRoomIds },
            },
            select: { id: true, username: true, email: true, roomId: true },
        });
    }

    // ═════════════════════════════════════════════════════════════
    // CLAUSES
    // ═════════════════════════════════════════════════════════════

    async getClauses(treatyId: string, userId: string) {
        await this.assertInterDeptAccess(treatyId, userId);
        return this.prisma.treatyClause.findMany({
            where: { treatyId },
            orderBy: { orderIndex: 'asc' },
            select: {
                id: true, content: true, orderIndex: true,
                isLocked: true, lockedById: true,
                lockedBy: { select: { id: true, username: true } },
                lockedAt: true,
                createdBy: { select: { id: true, username: true } },
                createdAt: true,
            },
        });
    }

    async addClause(treatyId: string, userId: string, dto: CreateClauseDto) {
        await this.assertAcceptedDeptFM(treatyId, userId);
        const treaty = await this.prisma.treaty.findUnique({ where: { id: treatyId }, select: { status: true } });
        if (!treaty || treaty.status !== TreatyStatus.NEGOTIATION) {
            throw new BadRequestException('Clauses can only be added during NEGOTIATION');
        }

        const maxOrder = await this.prisma.treatyClause.aggregate({
            where: { treatyId },
            _max: { orderIndex: true },
        });

        return this.prisma.treatyClause.create({
            data: {
                treatyId,
                content: dto.content,
                orderIndex: (maxOrder._max.orderIndex ?? -1) + 1,
                createdById: userId,
            },
            select: {
                id: true, content: true, orderIndex: true, isLocked: true,
                createdBy: { select: { id: true, username: true } },
                createdAt: true,
            },
        });
    }

    async updateClause(treatyId: string, clauseId: string, userId: string, dto: CreateClauseDto) {
        await this.assertAcceptedDeptFM(treatyId, userId);

        const clause = await this.prisma.treatyClause.findFirst({
            where: { id: clauseId, treatyId },
        });
        if (!clause) throw new NotFoundException('Clause not found');
        if (clause.isLocked) throw new ForbiddenException('This clause is locked and cannot be edited');

        return this.prisma.treatyClause.update({
            where: { id: clauseId },
            data: { content: dto.content },
            select: {
                id: true, content: true, orderIndex: true, isLocked: true,
                createdBy: { select: { id: true, username: true } },
                createdAt: true,
            },
        });
    }

    async deleteClause(treatyId: string, clauseId: string, userId: string) {
        await this.assertAcceptedDeptFM(treatyId, userId);

        const clause = await this.prisma.treatyClause.findFirst({
            where: { id: clauseId, treatyId },
        });
        if (!clause) throw new NotFoundException('Clause not found');
        if (clause.isLocked) throw new ForbiddenException('This clause is locked and cannot be deleted');

        await this.prisma.treatyClause.delete({ where: { id: clauseId } });
    }

    async lockClause(treatyId: string, clauseId: string, userId: string) {
        await this.assertHostFM(treatyId, userId);

        const clause = await this.prisma.treatyClause.findFirst({ where: { id: clauseId, treatyId } });
        if (!clause) throw new NotFoundException('Clause not found');

        return this.prisma.treatyClause.update({
            where: { id: clauseId },
            data: { isLocked: true, lockedById: userId, lockedAt: new Date() },
        });
    }

    async unlockClause(treatyId: string, clauseId: string, userId: string) {
        await this.assertHostFM(treatyId, userId);

        const clause = await this.prisma.treatyClause.findFirst({ where: { id: clauseId, treatyId } });
        if (!clause) throw new NotFoundException('Clause not found');

        return this.prisma.treatyClause.update({
            where: { id: clauseId },
            data: { isLocked: false, lockedById: null, lockedAt: null },
        });
    }

    // ═════════════════════════════════════════════════════════════
    // CHAT (reuse existing chat architecture)
    // ═════════════════════════════════════════════════════════════

    async getChatMessages(treatyId: string, userId: string, limit = 50, cursor?: string) {
        await this.assertInterDeptAccess(treatyId, userId);

        const treaty = await this.prisma.treaty.findUnique({
            where: { id: treatyId },
            select: { chatRoom: { select: { id: true, closedAt: true } } },
        });
        if (!treaty?.chatRoom) throw new NotFoundException('Chat room not found');

        const where: any = { chatRoomId: treaty.chatRoom.id, deletedAt: null };
        if (cursor) where.createdAt = { lt: new Date(cursor) };

        const messages = await this.prisma.chatMessage.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limit,
            select: {
                id: true, content: true, createdAt: true, chatRoomId: true,
                sender: { select: { id: true, username: true, role: true } },
            },
        });

        return {
            chatRoomId: treaty.chatRoom.id,
            closed: !!treaty.chatRoom.closedAt,
            items: messages.reverse(),
            nextCursor: messages.length === limit ? messages[0]?.createdAt?.toISOString() ?? null : null,
        };
    }

    async sendChatMessage(treatyId: string, userId: string, content: string) {
        await this.assertInterDeptAccess(treatyId, userId);

        const treaty = await this.prisma.treaty.findUnique({
            where: { id: treatyId },
            select: { chatRoom: { select: { id: true, closedAt: true } } },
        });
        if (!treaty?.chatRoom) throw new NotFoundException('Chat room not found');
        if (treaty.chatRoom.closedAt) throw new BadRequestException('Chat is closed');

        // Ensure membership
        await this.prisma.chatRoomMember.upsert({
            where: { chatRoomId_userId: { chatRoomId: treaty.chatRoom.id, userId } },
            update: {},
            create: { chatRoomId: treaty.chatRoom.id, userId },
        });

        return this.prisma.chatMessage.create({
            data: { chatRoomId: treaty.chatRoom.id, senderId: userId, content },
            select: {
                id: true, content: true, createdAt: true, chatRoomId: true,
                sender: { select: { id: true, username: true, role: true } },
            },
        });
    }

    // ═════════════════════════════════════════════════════════════
    // ADVANCE: NEGOTIATION → LOCKED (Host FM only, locks all clauses)
    // ═════════════════════════════════════════════════════════════

    async advance(treatyId: string, userId: string) {
        await this.assertHostFM(treatyId, userId);

        const treaty = await this.prisma.treaty.findUnique({
            where: { id: treatyId },
            select: {
                id: true, status: true, type: true,
                clauses: { select: { id: true } },
                participants: {
                    where: { status: { notIn: [ParticipantStatus.REJECTED, ParticipantStatus.LEFT] } },
                    select: { id: true },
                },
            },
        });
        if (!treaty) throw new NotFoundException('Treaty not found');
        if (treaty.status !== TreatyStatus.NEGOTIATION) {
            throw new BadRequestException('Can only advance from NEGOTIATION to LOCKED');
        }
        if (treaty.clauses.length === 0) {
            throw new BadRequestException('Treaty must have at least one clause to lock');
        }

        return this.prisma.$transaction(async (tx) => {
            // Lock all clauses
            await tx.treatyClause.updateMany({
                where: { treatyId },
                data: { isLocked: true, lockedById: userId, lockedAt: new Date() },
            });

            // Set all active participants to PENDING (so they need to accept)
            await tx.treatyParticipant.updateMany({
                where: {
                    treatyId,
                    status: { notIn: [ParticipantStatus.REJECTED, ParticipantStatus.LEFT] },
                },
                data: { status: ParticipantStatus.PENDING, respondedAt: null },
            });

            // Set treaty to LOCKED
            await tx.treaty.update({
                where: { id: treatyId },
                data: { status: TreatyStatus.LOCKED },
            });

            return tx.treaty.findUnique({
                where: { id: treatyId },
                select: INTER_DEPT_TREATY_SELECT,
            });
        });
    }

    // ═════════════════════════════════════════════════════════════
    // ACCEPT / REJECT PARTICIPATION (LOCKED only)
    // ═════════════════════════════════════════════════════════════

    async acceptParticipation(treatyId: string, userId: string) {
        return this.respondToParticipation(treatyId, userId, ParticipantStatus.ACCEPTED);
    }

    async rejectParticipation(treatyId: string, userId: string) {
        return this.respondToParticipation(treatyId, userId, ParticipantStatus.REJECTED);
    }

    private async respondToParticipation(treatyId: string, userId: string, response: ParticipantStatus) {
        await this.assertInterDeptAccess(treatyId, userId);

        const treaty = await this.prisma.treaty.findUnique({
            where: { id: treatyId },
            select: {
                id: true, status: true,
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

        // Find participant: user participant, or room participant if user is the FM
        let participant = treaty.participants.find(
            p => p.type === 'USER' && p.userId === userId,
        );
        if (!participant && user.roomId) {
            participant = treaty.participants.find(
                p => p.type === 'ROOM' && p.roomId === user.roomId,
            );
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

            await this.syncInterDeptTreatyChat(treatyId, tx);
            await this.interDeptRecomputeAndMaybeActivate(treatyId, tx);

            return tx.treaty.findUnique({ where: { id: treatyId }, select: INTER_DEPT_TREATY_SELECT });
        });
    }

    // ═════════════════════════════════════════════════════════════
    // LEAVE TREATY (LOCKED only)
    // ═════════════════════════════════════════════════════════════

    async leaveTreaty(treatyId: string, userId: string) {
        await this.assertInterDeptAccess(treatyId, userId);

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

        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, roomId: true },
        });
        if (!user) throw new NotFoundException('User not found');

        const participant = treaty.participants.find(
            p =>
                ((p.type === 'USER' && p.userId === userId) ||
                    (p.type === 'ROOM' && p.roomId === user.roomId)) &&
                p.status !== ParticipantStatus.REJECTED &&
                p.status !== ParticipantStatus.LEFT,
        );
        if (!participant) throw new ForbiddenException('You do not have an active participation to leave');

        return this.prisma.$transaction(async (tx) => {
            await tx.treatyParticipant.update({
                where: { id: participant.id },
                data: { status: ParticipantStatus.LEFT, respondedAt: new Date() },
            });
            await this.syncInterDeptTreatyChat(treatyId, tx);
            await this.interDeptRecomputeAndMaybeActivate(treatyId, tx);
            return tx.treaty.findUnique({ where: { id: treatyId }, select: INTER_DEPT_TREATY_SELECT });
        });
    }

    // ═════════════════════════════════════════════════════════════
    // AUTO-ACTIVATE: if all remaining participants ACCEPTED → ACTIVE
    // ═════════════════════════════════════════════════════════════

    private async interDeptRecomputeAndMaybeActivate(treatyId: string, tx: any) {
        const treaty = await tx.treaty.findUnique({
            where: { id: treatyId },
            select: { status: true },
        });
        if (!treaty || treaty.status !== TreatyStatus.LOCKED) return;

        const remaining = await tx.treatyParticipant.findMany({
            where: {
                treatyId,
                status: { notIn: [ParticipantStatus.REJECTED, ParticipantStatus.LEFT] },
            },
            select: { status: true },
        });

        if (remaining.length === 0) return;

        const allAccepted = remaining.every((p: any) => p.status === ParticipantStatus.ACCEPTED);
        if (allAccepted) {
            await tx.treaty.update({
                where: { id: treatyId },
                data: { status: TreatyStatus.ACTIVE },
            });
        }
    }

    // ═════════════════════════════════════════════════════════════
    // BREACH CASES
    // ═════════════════════════════════════════════════════════════

    async listBreaches(treatyId: string, userId: string) {
        await this.assertInterDeptAccess(treatyId, userId);

        return this.prisma.breachCase.findMany({
            where: { treatyId },
            select: {
                id: true, status: true, title: true, description: true, createdAt: true,
                filer: { select: { id: true, username: true } },
                accusedUser: { select: { id: true, username: true } },
                chatRoom: { select: { id: true, closedAt: true } },
                clauses: { select: { clause: { select: { id: true, content: true } } } },
                evaluatedAt: true,
                ruledAt: true,
                ruledBy: { select: { id: true, username: true } },
                rulingType: true,
                penaltyMode: true,
                socialPenalty: true,
                creditFine: true,
                resolutionNote: true,
                resolvedAt: true,
                breachVerdicts: {
                    select: {
                        id: true, status: true, ruledAgainst: true, creditFine: true,
                        socialPenalty: true, penaltyMode: true, notes: true, createdAt: true, finalizedAt: true,
                        proposedBy: { select: { id: true, username: true } },
                        votes: {
                            select: {
                                id: true, vote: true, comment: true, createdAt: true,
                                voterUser: { select: { id: true, username: true } },
                                voterDepartment: { select: { id: true, name: true } },
                            },
                        },
                    },
                    orderBy: { createdAt: 'desc' },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async createBreach(treatyId: string, userId: string, dto: CreateInterDeptBreachCaseDto) {
        await this.assertInterDeptAccess(treatyId, userId);

        const treaty = await this.prisma.treaty.findUnique({
            where: { id: treatyId },
            select: {
                id: true, hostForeignMinisterId: true,
                treatyDepartments: {
                    where: { status: TreatyDepartmentStatus.ACCEPTED },
                    select: { department: { select: { id: true, foreignMinisterId: true } } },
                },
            },
        });
        if (!treaty) throw new NotFoundException('Treaty not found');

        return this.prisma.$transaction(async (tx) => {
            const breachCase = await tx.breachCase.create({
                data: {
                    treatyId,
                    filerId: userId,
                    accusedUserId: dto.accusedUserId,
                    title: dto.title,
                    description: dto.description,
                    exchangeId: dto.exchangeId,
                    status: BreachCaseStatus.OPEN,
                    clauses: dto.clauseIds.length > 0
                        ? { create: dto.clauseIds.map(clauseId => ({ clauseId })) }
                        : undefined,
                },
            });

            // Create breach chat room
            const memberIds = new Set<string>();
            if (treaty.hostForeignMinisterId) memberIds.add(treaty.hostForeignMinisterId);
            for (const td of treaty.treatyDepartments) {
                if (td.department.foreignMinisterId) memberIds.add(td.department.foreignMinisterId);
            }
            memberIds.add(userId); // filer
            memberIds.add(dto.accusedUserId); // accused

            await tx.chatRoom.create({
                data: {
                    type: 'BREACH_CASE',
                    breachCaseId: breachCase.id,
                    members: { create: [...memberIds].map(uid => ({ userId: uid })) },
                },
            });

            // Set to IN_REVIEW
            await tx.breachCase.update({
                where: { id: breachCase.id },
                data: { status: BreachCaseStatus.IN_REVIEW, evaluatedAt: new Date() },
            });

            return tx.breachCase.findUnique({
                where: { id: breachCase.id },
                select: {
                    id: true, status: true, title: true, description: true, createdAt: true,
                    filer: { select: { id: true, username: true } },
                    accusedUser: { select: { id: true, username: true } },
                    chatRoom: { select: { id: true, closedAt: true } },
                },
            });
        });
    }

    // ═════════════════════════════════════════════════════════════
    // BREACH VERDICTS
    // ═════════════════════════════════════════════════════════════

    async proposeVerdict(treatyId: string, breachCaseId: string, userId: string, dto: ProposeVerdictDto) {
        await this.assertHostFM(treatyId, userId);

        const breachCase = await this.prisma.breachCase.findFirst({
            where: { id: breachCaseId, treatyId },
        });
        if (!breachCase) throw new NotFoundException('Breach case not found');
        if (breachCase.status === BreachCaseStatus.RESOLVED) {
            throw new BadRequestException('Breach case is already resolved');
        }

        return this.prisma.$transaction(async (tx) => {
            // Mark any existing PROPOSED verdicts as REJECTED
            await tx.breachVerdict.updateMany({
                where: { breachCaseId, status: BreachVerdictStatus.PROPOSED },
                data: { status: BreachVerdictStatus.REJECTED },
            });

            return tx.breachVerdict.create({
                data: {
                    breachCaseId,
                    treatyId,
                    proposedById: userId,
                    ruledAgainst: dto.ruledAgainst,
                    creditFine: dto.creditFine,
                    socialPenalty: dto.socialPenalty,
                    penaltyMode: dto.penaltyMode,
                    notes: dto.notes,
                    status: BreachVerdictStatus.PROPOSED,
                },
                select: {
                    id: true, status: true, ruledAgainst: true, creditFine: true,
                    socialPenalty: true, penaltyMode: true, notes: true, createdAt: true,
                    proposedBy: { select: { id: true, username: true } },
                },
            });
        });
    }

    async voteVerdict(verdictId: string, userId: string, dto: VoteVerdictDto) {
        const verdict = await this.prisma.breachVerdict.findUnique({
            where: { id: verdictId },
            select: {
                id: true, status: true, treatyId: true, breachCaseId: true,
                treaty: {
                    select: {
                        hostForeignMinisterId: true,
                        treatyDepartments: {
                            where: { status: TreatyDepartmentStatus.ACCEPTED },
                            select: { department: { select: { id: true, foreignMinisterId: true } } },
                        },
                    },
                },
            },
        });
        if (!verdict) throw new NotFoundException('Verdict not found');
        if (verdict.status !== BreachVerdictStatus.PROPOSED) {
            throw new BadRequestException('This verdict is no longer open for voting');
        }

        // Must be FM of an ACCEPTED dept
        const voterDept = await this.prisma.department.findFirst({
            where: {
                foreignMinisterId: userId,
                id: { in: verdict.treaty.treatyDepartments.map(td => td.department.id) },
            },
        });
        if (!voterDept) throw new ForbiddenException('Only foreign ministers of accepted departments can vote');

        // Upsert vote
        await this.prisma.breachVerdictVote.upsert({
            where: { verdictId_voterUserId: { verdictId, voterUserId: userId } },
            update: { vote: dto.vote, comment: dto.comment },
            create: {
                verdictId,
                voterUserId: userId,
                voterDepartmentId: voterDept.id,
                vote: dto.vote,
                comment: dto.comment,
            },
        });

        // Check if we can finalize
        await this.tryFinalizeVerdict(verdictId);

        // Return updated verdict with votes
        return this.prisma.breachVerdict.findUnique({
            where: { id: verdictId },
            select: {
                id: true, status: true, ruledAgainst: true, creditFine: true,
                socialPenalty: true, penaltyMode: true, notes: true, createdAt: true, finalizedAt: true,
                proposedBy: { select: { id: true, username: true } },
                votes: {
                    select: {
                        id: true, vote: true, comment: true, createdAt: true,
                        voterUser: { select: { id: true, username: true } },
                        voterDepartment: { select: { id: true, name: true } },
                    },
                },
            },
        });
    }

    private async tryFinalizeVerdict(verdictId: string) {
        const verdict = await this.prisma.breachVerdict.findUnique({
            where: { id: verdictId },
            select: {
                id: true, status: true, breachCaseId: true, treatyId: true,
                ruledAgainst: true, creditFine: true, socialPenalty: true, penaltyMode: true,
                votes: { select: { vote: true, voterUserId: true } },
                treaty: {
                    select: {
                        hostForeignMinisterId: true,
                        departmentId: true,
                        treatyDepartments: {
                            where: { status: TreatyDepartmentStatus.ACCEPTED },
                            select: { departmentId: true },
                        },
                    },
                },
                breachCase: {
                    select: {
                        accusedUserId: true,
                        filerId: true,
                    },
                },
            },
        });
        if (!verdict || verdict.status !== BreachVerdictStatus.PROPOSED) return;

        const acceptedDeptCount = verdict.treaty.treatyDepartments.length;
        const totalVotes = verdict.votes.length;

        // Quorum: if more than 1 accepted dept, require at least 2 votes
        if (acceptedDeptCount > 1 && totalVotes < 2) return;
        if (totalVotes === 0) return;

        const yesCount = verdict.votes.filter(v => v.vote === VoteAction.ACCEPT).length;
        const noCount = verdict.votes.filter(v => v.vote === VoteAction.REJECT).length;

        let finalStatus: BreachVerdictStatus;
        if (yesCount > noCount) {
            finalStatus = BreachVerdictStatus.ACCEPTED;
        } else if (noCount > yesCount) {
            finalStatus = BreachVerdictStatus.REJECTED;
        } else {
            // Tie-break: host FM vote
            const hostVote = verdict.votes.find(v => v.voterUserId === verdict.treaty.hostForeignMinisterId);
            if (hostVote?.vote === VoteAction.ACCEPT) {
                finalStatus = BreachVerdictStatus.ACCEPTED;
            } else {
                finalStatus = BreachVerdictStatus.REJECTED;
            }
        }

        await this.prisma.$transaction(async (tx) => {
            await tx.breachVerdict.update({
                where: { id: verdictId },
                data: { status: finalStatus, finalizedAt: new Date() },
            });

            if (finalStatus === BreachVerdictStatus.ACCEPTED) {
                await this.applyAcceptedVerdict(verdict, tx);
            }
        });
    }

    private async applyAcceptedVerdict(verdict: any, tx: any) {
        const { breachCaseId, ruledAgainst, creditFine, socialPenalty, penaltyMode } = verdict;
        const { accusedUserId, filerId } = verdict.breachCase;
        const hostDeptId = verdict.treaty.departmentId;
        const hostFmId = verdict.treaty.hostForeignMinisterId;

        // Determine who gets punished
        let targetUserId: string | null = null;
        if (ruledAgainst === 'ACCUSED') targetUserId = accusedUserId;
        else if (ruledAgainst === 'ACCUSER') targetUserId = filerId;

        if (targetUserId && (creditFine > 0 || socialPenalty > 0)) {
            const isBothMandatory = penaltyMode === 'BOTH_MANDATORY';

            if (isBothMandatory) {
                // Apply both penalties
                if (socialPenalty > 0) {
                    await tx.user.update({
                        where: { id: targetUserId },
                        data: { socialScore: { decrement: socialPenalty } },
                    });
                }
                if (creditFine > 0) {
                    await tx.user.update({
                        where: { id: targetUserId },
                        data: { credits: { decrement: creditFine } },
                    });
                    // Credit host department treasury
                    await tx.department.update({
                        where: { id: hostDeptId },
                        data: { treasuryCredits: { increment: creditFine } },
                    });
                    // Log treasury transaction
                    await tx.treasuryTransaction.create({
                        data: {
                            type: 'BREACH_FINE_INCOME',
                            amount: creditFine,
                            departmentId: hostDeptId,
                            breachCaseId,
                            createdById: hostFmId,
                            note: `Inter-dept breach fine for case ${breachCaseId}`,
                        },
                    });
                }
            } else {
                // EITHER_CHOICE: store the ruling, let the criminal choose via existing flow
                // For simplicity, apply both for now (inter-dept doesn't have await-criminal-choice UI yet)
                if (socialPenalty > 0) {
                    await tx.user.update({
                        where: { id: targetUserId },
                        data: { socialScore: { decrement: socialPenalty } },
                    });
                }
                if (creditFine > 0) {
                    await tx.user.update({
                        where: { id: targetUserId },
                        data: { credits: { decrement: creditFine } },
                    });
                    await tx.department.update({
                        where: { id: hostDeptId },
                        data: { treasuryCredits: { increment: creditFine } },
                    });
                    await tx.treasuryTransaction.create({
                        data: {
                            type: 'BREACH_FINE_INCOME',
                            amount: creditFine,
                            departmentId: hostDeptId,
                            breachCaseId,
                            createdById: hostFmId,
                            note: `Inter-dept breach fine for case ${breachCaseId}`,
                        },
                    });
                }
            }

            // Check jail after penalty
            await checkAndApplyJailStatus(tx, targetUserId);
        }

        // Close breach chat room
        const breachChat = await tx.chatRoom.findFirst({ where: { breachCaseId } });
        if (breachChat) {
            await tx.chatRoom.update({
                where: { id: breachChat.id },
                data: { closedAt: new Date() },
            });
        }

        // Resolve breach case
        await tx.breachCase.update({
            where: { id: breachCaseId },
            data: {
                status: BreachCaseStatus.RESOLVED,
                ruledAt: new Date(),
                ruledById: hostFmId,
                rulingType: ruledAgainst === 'ACCUSED' ? 'AGAINST_ACCUSED' : ruledAgainst === 'ACCUSER' ? 'AGAINST_ACCUSER' : 'NONE',
                rulingTargetUserId: targetUserId,
                penaltyMode: penaltyMode === 'BOTH_MANDATORY' ? 'BOTH_MANDATORY' : 'EITHER_CHOICE',
                socialPenalty,
                creditFine,
                resolvedAt: new Date(),
                resolvedById: hostFmId,
                resolutionNote: `Verdict accepted by FM vote`,
            },
        });
    }

    // ═════════════════════════════════════════════════════════════
    // BREACH CHAT
    // ═════════════════════════════════════════════════════════════

    async getBreachChatMessages(treatyId: string, breachCaseId: string, userId: string, limit = 50, cursor?: string) {
        await this.assertInterDeptAccess(treatyId, userId);

        const breach = await this.prisma.breachCase.findFirst({
            where: { id: breachCaseId, treatyId },
            select: { chatRoom: { select: { id: true, closedAt: true } } },
        });
        if (!breach?.chatRoom) throw new NotFoundException('Breach chat not found');

        const where: any = { chatRoomId: breach.chatRoom.id, deletedAt: null };
        if (cursor) where.createdAt = { lt: new Date(cursor) };

        const messages = await this.prisma.chatMessage.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limit,
            select: {
                id: true, content: true, createdAt: true, chatRoomId: true,
                sender: { select: { id: true, username: true, role: true } },
            },
        });

        return {
            chatRoomId: breach.chatRoom.id,
            closed: !!breach.chatRoom.closedAt,
            items: messages.reverse(),
            nextCursor: messages.length === limit ? messages[0]?.createdAt?.toISOString() ?? null : null,
        };
    }

    async sendBreachChatMessage(treatyId: string, breachCaseId: string, userId: string, content: string) {
        await this.assertInterDeptAccess(treatyId, userId);

        const breach = await this.prisma.breachCase.findFirst({
            where: { id: breachCaseId, treatyId },
            select: { chatRoom: { select: { id: true, closedAt: true } } },
        });
        if (!breach?.chatRoom) throw new NotFoundException('Breach chat not found');
        if (breach.chatRoom.closedAt) throw new BadRequestException('Chat is closed');

        await this.prisma.chatRoomMember.upsert({
            where: { chatRoomId_userId: { chatRoomId: breach.chatRoom.id, userId } },
            update: {},
            create: { chatRoomId: breach.chatRoom.id, userId },
        });

        return this.prisma.chatMessage.create({
            data: { chatRoomId: breach.chatRoom.id, senderId: userId, content },
            select: {
                id: true, content: true, createdAt: true, chatRoomId: true,
                sender: { select: { id: true, username: true, role: true } },
            },
        });
    }

    // ═════════════════════════════════════════════════════════════
    // LIST DEPARTMENTS (for invite UI)
    // ═════════════════════════════════════════════════════════════

    async listDepartments() {
        return this.prisma.department.findMany({
            select: {
                id: true,
                name: true,
                foreignMinister: { select: { id: true, username: true } },
            },
            orderBy: { name: 'asc' },
        });
    }

    // ═════════════════════════════════════════════════════════════
    // LIST TREATY STAKEHOLDERS (for breach accused dropdown)
    // ═════════════════════════════════════════════════════════════

    async listStakeholders(treatyId: string, userId: string) {
        await this.assertInterDeptAccess(treatyId, userId);

        const treaty = await this.prisma.treaty.findUnique({
            where: { id: treatyId },
            select: {
                hostForeignMinisterId: true,
                treatyDepartments: {
                    where: { status: TreatyDepartmentStatus.ACCEPTED },
                    select: { department: { select: { foreignMinisterId: true } } },
                },
                participants: {
                    where: { status: { notIn: [ParticipantStatus.REJECTED, ParticipantStatus.LEFT] } },
                    select: { type: true, roomId: true, userId: true },
                },
            },
        });
        if (!treaty) throw new NotFoundException('Treaty not found');

        const userIds = new Set<string>();

        // Host FM
        if (treaty.hostForeignMinisterId) userIds.add(treaty.hostForeignMinisterId);

        // FMs of accepted departments
        for (const td of treaty.treatyDepartments) {
            if (td.department.foreignMinisterId) userIds.add(td.department.foreignMinisterId);
        }

        // Direct participants
        for (const p of treaty.participants) {
            if (p.type === 'USER' && p.userId) userIds.add(p.userId);
            if (p.type === 'ROOM' && p.roomId) {
                const roomUsers = await this.prisma.user.findMany({
                    where: { roomId: p.roomId },
                    select: { id: true },
                });
                roomUsers.forEach(u => userIds.add(u.id));
            }
        }

        // Fetch full user info
        return this.prisma.user.findMany({
            where: { id: { in: [...userIds] } },
            select: { id: true, username: true, email: true },
            orderBy: { username: 'asc' },
        });
    }
}
