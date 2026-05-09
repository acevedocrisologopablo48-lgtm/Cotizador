import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard, RolesGuard } from '../../common/guards';
import { Roles, CurrentUser } from '../../common/decorators';
import { ProjectTasksService } from '../services/project-tasks.service';
import { CreateTaskDto, UpdateTaskDto } from '../dto';

@Controller('projects/:projectId/tasks')
@UseGuards(FirebaseAuthGuard, RolesGuard)
export class ProjectTasksController {
  constructor(private readonly tasksService: ProjectTasksService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'ENGINEER', 'FIELD_SUPERVISOR', 'VIEWER')
  findByProject(
    @Param('projectId') projectId: string,
    @Query('status') status?: string,
    @Query('assigneeId') assigneeId?: string,
    @Query('milestoneId') milestoneId?: string,
    @Query('search') search?: string,
  ) {
    return this.tasksService.findByProject(projectId, { status, assigneeId, milestoneId, search });
  }

  @Get('kanban')
  @Roles('ADMIN', 'MANAGER', 'ENGINEER', 'FIELD_SUPERVISOR', 'VIEWER')
  findByProjectKanban(@Param('projectId') projectId: string) {
    return this.tasksService.findByProjectKanban(projectId);
  }

  @Get('gantt')
  @Roles('ADMIN', 'MANAGER', 'ENGINEER', 'FIELD_SUPERVISOR', 'VIEWER')
  findByProjectGantt(@Param('projectId') projectId: string) {
    return this.tasksService.findByProjectGantt(projectId);
  }

  @Get('alerts')
  @Roles('ADMIN', 'MANAGER', 'ENGINEER', 'FIELD_SUPERVISOR')
  getAlerts(@Param('projectId') projectId: string) {
    return this.tasksService.getAlerts(projectId);
  }

  @Post()
  @Roles('ADMIN', 'MANAGER', 'ENGINEER', 'FIELD_SUPERVISOR')
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateTaskDto,
    @CurrentUser() user: any,
  ) {
    return this.tasksService.create(projectId, dto, { id: user.id, fullName: user.fullName });
  }

  @Post('reorder')
  @Roles('ADMIN', 'MANAGER', 'ENGINEER', 'FIELD_SUPERVISOR')
  reorder(
    @Param('projectId') projectId: string,
    @Body('items') items: Array<{ id: string; order: number; status: string }>,
  ) {
    return this.tasksService.reorder(projectId, items);
  }

  @Put(':id')
  @Roles('ADMIN', 'MANAGER', 'ENGINEER', 'FIELD_SUPERVISOR')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
    @CurrentUser() user: any,
  ) {
    return this.tasksService.update(id, dto, { id: user.id, fullName: user.fullName });
  }

  @Patch(':id/status')
  @Roles('ADMIN', 'MANAGER', 'ENGINEER', 'FIELD_SUPERVISOR')
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status: string; order?: number },
    @CurrentUser() user: any,
  ) {
    return this.tasksService.updateStatus(id, body, { id: user.id, fullName: user.fullName });
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER')
  delete(@Param('id') id: string, @CurrentUser() user: any) {
    return this.tasksService.delete(id, { id: user.id, fullName: user.fullName });
  }
}

/**
 * Standalone controller for accessing a task directly by its ID
 * (without needing the projectId in the URL).
 */
@Controller('project-tasks')
@UseGuards(FirebaseAuthGuard, RolesGuard)
export class ProjectTasksDirectController {
  constructor(private readonly tasksService: ProjectTasksService) {}

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'ENGINEER', 'FIELD_SUPERVISOR', 'VIEWER')
  findOne(@Param('id') id: string) {
    return this.tasksService.findOne(id);
  }
}
