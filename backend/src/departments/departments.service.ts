import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { UpdateDepartmentLeadershipDto } from './dto/update-department-leadership.dto';

/** Shared include for department queries — rooms (with users) + leadership. */
const DEPARTMENT_INCLUDE = {
  rooms: {
    include: {
      users: {
        select: { id: true, username: true, email: true, role: true },
      },
    },
  },
  primeMinister: { select: { id: true, username: true, email: true } },
  foreignMinister: { select: { id: true, username: true, email: true } },
  financeMinister: { select: { id: true, username: true, email: true } },
} as const;

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) { }

  async create(dto: CreateDepartmentDto) {
    try {
      return await this.prisma.department.create({ data: dto });
    } catch (e: any) {
      if (e?.code === 'P2002')
        throw new ConflictException('Department name already exists');
      throw e;
    }
  }

  async findAll() {
    return this.prisma.department.findMany({
      orderBy: { createdAt: 'desc' },
      include: DEPARTMENT_INCLUDE,
    });
  }

  async findOne(id: string) {
    const dept = await this.prisma.department.findUnique({
      where: { id },
      include: DEPARTMENT_INCLUDE,
    });
    if (!dept) throw new NotFoundException('Department not found');
    return dept;
  }

  async update(id: string, dto: UpdateDepartmentDto) {
    try {
      return await this.prisma.department.update({
        where: { id },
        data: dto,
      });
    } catch (e: any) {
      if (e?.code === 'P2025')
        throw new NotFoundException('Department not found');
      if (e?.code === 'P2002')
        throw new ConflictException('Department name already exists');
      throw e;
    }
  }

  async remove(id: string) {
    try {
      return await this.prisma.department.delete({ where: { id } });
    } catch (e: any) {
      if (e?.code === 'P2025')
        throw new NotFoundException('Department not found');
      throw e;
    }
  }

  // ─── Leadership assignment ────────────────────────────────────

  /**
   * Assign or unassign Prime Minister / Foreign Minister for a department.
   *
   * Validation:
   *  - Department must exist
   *  - Each provided user must exist AND belong to the department
   *    (user.room.departmentId === department.id)
   */
  async updateLeadership(id: string, dto: UpdateDepartmentLeadershipDto) {
    const dept = await this.prisma.department.findUnique({
      where: { id },
      include: { rooms: { select: { id: true } } },
    });
    if (!dept) throw new NotFoundException('Department not found');

    const roomIds = new Set(dept.rooms.map((r) => r.id));

    // Build the data object only for provided keys
    const data: Record<string, string | null> = {};

    if (dto.primeMinisterId !== undefined) {
      if (dto.primeMinisterId === null) {
        data.primeMinisterId = null;
      } else {
        await this.validateUserInDepartment(
          dto.primeMinisterId,
          roomIds,
          'Prime Minister',
        );
        data.primeMinisterId = dto.primeMinisterId;
      }
    }

    if (dto.foreignMinisterId !== undefined) {
      if (dto.foreignMinisterId === null) {
        data.foreignMinisterId = null;
      } else {
        await this.validateUserInDepartment(
          dto.foreignMinisterId,
          roomIds,
          'Foreign Minister',
        );
        data.foreignMinisterId = dto.foreignMinisterId;
      }
    }

    if (dto.financeMinisterId !== undefined) {
      if (dto.financeMinisterId === null) {
        data.financeMinisterId = null;
      } else {
        await this.validateUserInDepartment(
          dto.financeMinisterId,
          roomIds,
          'Finance Minister',
        );
        data.financeMinisterId = dto.financeMinisterId;
      }
    }

    return this.prisma.department.update({
      where: { id },
      data,
      include: DEPARTMENT_INCLUDE,
    });
  }

  /** Ensure the user exists and their room belongs to the department. */
  private async validateUserInDepartment(
    userId: string,
    departmentRoomIds: Set<string>,
    roleLabel: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, roomId: true },
    });

    if (!user) {
      throw new NotFoundException(
        `User for ${roleLabel} not found (id: ${userId})`,
      );
    }

    if (!departmentRoomIds.has(user.roomId)) {
      throw new BadRequestException(
        `User "${userId}" does not belong to this department — cannot assign as ${roleLabel}`,
      );
    }
  }
}
