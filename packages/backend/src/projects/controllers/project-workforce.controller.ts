import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard, RolesGuard } from '../../common/guards';
import { Roles, CurrentUser } from '../../common/decorators';
import { ProjectWorkforceService } from '../services/project-workforce.service';

@Controller('projects/:projectId/workforce')
@UseGuards(FirebaseAuthGuard, RolesGuard)
export class ProjectWorkforceController {
  constructor(private readonly workforceService: ProjectWorkforceService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'ENGINEER', 'FIELD_SUPERVISOR', 'VIEWER')
  findByProject(
    @Param('projectId') projectId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.workforceService.findByProject(projectId, {
      page: page ? parseInt(page) : undefined,
      pageSize: pageSize ? parseInt(pageSize) : undefined,
    });
  }

  @Post()
  @Roles('ADMIN', 'MANAGER', 'FIELD_SUPERVISOR')
  create(@Param('projectId') projectId: string, @Body() dto: any, @CurrentUser() user: any) {
    return this.workforceService.create(projectId, dto, user.id);
  }
}
