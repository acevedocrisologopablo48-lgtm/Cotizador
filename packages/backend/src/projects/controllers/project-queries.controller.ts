import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, Roles } from '../../common/decorators';
import { FirebaseAuthGuard, RolesGuard } from '../../common/guards';
import { ProjectQueriesService } from '../services/project-queries.service';
import { CreateQueryDto, AddMessageDto, UpdateQueryStatusDto } from '../dto';

@Controller('projects/:projectId/queries')
@UseGuards(FirebaseAuthGuard, RolesGuard)
export class ProjectQueriesController {
  constructor(private readonly queriesService: ProjectQueriesService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'ENGINEER', 'FIELD_SUPERVISOR', 'VIEWER', 'CLIENT')
  findAll(
    @Param('projectId') projectId: string,
    @CurrentUser() user: any,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
  ) {
    return this.queriesService.findAll(projectId, user, { status, priority });
  }

  @Get(':queryId')
  @Roles('ADMIN', 'MANAGER', 'ENGINEER', 'FIELD_SUPERVISOR', 'VIEWER', 'CLIENT')
  findOne(@Param('projectId') projectId: string, @Param('queryId') queryId: string, @CurrentUser() user: any) {
    return this.queriesService.findOne(projectId, queryId, user);
  }

  @Post()
  @Roles('ADMIN', 'MANAGER', 'ENGINEER', 'FIELD_SUPERVISOR', 'CLIENT')
  create(@Param('projectId') projectId: string, @Body() dto: CreateQueryDto, @CurrentUser() user: any) {
    return this.queriesService.create(projectId, dto, user);
  }

  @Post(':queryId/messages')
  @Roles('ADMIN', 'MANAGER', 'ENGINEER', 'FIELD_SUPERVISOR', 'CLIENT')
  addMessage(
    @Param('projectId') projectId: string,
    @Param('queryId') queryId: string,
    @Body() dto: AddMessageDto,
    @CurrentUser() user: any,
  ) {
    return this.queriesService.addMessage(projectId, queryId, dto, user);
  }

  @Patch(':queryId/status')
  @Roles('ADMIN', 'MANAGER', 'ENGINEER', 'FIELD_SUPERVISOR', 'CLIENT')
  updateStatus(
    @Param('projectId') projectId: string,
    @Param('queryId') queryId: string,
    @Body() dto: UpdateQueryStatusDto,
    @CurrentUser() user: any,
  ) {
    return this.queriesService.updateStatus(projectId, queryId, dto, user);
  }
}
