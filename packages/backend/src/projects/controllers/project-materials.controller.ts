import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, Roles } from '../../common/decorators';
import { FirebaseAuthGuard, RolesGuard } from '../../common/guards';
import { ProjectMaterialsService } from '../services/project-materials.service';

@Controller('projects/:projectId/materials')
@UseGuards(FirebaseAuthGuard, RolesGuard)
export class ProjectMaterialsController {
  constructor(private readonly materialsService: ProjectMaterialsService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'ENGINEER', 'FIELD_SUPERVISOR', 'ACCOUNTANT', 'VIEWER')
  findByProject(@Param('projectId') projectId: string) {
    return this.materialsService.findByProject(projectId);
  }

  @Post()
  @Roles('ADMIN', 'MANAGER', 'ENGINEER', 'FIELD_SUPERVISOR')
  create(@Param('projectId') projectId: string, @Body() dto: any, @CurrentUser() user: any) {
    return this.materialsService.create(projectId, dto, user.id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER', 'ENGINEER')
  update(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: any,
    @CurrentUser() user: any,
  ) {
    return this.materialsService.update(projectId, id, dto, user.id);
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER', 'ENGINEER', 'FIELD_SUPERVISOR')
  remove(@Param('projectId') projectId: string, @Param('id') id: string) {
    return this.materialsService.deleteRequest(projectId, id);
  }
}
