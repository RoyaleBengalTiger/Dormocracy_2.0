import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoomElectionDto } from './dto/create-room-election.dto';
import { CreateDeptElectionDto } from './dto/create-dept-election.dto';
import { CastVoteDto } from './dto/cast-vote.dto';
import { ResolveTieDto } from './dto/resolve-tie.dto';
import { AssignMinistersDto } from './dto/assign-ministers.dto';

const ELECTION_INCLUDE = {
    room: {
        select: {
            id: true,
            roomNumber: true,
            departmentId: true,
            department: { select: { id: true, name: true } },
        },
    },
    department: { select: { id: true, name: true } },
    winner: { select: { id: true, username: true } },
    candidates: {
        include: {
            user: { select: { id: true, username: true, socialScore: true } },
        },
        orderBy: { totalVotePower: 'desc' as const },
    },
    votes: {
        include: {
            voter: { select: { id: true, username: true } },
            candidate: {
                include: {
                    user: { select: { id: true, username: true } },
                },
            },
        },
    },
} as const;

@Injectable()
export class ElectionsService {
    constructor(private readonly prisma: PrismaService) { }

    // ─── Create Room Election ──────────────────────────────────────

    async createRoomElection(dto: CreateRoomElectionDto) {
        const room = await this.prisma.room.findUnique({
            where: { id: dto.roomId },
            include: {
                users: { select: { id: true, username: true, socialScore: true, isJailed: true } },
                department: { select: { id: true, name: true } },
            },
        });
        if (!room) throw new NotFoundException('Room not found');

        if (room.users.length === 0) {
            throw new BadRequestException('Room has no members');
        }

        // Check for active election in this room
        const activeElection = await this.prisma.election.findFirst({
            where: {
                roomId: dto.roomId,
                status: { in: ['ACTIVE', 'TIE_BREAKING'] },
            },
        });
        if (activeElection) {
            throw new BadRequestException(
                'There is already an active election for this room',
            );
        }

        const deadline = new Date(dto.deadline);
        if (deadline <= new Date()) {
            throw new BadRequestException('Deadline must be in the future');
        }

        // ── Strip roles from the current mayor ──────────────────────
        if (room.mayorId) {
            const oldMayorId = room.mayorId;
            const stripOps: any[] = [
                // Remove mayor from room
                this.prisma.room.update({
                    where: { id: dto.roomId },
                    data: { mayorId: null },
                }),
                // Demote old mayor to CITIZEN
                this.prisma.user.update({
                    where: { id: oldMayorId },
                    data: { role: 'CITIZEN' },
                }),
            ];

            // If old mayor was PM / FM / Finance Minister of the dept, clear those too
            const dept = await this.prisma.department.findUnique({
                where: { id: room.departmentId },
            });
            if (dept) {
                const deptUpdate: any = {};
                if (dept.primeMinisterId === oldMayorId) deptUpdate.primeMinisterId = null;
                if (dept.foreignMinisterId === oldMayorId) deptUpdate.foreignMinisterId = null;
                if (dept.financeMinisterId === oldMayorId) deptUpdate.financeMinisterId = null;
                if (Object.keys(deptUpdate).length > 0) {
                    stripOps.push(
                        this.prisma.department.update({
                            where: { id: room.departmentId },
                            data: deptUpdate,
                        }),
                    );
                }
            }

            await this.prisma.$transaction(stripOps);

            // Sync senate chat after role changes
            await this.syncSenateChatRoom(room.departmentId);
        }

        // Create election with all non-jailed room members as candidates
        const eligibleUsers = room.users.filter((u) => !u.isJailed);
        if (eligibleUsers.length === 0) {
            throw new BadRequestException('No eligible (non-jailed) candidates in this room');
        }

        return this.prisma.election.create({
            data: {
                type: 'ROOM',
                roomId: dto.roomId,
                departmentId: room.departmentId,
                deadline,
                candidates: {
                    create: eligibleUsers.map((u) => ({
                        userId: u.id,
                        totalVotePower: 0,
                    })),
                },
            },
            include: ELECTION_INCLUDE,
        });
    }

    // ─── Create Department Election ────────────────────────────────

