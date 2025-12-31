import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';

import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { AssignMayorDto } from './dto/assign-mayor.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

/**
 * RoomsController
 *
 * REST endpoints for Rooms.
 *
 * Security model (recommended):
 * - Read endpoints (GET) require authentication.
 * - Mutating endpoints (POST/PATCH/DELETE) are ADMIN-only.
 * - Assigning a mayor is ADMIN-only and uses RoomsService.setMayor() to keep
 *   room.mayorId and user.role synchronized.
 */
@Controller('rooms')
@UseGuards(JwtAuthGuard) // Require auth by default for all routes in this controller
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) { }

  /**
   * List all rooms (with department + users).
   *
   * Authenticated users can read rooms (useful for dashboards/admin panels).
   */
  @Get()
  findAll() {
    return this.roomsService.findAll();
  }

  /**
   * Get a single room by id.
   *
   * Authenticated users can read a room.
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.roomsService.findOne(id);
  }

  /**
   * Create a room under a department.
   *
   * ADMIN-only because room creation affects global state.
   */
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: CreateRoomDto) {
    return this.roomsService.create(dto);
  }

  /**
   * Update room details (roomNumber or departmentId).
   *
   * ADMIN-only because it modifies global state and can affect user associations.
   */
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateRoomDto) {
    return this.roomsService.update(id, dto);
  }

  /**
   * Delete a room.
   *
   * ADMIN-only because it modifies global state.
   */
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.roomsService.remove(id);
  }

  /**
   * Assign a mayor to a room.
   *
   * ADMIN-only.
   * This must be done via room assignment to ensure:
   * - room.mayorId is set correctly
   * - user.role is set to MAYOR
   * - constraints like "user must belong to the room" are enforced in the service
   */
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id/mayor')
  assignMayor(@Param('id') roomId: string, @Body() dto: AssignMayorDto) {
    return this.roomsService.setMayor(roomId, dto.userId);
  }
}
