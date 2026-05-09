import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, Roles } from '../../common/decorators';
import { FirebaseAuthGuard, RolesGuard } from '../../common/guards';
import { ProjectProgressService } from '../services/project-progress.service';
import { CreateActivityDto, AddDailyLogDto } from '../dto';

@Controller('projects/:projectId/progress')
@UseGuards(FirebaseAuthGuard, RolesGuard)
export class ProjectProgressController {
  constructor(private readonly progressService: ProjectProgressService) {}

  @Get('activities')
  @Roles('ADMIN', 'MANAGER', 'ENGINEER', 'FIELD_SUPERVISOR', 'VIEWER', 'CLIENT')
  findActivities(@Param('projectId') projectId: string, @CurrentUser() user: any) {
    return this.progressService.findActivities(projectId, user);
  }

  @Post('activities')
  @Roles('ADMIN', 'MANAGER', 'ENGINEER', 'FIELD_SUPERVISOR')
  createActivity(@Param('projectId') projectId: string, @Body() dto: CreateActivityDto) {
    return this.progressService.createActivity(projectId, dto);
  }

  @Delete('activities/:activityId')
  @Roles('ADMIN', 'MANAGER', 'ENGINEER', 'FIELD_SUPERVISOR')
  deleteActivity(@Param('projectId') projectId: string, @Param('activityId') activityId: string) {
    return this.progressService.deleteActivity(projectId, activityId);
  }

  @Post('activities/:activityId/logs')
  @Roles('ADMIN', 'MANAGER', 'ENGINEER', 'FIELD_SUPERVISOR')
  addDailyLog(
    @Param('projectId') projectId: string,
    @Param('activityId') activityId: string,
    @Body() dto: AddDailyLogDto,
    @CurrentUser() user: any,
  ) {
    return this.progressService.addDailyLog(projectId, activityId, dto, user.id);
  }

  @Get('report')
  @Roles('ADMIN', 'MANAGER', 'ENGINEER', 'FIELD_SUPERVISOR', 'VIEWER', 'CLIENT')
  buildReport(
    @Param('projectId') projectId: string,
    @CurrentUser() user: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.progressService.buildReport(projectId, { from, to }, user);
  }
}