    async createDeptElection(dto: CreateDeptElectionDto) {
        const dept = await this.prisma.department.findUnique({
            where: { id: dto.departmentId },
            include: {
                rooms: {
                    include: {
                        mayor: { select: { id: true, username: true, socialScore: true } },
                        users: { select: { id: true, socialScore: true } },
                    },
                },
            },
        });
        if (!dept) throw new NotFoundException('Department not found');

        // Ensure ALL rooms have mayors
        const roomsWithoutMayor = dept.rooms.filter((r) => !r.mayorId);
        if (roomsWithoutMayor.length > 0) {
            throw new BadRequestException(
                `Not all rooms have mayors. Rooms without mayor: ${roomsWithoutMayor.map((r) => r.roomNumber).join(', ')}`,
            );
        }

        // Check for active election in this dept
        const activeElection = await this.prisma.election.findFirst({
            where: {
                departmentId: dto.departmentId,
                type: 'DEPARTMENT',
                status: { in: ['ACTIVE', 'TIE_BREAKING'] },
            },
        });
        if (activeElection) {
            throw new BadRequestException(
                'There is already an active department election',
            );
        }

        const deadline = new Date(dto.deadline);
        if (deadline <= new Date()) {
            throw new BadRequestException('Deadline must be in the future');
        }

        // Candidates = all mayors of this dept
        const mayors = dept.rooms
            .filter((r) => r.mayor)
            .map((r) => r.mayor!);

        if (mayors.length === 0) {
            throw new BadRequestException('No mayors found');
        }

        // ── Strip PM, FM, Finance Minister roles ────────────────────
        const stripOps: any[] = [];
        const deptClear: any = {};

        if (dept.primeMinisterId) {
            stripOps.push(
                this.prisma.user.update({
                    where: { id: dept.primeMinisterId },
                    data: { role: 'MAYOR' }, // PM is a mayor, demote back to MAYOR
                }),
            );
            deptClear.primeMinisterId = null;
        }
        if (dept.foreignMinisterId) {
            // FM is also a mayor, so just set back to MAYOR
            stripOps.push(
                this.prisma.user.update({
                    where: { id: dept.foreignMinisterId },
                    data: { role: 'MAYOR' },
                }),
            );
            deptClear.foreignMinisterId = null;
        }
        if (dept.financeMinisterId) {
            stripOps.push(
                this.prisma.user.update({
                    where: { id: dept.financeMinisterId },
                    data: { role: 'MAYOR' },
                }),
            );
            deptClear.financeMinisterId = null;
        }

        if (Object.keys(deptClear).length > 0) {
            stripOps.push(
                this.prisma.department.update({
                    where: { id: dto.departmentId },
                    data: deptClear,
                }),
            );
        }

        if (stripOps.length > 0) {
            await this.prisma.$transaction(stripOps);
        }

        const election = await this.prisma.election.create({
            data: {
                type: 'DEPARTMENT',
                departmentId: dto.departmentId,
                deadline,
                candidates: {
                    create: mayors.map((m) => ({
                        userId: m.id,
                    })),
                },
            },
            include: ELECTION_INCLUDE,
        });

        return election;
    }

    // ─── Cast Vote ─────────────────────────────────────────────────

