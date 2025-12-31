import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';

@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService) { }

  async create(dto: CreateRoomDto) {
    const dept = await this.prisma.department.findUnique({ where: { id: dto.departmentId } });
    if (!dept) throw new NotFoundException('Department not found');

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const room = await tx.room.create({ data: dto });

        // Create the room chatroom (1:1)
        await tx.chatRoom.create({
          data: {
            type: 'ROOM',
            roomId: room.id,
          },
        });

        return room;
      });

      return result;
    } catch (e: any) {
      if (e?.code === 'P2002') throw new ConflictException('Room number already exists in this department');
      throw e;
    }
  }


  async findAll() {
    return this.prisma.room.findMany({
      orderBy: { createdAt: 'desc' },
      include: { department: true, users: true },
    });
  }

  async findOne(id: string) {
    const room = await this.prisma.room.findUnique({
      where: { id },
      include: { department: true, users: true },
    });
    if (!room) throw new NotFoundException('Room not found');
    return room;
  }

  async update(id: string, dto: UpdateRoomDto) {
    if (dto.departmentId) {
      const dept = await this.prisma.department.findUnique({ where: { id: dto.departmentId } });
      if (!dept) throw new NotFoundException('Department not found');
    }

    try {
      return await this.prisma.room.update({
        where: { id },
        data: dto,
      });
    } catch (e: any) {
      if (e?.code === 'P2025') throw new NotFoundException('Room not found');
      if (e?.code === 'P2002') throw new ConflictException('Duplicate roomNumber in this department');
      throw e;
    }
  }

  async remove(id: string) {
    try {
      return await this.prisma.room.delete({ where: { id } });
    } catch (e: any) {
      if (e?.code === 'P2025') throw new NotFoundException('Room not found');
      throw e;
    }
  }

  async setMayor(roomId: string, mayorId: string) {
    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room) throw new NotFoundException('Room not found');

    const user = await this.prisma.user.findUnique({
      where: { id: mayorId },
      select: { id: true, roomId: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.roomId !== roomId) throw new ForbiddenException('Mayor must be from same room');

    await this.prisma.$transaction([
      this.prisma.room.update({ where: { id: roomId }, data: { mayorId } }),
      this.prisma.user.update({ where: { id: mayorId }, data: { role: Role.MAYOR } }),
    ]);

    return this.prisma.room.findUnique({
      where: { id: roomId },
      select: {
        id: true,
        roomNumber: true,
        department: { select: { id: true, name: true } },
        mayor: { select: { id: true, username: true, role: true } },
        users: { select: { id: true, username: true, role: true } },
      },
    });
  }
}
