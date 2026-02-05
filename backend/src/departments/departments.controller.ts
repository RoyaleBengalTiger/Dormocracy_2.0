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

import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { UpdateDepartmentLeadershipDto } from './dto/update-department-leadership.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

/**
 * DepartmentsController
 *
 * REST endpoints for Departments.
 *
 * Security model:
 * - All routes require JWT authentication.
 * - Mutating endpoints require ADMIN role.
 */
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) { }

  /**
   * Create a department.
   */

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: CreateDepartmentDto) {
    return this.departmentsService.create(dto);
  }

  /**
   * Get all departments (with rooms + leadership).
   */
  @Get()
  findAll() {
    return this.departmentsService.findAll();
  }

  /**
   * Get one department by id (with rooms + leadership).
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.departmentsService.findOne(id);
  }

  /**
   * Update a department (name).
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDepartmentDto) {
    return this.departmentsService.update(id, dto);
  }

  /**
   * Delete a department.
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.departmentsService.remove(id);
  }

  /**
   * Assign or change Prime Minister / Foreign Minister for a department.
   *
   * ADMIN-only. Pass null to unassign.
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id/leadership')
  updateLeadership(
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentLeadershipDto,
  ) {
    return this.departmentsService.updateLeadership(id, dto);
  }
}