    async castVote(electionId: string, voterId: string, dto: CastVoteDto) {
        const election = await this.prisma.election.findUnique({
            where: { id: electionId },
            include: {
                room: {
                    include: {
                        users: { select: { id: true, socialScore: true } },
                    },
                },
                department: {
                    include: {
                        rooms: {
                            include: {
                                users: { select: { id: true, socialScore: true } },
                            },
                        },
                    },
                },
                candidates: true,
                votes: true,
            },
        });
        if (!election) throw new NotFoundException('Election not found');

        if (election.status !== 'ACTIVE') {
            throw new BadRequestException('Election is not active');
        }

        // Check if deadline has passed
        if (new Date() > election.deadline) {
            // Auto-finalize
            return this.finalizeElection(electionId);
        }

        // Check voter eligibility
        const voter = await this.prisma.user.findUnique({
            where: { id: voterId },
            select: { id: true, roomId: true, socialScore: true, isJailed: true },
        });
        if (!voter) throw new NotFoundException('Voter not found');

        if (voter.isJailed) {
            throw new ForbiddenException('Jailed users cannot vote');
        }

        if (election.type === 'ROOM') {
            // Voter must be a member of the room
            if (!election.room || voter.roomId !== election.room.id) {
                throw new ForbiddenException(
                    'You are not a member of this room',
                );
            }
        } else {
            // DEPARTMENT: voter must be a mayor of a room in this dept
            if (!election.department) {
                throw new BadRequestException('Election department not found');
            }
            const isCandidate = election.candidates.some(
                (c) => c.userId === voterId,
            );
            if (!isCandidate) {
                throw new ForbiddenException(
                    'Only mayors of this department can vote in department elections',
                );
            }
        }

        // Check if already voted
        const existingVote = election.votes.find((v) => v.voterId === voterId);
        if (existingVote) {
            throw new BadRequestException('You have already voted in this election');
        }

        // Validate candidate
        const candidate = election.candidates.find(
            (c) => c.id === dto.candidateId,
        );
        if (!candidate) {
            throw new BadRequestException('Invalid candidate');
        }

        // Calculate vote power
        let votePower: number;
        if (election.type === 'ROOM') {
            votePower = voter.socialScore;
        } else {
            // DEPARTMENT: mayor's vote power = sum of all room members' socialScores
            const mayorsRoom = election.department!.rooms.find(
                (r) => r.mayorId === voterId,
            );
            if (!mayorsRoom) {
                throw new ForbiddenException('You are not a mayor in this department');
            }
            votePower = mayorsRoom.users.reduce(
                (sum, u) => sum + u.socialScore,
                0,
            );
        }

        // Record vote and update candidate tally
        await this.prisma.$transaction([
            this.prisma.electionVote.create({
                data: {
                    electionId,
                    voterId,
                    candidateId: dto.candidateId,
                    votePower,
                },
            }),
            this.prisma.electionCandidate.update({
                where: { id: dto.candidateId },
                data: { totalVotePower: { increment: votePower } },
            }),
        ]);

        // Check if all eligible (non-jailed) voters have now voted
        const updatedVoteCount = election.votes.length + 1;
        let totalEligibleVoters: number;

        if (election.type === 'ROOM') {
            // Exclude jailed members from eligible voter count
            const nonJailedMembers = await this.prisma.user.count({
                where: { roomId: election.room!.id, isJailed: false },
            });
            totalEligibleVoters = nonJailedMembers;
        } else {
            totalEligibleVoters = election.candidates.length; // mayors (jailed mayors already stripped)
        }

        if (updatedVoteCount >= totalEligibleVoters) {
            return this.finalizeElection(electionId);
        }

        // Return updated election
        return this.prisma.election.findUnique({
            where: { id: electionId },
            include: ELECTION_INCLUDE,
        });
    }

    // ─── Finalize Election ─────────────────────────────────────────

    async finalizeElection(electionId: string) {
        const election = await this.prisma.election.findUnique({
            where: { id: electionId },
            include: {
                candidates: {
                    orderBy: { totalVotePower: 'desc' },
                    include: {
                        user: { select: { id: true, username: true } },
                    },
                },
                room: true,
                department: true,
            },
        });
        if (!election) throw new NotFoundException('Election not found');

        if (election.status !== 'ACTIVE') {
            // Already finalized, just return it
            return this.prisma.election.findUnique({
                where: { id: electionId },
                include: ELECTION_INCLUDE,
            });
        }

        const candidates = election.candidates;
        if (candidates.length === 0) {
            throw new BadRequestException('No candidates found');
        }

        const topVotePower = candidates[0].totalVotePower;
        const tiedCandidates = candidates.filter(
            (c) => c.totalVotePower === topVotePower,
        );

        if (tiedCandidates.length > 1) {
            // TIE — admin must resolve
            await this.prisma.election.update({
                where: { id: electionId },
                data: { status: 'TIE_BREAKING' },
            });

            return this.prisma.election.findUnique({
                where: { id: electionId },
                include: ELECTION_INCLUDE,
            });
        }

        // Clear winner
        const winnerId = candidates[0].userId;
        return this.applyWinner(electionId, winnerId);
    }

    // ─── Resolve Tie (Admin only) ──────────────────────────────────

    async resolveTie(electionId: string, dto: ResolveTieDto) {
        const election = await this.prisma.election.findUnique({
            where: { id: electionId },
            include: {
                candidates: {
                    orderBy: { totalVotePower: 'desc' },
                },
            },
        });
        if (!election) throw new NotFoundException('Election not found');

        if (election.status !== 'TIE_BREAKING') {
            throw new BadRequestException('Election is not in tie-breaking phase');
        }

        // Verify winnerId is among the tied candidates
        const topVotePower = election.candidates[0].totalVotePower;
        const tiedCandidates = election.candidates.filter(
            (c) => c.totalVotePower === topVotePower,
        );
        const validTiedUserIds = tiedCandidates.map((c) => c.userId);
        if (!validTiedUserIds.includes(dto.winnerId)) {
            throw new BadRequestException(
                'Selected winner is not among the tied candidates',
            );
        }

        return this.applyWinner(electionId, dto.winnerId);
    }

    // ─── Apply Winner ──────────────────────────────────────────────

