import { Controller, DefaultValuePipe, Delete, Get, ParseIntPipe, Patch, Post, Put, Body, Param, Query, UseGuards, Res } from '@nestjs/common';
import type { Response } from 'express';
import { FirebaseAuthGuard, RolesGuard } from '../../common/guards';
import { CurrentUser, Roles } from '../../common/decorators';
import { ProjectsService } from '../services/projects.service';
import { CreateProjectDto, UpdateProjectDto, UpdateProjectStatusDto } from '../dto';

@Controller('projects')
@UseGuards(FirebaseAuthGuard, RolesGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'ENGINEER', 'FIELD_SUPERVISOR', 'VIEWER', 'CLIENT')
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @CurrentUser() user?: any,
  ) {
    return this.projectsService.findAll({
      page,
      pageSize,
      search,
      status,
      user,
    });
  }

  @Get('exports/accounting')
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  async exportAccounting(@Query('month') month: string | undefined, @Res() res: Response) {
    const csv = await this.projectsService.exportAccountingCsv({ month });
    const safeMonth = month || new Date().toISOString().slice(0, 7);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="compras-proyectos-${safeMonth}.csv"`);
    res.send(`\uFEFF${csv}`);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'ENGINEER', 'FIELD_SUPERVISOR', 'VIEWER', 'CLIENT')
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    const data = await this.projectsService.findOne(id, user);
    return { data };
  }

  @Get(':id/summary')
  @Roles('ADMIN', 'MANAGER', 'ENGINEER', 'FIELD_SUPERVISOR', 'VIEWER')
  getSummary(@Param('id') id: string) {
    return this.projectsService.getSummary(id);
  }

  @Post()
  @Roles('ADMIN', 'MANAGER')
  create(@Body() dto: CreateProjectDto) {
    return this.projectsService.create(dto);
  }

  @Post('from-quotation/:quotationId')
  @Roles('ADMIN', 'MANAGER')
  createFromQuotation(@Param('quotationId') quotationId: string) {
    return this.projectsService.createFromQuotation(quotationId);
  }

  @Put(':id')
  @Roles('ADMIN', 'MANAGER')
  update(@Param('id') id: string, @Body() dto: UpdateProjectDto) {
    return this.projectsService.update(id, dto);
  }

  @Patch(':id/status')
  @Roles('ADMIN', 'MANAGER')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateProjectStatusDto) {
    return this.projectsService.updateStatus(id, dto.status);
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER')
  delete(@Param('id') id: string) {
    return this.projectsService.delete(id);
  }
}
