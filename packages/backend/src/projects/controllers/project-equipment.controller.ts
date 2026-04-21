import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard, RolesGuard } from '../../common/guards';
import { Roles, CurrentUser } from '../../common/decorators';
import { ProjectEquipmentService } from '../services/project-equipment.service';

@Controller('projects/:projectId/equipment')
@UseGuards(FirebaseAuthGuard, RolesGuard)
export class ProjectEquipmentController {
  constructor(private readonly equipmentService: ProjectEquipmentService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'ENGINEER', 'FIELD_SUPERVISOR', 'VIEWER')
  findByProject(
    @Param('projectId') projectId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.equipmentService.findByProject(projectId, {
      page: page ? parseInt(page) : undefined,
      pageSize: pageSize ? parseInt(pageSize) : undefined,
    });
  }

  @Post()
  @Roles('ADMIN', 'MANAGER', 'FIELD_SUPERVISOR')
  create(@Param('projectId') projectId: string, @Body() dto: any, @CurrentUser() user: any) {
    return this.equipmentService.create(projectId, dto, user.id);
  }

  @Patch(':id/close')
  @Roles('ADMIN', 'MANAGER', 'FIELD_SUPERVISOR')
  close(@Param('projectId') projectId: string, @Param('id') id: string) {
    return this.equipmentService.close(projectId, id);
  }
}