    private async applyWinner(electionId: string, winnerId: string) {
        const election = await this.prisma.election.findUnique({
            where: { id: electionId },
            include: { room: true, department: { include: { rooms: true } } },
        });
        if (!election) throw new NotFoundException('Election not found');

        const operations: any[] = [];

        // Update election
        operations.push(
            this.prisma.election.update({
                where: { id: electionId },
                data: { status: 'COMPLETED', winnerId },
            }),
        );

        if (election.type === 'ROOM') {
            // Set room mayor
            operations.push(
                this.prisma.room.update({
                    where: { id: election.roomId! },
                    data: { mayorId: winnerId },
                }),
            );
            // Update user role to MAYOR
            operations.push(
                this.prisma.user.update({
                    where: { id: winnerId },
                    data: { role: 'MAYOR' },
                }),
            );
        } else {
            // DEPARTMENT: set PM
            operations.push(
                this.prisma.department.update({
                    where: { id: election.departmentId! },
                    data: { primeMinisterId: winnerId },
                }),
            );
            // Update user role to PM
            operations.push(
                this.prisma.user.update({
                    where: { id: winnerId },
                    data: { role: 'PM' },
                }),
            );
        }

        await this.prisma.$transaction(operations);

        // Sync senate chat to add the new mayor to the chat
        const deptId = election.type === 'ROOM'
            ? election.room?.departmentId
            : election.departmentId;
        if (deptId) {
            await this.syncSenateChatRoom(deptId);
        }

        return this.prisma.election.findUnique({
            where: { id: electionId },
            include: ELECTION_INCLUDE,
        });
    }

    // ─── Assign Ministers (PM only) ────────────────────────────────

    async assignMinisters(
        departmentId: string,
        pmUserId: string,
        dto: AssignMinistersDto,
    ) {
        // Verify the user is the PM of this department
        const dept = await this.prisma.department.findUnique({
            where: { id: departmentId },
            include: {
                rooms: {
                    select: { id: true, mayorId: true },
                },
            },
        });
        if (!dept) throw new NotFoundException('Department not found');
        if (dept.primeMinisterId !== pmUserId) {
            throw new ForbiddenException(
                'Only the Prime Minister can assign ministers',
            );
        }

        // Both must be mayors of this department
        const mayorIds = dept.rooms
            .filter((r) => r.mayorId)
            .map((r) => r.mayorId!);

        if (!mayorIds.includes(dto.foreignMinisterId)) {
            throw new BadRequestException(
                'Foreign Minister must be a mayor of this department',
            );
        }
        if (!mayorIds.includes(dto.financeMinisterId)) {
            throw new BadRequestException(
                'Finance Minister must be a mayor of this department',
            );
        }

        if (dto.foreignMinisterId === dto.financeMinisterId) {
            throw new BadRequestException(
                'Foreign Minister and Finance Minister must be different people',
            );
        }

        // Update department and user roles
        await this.prisma.$transaction([
            this.prisma.department.update({
                where: { id: departmentId },
                data: {
                    foreignMinisterId: dto.foreignMinisterId,
                    financeMinisterId: dto.financeMinisterId,
                },
            }),
            this.prisma.user.update({
                where: { id: dto.foreignMinisterId },
                data: { role: 'MINISTER' },
            }),
            this.prisma.user.update({
                where: { id: dto.financeMinisterId },
                data: { role: 'MINISTER' },
            }),
        ]);

        // Create or sync senate chat
        await this.syncSenateChatRoom(departmentId);

        return this.prisma.department.findUnique({
            where: { id: departmentId },
            include: {
                rooms: {
                    include: {
                        mayor: { select: { id: true, username: true } },
                    },
                },
                primeMinister: { select: { id: true, username: true } },
                foreignMinister: { select: { id: true, username: true } },
                financeMinister: { select: { id: true, username: true } },
            },
        });
    }

    // ─── Senate Chat ───────────────────────────────────────────────

