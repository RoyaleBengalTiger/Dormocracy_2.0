import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

/**
 * DepartmentsController
 *
 * REST endpoints for Departments.
 * NOTE: We keep endpoints public for now; once Auth is ready we will protect them with guards.
 */
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) { }

  /**
   * Create a department.
   */
  @Post()
  create(@Body() dto: CreateDepartmentDto) {
    return this.departmentsService.create(dto);
  }

  /**
   * Get all departments (with their rooms).
   */
  @Get()
  findAll() {
    return this.departmentsService.findAll();
  }

  /**
   * Get one department by id (with its rooms).
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.departmentsService.findOne(id);
  }

  /**
   * Update a department.
   */
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDepartmentDto) {
    return this.departmentsService.update(id, dto);
  }

  /**
   * Delete a department.
   */
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.departmentsService.remove(id);
  }
}
