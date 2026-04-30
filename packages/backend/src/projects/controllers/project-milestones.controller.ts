import { Controller, Get, Post, Put, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard, RolesGuard } from '../../common/guards';
import { Roles, CurrentUser } from '../../common/decorators';
import { ProjectMilestonesService } from '../services/project-milestones.service';

@Controller('projects/:projectId/milestones')
@UseGuards(FirebaseAuthGuard, RolesGuard)
export class ProjectMilestonesController {
  constructor(private readonly milestonesService: ProjectMilestonesService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'ENGINEER', 'FIELD_SUPERVISOR', 'VIEWER')
  findByProject(@Param('projectId') projectId: string) {
    return this.milestonesService.findByProject(projectId);
  }

  @Post()
  @Roles('ADMIN', 'MANAGER')
  create(
    @Param('projectId') projectId: string,
    @Body() dto: any,
    @CurrentUser() user: any,
  ) {
    return this.milestonesService.create(projectId, dto, { id: user.id, fullName: user.fullName });
  }

  @Put(':id')
  @Roles('ADMIN', 'MANAGER')
  update(
    @Param('id') id: string,
    @Body() dto: any,
    @CurrentUser() user: any,
  ) {
    return this.milestonesService.update(id, dto, { id: user.id, fullName: user.fullName });
  }

  @Patch(':id/complete')
  @Roles('ADMIN', 'MANAGER', 'ENGINEER')
  complete(@Param('id') id: string, @CurrentUser() user: any) {
    return this.milestonesService.complete(id, { id: user.id, fullName: user.fullName });
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER')
  delete(@Param('id') id: string, @CurrentUser() user: any) {
    return this.milestonesService.delete(id, { id: user.id, fullName: user.fullName });
  }
}

/**
 * Direct access to milestones by ID.
 */
@Controller('project-milestones')
@UseGuards(FirebaseAuthGuard, RolesGuard)
export class ProjectMilestonesDirectController {
  constructor(private readonly milestonesService: ProjectMilestonesService) {}

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'ENGINEER', 'FIELD_SUPERVISOR', 'VIEWER')
  findOne(@Param('id') id: string) {
    return this.milestonesService.findOne(id);
  }
}