    async syncSenateChatRoom(departmentId: string) {
        const dept = await this.prisma.department.findUnique({
            where: { id: departmentId },
            include: {
                rooms: { select: { mayorId: true } },
            },
        });
        if (!dept) throw new NotFoundException('Department not found');

        // Senate membership = all mayors of this department only
        const memberIds = new Set<string>();
        for (const room of dept.rooms) {
            if (room.mayorId) memberIds.add(room.mayorId);
        }

        // Get or create senate chat room
        let chatRoom = await this.prisma.chatRoom.findUnique({
            where: { departmentSenateId: departmentId },
            include: { members: true },
        });

        if (!chatRoom) {
            chatRoom = await this.prisma.chatRoom.create({
                data: {
                    type: 'SENATE',
                    departmentSenateId: departmentId,
                    members: {
                        create: Array.from(memberIds).map((userId) => ({
                            userId,
                        })),
                    },
                },
                include: { members: true },
            });
            return chatRoom;
        }

        // Sync members: remove old, add new
        const existingMemberIds = new Set(chatRoom.members.map((m) => m.userId));
        const toAdd = Array.from(memberIds).filter(
            (id) => !existingMemberIds.has(id),
        );
        const toRemove = chatRoom.members.filter(
            (m) => !memberIds.has(m.userId),
        );

        const operations: any[] = [];
        for (const id of toAdd) {
            operations.push(
                this.prisma.chatRoomMember.create({
                    data: { chatRoomId: chatRoom.id, userId: id },
                }),
            );
        }
        for (const m of toRemove) {
            operations.push(
                this.prisma.chatRoomMember.delete({ where: { id: m.id } }),
            );
        }
        if (operations.length > 0) {
            await this.prisma.$transaction(operations);
        }

        return this.prisma.chatRoom.findUnique({
            where: { id: chatRoom.id },
            include: { members: true },
        });
    }

    async getSenateChatRoom(departmentId: string, userId: string) {
        // Auto-create if not exists
        await this.syncSenateChatRoom(departmentId);

        const chatRoom = await this.prisma.chatRoom.findUnique({
            where: { departmentSenateId: departmentId },
            include: {
                members: {
                    include: {
                        user: { select: { id: true, username: true, role: true } },
                    },
                },
            },
        });
        if (!chatRoom) {
            throw new NotFoundException('Senate chat room not found.');
        }

        // Verify user is a mayor in this department OR an admin
        const userRecord = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { role: true },
        });
        const isAdmin = userRecord?.role === 'ADMIN';
        const isMayor = await this.prisma.room.findFirst({
            where: {
                departmentId,
                mayorId: userId,
            },
        });
        if (!isMayor && !isAdmin) {
            throw new ForbiddenException(
                'Only mayors of this department or admins can access the senate chat',
            );
        }

        return chatRoom;
    }

    async getSenateMessages(
        departmentId: string,
        userId: string,
        limit = 30,
        cursor?: string,
    ) {
        const chatRoom = await this.getSenateChatRoom(departmentId, userId);

        const messages = await this.prisma.chatMessage.findMany({
            where: {
                chatRoomId: chatRoom.id,
                deletedAt: null,
            },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: limit,
            ...(cursor
                ? {
                    cursor: { id: cursor },
                    skip: 1,
                }
                : {}),
            select: {
                id: true,
                content: true,
                createdAt: true,
                sender: { select: { id: true, username: true, role: true } },
            },
        });

        const nextCursor =
            messages.length > 0 ? messages[messages.length - 1].id : null;
        return { chatRoomId: chatRoom.id, items: messages, nextCursor };
    }

    async sendSenateMessage(
        departmentId: string,
        userId: string,
        content: string,
    ) {
        const chatRoom = await this.getSenateChatRoom(departmentId, userId);

        if (chatRoom.closedAt) {
            throw new BadRequestException('Senate chat is closed');
        }

        const msg = await this.prisma.chatMessage.create({
            data: {
                chatRoomId: chatRoom.id,
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

        return { chatRoomId: chatRoom.id, message: msg };
    }

    // ─── List & Get ────────────────────────────────────────────────

    async listElections(query: {
        roomId?: string;
        departmentId?: string;
        status?: string;
    }) {
        const where: any = {};
        if (query.roomId) where.roomId = query.roomId;
        if (query.departmentId) where.departmentId = query.departmentId;
        if (query.status) where.status = query.status;

        return this.prisma.election.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: ELECTION_INCLUDE,
        });
    }

    async getElection(id: string) {
        const election = await this.prisma.election.findUnique({
            where: { id },
            include: ELECTION_INCLUDE,
        });
        if (!election) throw new NotFoundException('Election not found');
        return election;
    }

    // ─── Check & Auto-Finalize Deadline ────────────────────────────

    async checkAndFinalizeIfNeeded(electionId: string) {
        const election = await this.prisma.election.findUnique({
            where: { id: electionId },
        });
        if (!election) throw new NotFoundException('Election not found');

        if (
            election.status === 'ACTIVE' &&
            new Date() > election.deadline
        ) {
            return this.finalizeElection(electionId);
        }

        return this.getElection(electionId);
    }
}
