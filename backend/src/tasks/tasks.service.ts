import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TaskStatus } from '@prisma/client';
import { CreateTaskDto } from './dto/create-task.dto';
import { ApproveAssignTaskDto } from './dto/approve-assign-task.dto';
import { CompleteTaskDto } from './dto/complete-task.dto';
import { ReviewTaskDto } from './dto/review-task.dto';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) { }

  // --- helpers ---
  private async getUserWithRoom(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, roomId: true, role: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  private async assertMayorOfRoom(roomId: string, userId: string) {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      select: { id: true, mayorId: true },
    });
    if (!room) throw new NotFoundException('Room not found');
    if (room.mayorId !== userId) throw new ForbiddenException('Only this room mayor can do this');
    return room;
  }

  // 1) Citizen (or mayor) creates task -> pending approval
  async create(dto: CreateTaskDto, currentUserId: string) {
    const me = await this.getUserWithRoom(currentUserId);

    return this.prisma.task.create({
      data: {
        title: dto.title,
        description: dto.description,
        roomId: me.roomId,
        createdById: me.id,
        status: TaskStatus.PENDING_APPROVAL,
      },
    });
  }

  // List tasks visible to current user:
  // - mayor: tasks of their own room (as mayor)
  // - citizen: tasks of their room + tasks assigned to them (same room anyway)
  async findAll(currentUserId: string, filters?: { status?: TaskStatus; myOnly?: boolean }) {
    const me = await this.getUserWithRoom(currentUserId);

    const where: any = { roomId: me.roomId };

    if (filters?.status) where.status = filters.status;
    if (filters?.myOnly) where.assignedToId = currentUserId;

    return this.prisma.task.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        createdAt: true,
        updatedAt: true,

        completionSummary: true,
        completedAt: true,
        mayorReviewNote: true,
        reviewedAt: true,

        createdBy: { select: { id: true, username: true, role: true } },
        assignedTo: { select: { id: true, username: true, role: true } },
      },
    });
  }


  async findOne(taskId: string, currentUserId: string) {
    const me = await this.getUserWithRoom(currentUserId);

    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { createdBy: true, assignedTo: true, room: true },
    });
    if (!task) throw new NotFoundException('Task not found');

    // Must be same room (so other mayors can't see it)
    if (task.roomId !== me.roomId) throw new ForbiddenException('Not allowed');

    return task;
  }

  // 2) Mayor approves + assigns -> ACTIVE
  async approveAndAssign(taskId: string, dto: ApproveAssignTaskDto, currentUserId: string) {
    const me = await this.getUserWithRoom(currentUserId);

    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');

    // ensure same room + mayor of that room
    if (task.roomId !== me.roomId) throw new ForbiddenException('Not allowed');
    await this.assertMayorOfRoom(task.roomId, currentUserId);

    if (task.status !== TaskStatus.PENDING_APPROVAL) {
      throw new ForbiddenException('Task is not pending approval');
    }

    // assigned user must be from same room
    const assignee = await this.prisma.user.findUnique({
      where: { id: dto.assignedToId },
      select: { id: true, roomId: true },
    });
    if (!assignee) throw new NotFoundException('Assignee not found');
    if (assignee.roomId !== task.roomId) throw new ForbiddenException('Assignee must be from same room');

    return this.prisma.task.update({
      where: { id: taskId },
      data: {
        assignedToId: dto.assignedToId,
        status: TaskStatus.ACTIVE,
        mayorReviewNote: null,
        reviewedAt: null,
      },
    });
  }

  // 3) Assigned user completes -> AWAITING_REVIEW
  async complete(taskId: string, dto: CompleteTaskDto, currentUserId: string) {
    const me = await this.getUserWithRoom(currentUserId);

    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');

    // must be same room
    if (task.roomId !== me.roomId) throw new ForbiddenException('Not allowed');

    // must be assigned to current user
    if (task.assignedToId !== currentUserId) {
      throw new ForbiddenException('Only the assigned user can complete this task');
    }

    if (task.status !== TaskStatus.ACTIVE) {
      throw new ForbiddenException('Task is not active');
    }

    return this.prisma.task.update({
      where: { id: taskId },
      data: {
        completionSummary: dto.completionSummary,
        completedAt: new Date(),
        status: TaskStatus.AWAITING_REVIEW,
      },
    });
  }

  // 4) Mayor reviews -> COMPLETED or back to ACTIVE
  async review(taskId: string, dto: ReviewTaskDto, currentUserId: string) {
    const me = await this.getUserWithRoom(currentUserId);

    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');

    // same room + mayor only
    if (task.roomId !== me.roomId) throw new ForbiddenException('Not allowed');
    await this.assertMayorOfRoom(task.roomId, currentUserId);

    if (task.status !== TaskStatus.AWAITING_REVIEW) {
      throw new ForbiddenException('Task is not awaiting review');
    }

    return this.prisma.task.update({
      where: { id: taskId },
      data: {
        mayorReviewNote: dto.note ?? null,
        reviewedAt: new Date(),
        status: dto.accept ? TaskStatus.COMPLETED : TaskStatus.ACTIVE,
      },
    });
  }
}
