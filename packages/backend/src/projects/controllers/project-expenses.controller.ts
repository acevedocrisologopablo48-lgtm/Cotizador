import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard, RolesGuard } from '../../common/guards';
import { Roles, CurrentUser } from '../../common/decorators';
import { ProjectExpensesService } from '../services/project-expenses.service';
import { ProjectAiService } from '../services/project-ai.service';
import { CreateExpenseDto } from '../dto';

@Controller('projects/:projectId/expenses')
@UseGuards(FirebaseAuthGuard, RolesGuard)
export class ProjectExpensesController {
  constructor(
    private readonly expensesService: ProjectExpensesService,
    private readonly aiService: ProjectAiService,
  ) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'ENGINEER', 'FIELD_SUPERVISOR', 'ACCOUNTANT', 'VIEWER')
  findByProject(
    @Param('projectId') projectId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('category') category?: string,
    @CurrentUser() user?: any,
  ) {
    return this.expensesService.findByProject(projectId, {
      page: page ? parseInt(page) : undefined,
      pageSize: pageSize ? parseInt(pageSize) : undefined,
      category,
      user,
    });
  }

  @Post()
  @Roles('ADMIN', 'MANAGER', 'ENGINEER', 'FIELD_SUPERVISOR')
  create(@Param('projectId') projectId: string, @Body() dto: CreateExpenseDto, @CurrentUser() user: any) {
    return this.expensesService.create(projectId, dto, user.id);
  }

  @Post('extract-invoice')
  @Roles('ADMIN', 'MANAGER', 'ENGINEER', 'FIELD_SUPERVISOR', 'ACCOUNTANT')
  extractInvoice(@Body('imageDataUrl') imageDataUrl: string) {
    return this.aiService.extractInvoice(imageDataUrl);
  }

  @Patch(':id/approve')
  @Roles('ADMIN', 'MANAGER')
  approve(@Param('projectId') projectId: string, @Param('id') id: string, @CurrentUser() user: any) {
    return this.expensesService.approve(projectId, id, user.id);
  }
}
