import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CreateTaskDto } from './dto/create-task.dto';
import { ApproveAssignTaskDto } from './dto/approve-assign-task.dto';
import { CompleteTaskDto } from './dto/complete-task.dto';
import { ReviewTaskDto } from './dto/review-task.dto';
import { Query } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) { }

  // citizen OR mayor can create
  @Roles(Role.CITIZEN, Role.MAYOR, Role.ADMIN)
  @Post()
  create(@Body() dto: CreateTaskDto, @Req() req: any) {
    return this.tasks.create(dto, req.user.sub);
  }

  // list tasks visible in your room
  @Get()
  findAll(
    @Req() req: any,
    @Query('status') status?: TaskStatus,
    @Query('myOnly') myOnly?: string,
  ) {
    return this.tasks.findAll(req.user.sub, {
      status,
      myOnly: myOnly === 'true',
    });
  }

  @Roles(Role.CITIZEN, Role.MAYOR, Role.ADMIN)
  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.tasks.findOne(id, req.user.sub);
  }

  // mayor approves + assigns
  @Roles(Role.MAYOR, Role.ADMIN)
  @Patch(':id/approve-assign')
  approveAssign(@Param('id') id: string, @Body() dto: ApproveAssignTaskDto, @Req() req: any) {
    return this.tasks.approveAndAssign(id, dto, req.user.sub);
  }

  // assignee completes
  @Roles(Role.CITIZEN, Role.MAYOR, Role.ADMIN)
  @Patch(':id/complete')
  complete(@Param('id') id: string, @Body() dto: CompleteTaskDto, @Req() req: any) {
    return this.tasks.complete(id, dto, req.user.sub);
  }

  // mayor reviews
  @Roles(Role.MAYOR, Role.ADMIN)
  @Patch(':id/review')
  review(@Param('id') id: string, @Body() dto: ReviewTaskDto, @Req() req: any) {
    return this.tasks.review(id, dto, req.user.sub);
  }
}
