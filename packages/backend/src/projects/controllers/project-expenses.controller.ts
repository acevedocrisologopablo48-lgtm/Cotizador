import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard, RolesGuard } from '../../common/guards';
import { Roles, CurrentUser } from '../../common/decorators';
import { ProjectExpensesService } from '../services/project-expenses.service';

@Controller('projects/:projectId/expenses')
@UseGuards(FirebaseAuthGuard, RolesGuard)
export class ProjectExpensesController {
  constructor(private readonly expensesService: ProjectExpensesService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'ENGINEER', 'FIELD_SUPERVISOR', 'ACCOUNTANT', 'VIEWER')
  findByProject(
    @Param('projectId') projectId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('category') category?: string,
  ) {
    return this.expensesService.findByProject(projectId, {
      page: page ? parseInt(page) : undefined,
      pageSize: pageSize ? parseInt(pageSize) : undefined,
      category,
    });
  }

  @Post()
  @Roles('ADMIN', 'MANAGER', 'ENGINEER', 'FIELD_SUPERVISOR')
  create(@Param('projectId') projectId: string, @Body() dto: any, @CurrentUser() user: any) {
    return this.expensesService.create(projectId, dto, user.id);
  }

  @Patch(':id/approve')
  @Roles('ADMIN', 'MANAGER')
  approve(@Param('projectId') projectId: string, @Param('id') id: string, @CurrentUser() user: any) {
    return this.expensesService.approve(projectId, id, user.id);
  }
}
