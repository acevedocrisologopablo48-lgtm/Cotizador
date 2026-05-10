import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard, RolesGuard } from '../../common/guards';
import { CurrentUser, Roles } from '../../common/decorators';
import { ProjectDocumentsService } from '../services/project-documents.service';

@Controller('projects/:projectId/documents')
@UseGuards(FirebaseAuthGuard, RolesGuard)
export class ProjectDocumentsController {
  constructor(private readonly documentsService: ProjectDocumentsService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'ENGINEER', 'FIELD_SUPERVISOR', 'ACCOUNTANT', 'VIEWER')
  findByProject(@Param('projectId') projectId: string) {
    return this.documentsService.findByProject(projectId);
  }

  @Post()
  @Roles('ADMIN', 'MANAGER', 'ENGINEER', 'FIELD_SUPERVISOR', 'ACCOUNTANT')
  create(@Param('projectId') projectId: string, @Body() dto: any, @CurrentUser() user: any) {
    return this.documentsService.create(projectId, dto, user.id);
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER', 'ENGINEER', 'FIELD_SUPERVISOR', 'ACCOUNTANT')
  delete(@Param('projectId') projectId: string, @Param('id') id: string) {
    return this.documentsService.delete(projectId, id);
  }
}
