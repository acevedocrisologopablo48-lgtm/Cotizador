import { Controller, Get, Post, Put, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard, RolesGuard } from '../../common/guards';
import { Roles } from '../../common/decorators';
import { ProjectsService } from '../services/projects.service';

@Controller('projects')
@UseGuards(FirebaseAuthGuard, RolesGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'ENGINEER', 'FIELD_SUPERVISOR', 'VIEWER')
  findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.projectsService.findAll({
      page: page ? parseInt(page) : undefined,
      pageSize: pageSize ? parseInt(pageSize) : undefined,
      search,
      status,
    });
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'ENGINEER', 'FIELD_SUPERVISOR', 'VIEWER')
  findOne(@Param('id') id: string) {
    return this.projectsService.findOne(id);
  }

  @Get(':id/summary')
  @Roles('ADMIN', 'MANAGER', 'ENGINEER', 'FIELD_SUPERVISOR', 'VIEWER')
  getSummary(@Param('id') id: string) {
    return this.projectsService.getSummary(id);
  }

  @Post('from-quotation/:quotationId')
  @Roles('ADMIN', 'MANAGER')
  createFromQuotation(@Param('quotationId') quotationId: string) {
    return this.projectsService.createFromQuotation(quotationId);
  }

  @Put(':id')
  @Roles('ADMIN', 'MANAGER')
  update(@Param('id') id: string, @Body() dto: any) {
    return this.projectsService.update(id, dto);
  }

  @Patch(':id/status')
  @Roles('ADMIN', 'MANAGER')
  updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.projectsService.updateStatus(id, status);
  }
}
