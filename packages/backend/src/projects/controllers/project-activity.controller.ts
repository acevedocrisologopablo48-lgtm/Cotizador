import { Controller, Get, Param, Query, UseGuards, DefaultValuePipe, ParseIntPipe } from '@nestjs/common';
import { FirebaseAuthGuard, RolesGuard } from '../../common/guards';
import { Roles } from '../../common/decorators';
import { ProjectActivityService } from '../services/project-activity.service';

@Controller('projects/:projectId/activity')
@UseGuards(FirebaseAuthGuard, RolesGuard)
export class ProjectActivityController {
  constructor(private readonly activityService: ProjectActivityService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'ENGINEER', 'FIELD_SUPERVISOR', 'VIEWER')
  findByProject(
    @Param('projectId') projectId: string,
    @Query('limit', new DefaultValuePipe(30), ParseIntPipe) limit: number,
  ) {
    return this.activityService.findByProject(projectId, Math.min(limit, 100));
  }
}
