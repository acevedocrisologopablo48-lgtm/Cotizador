import { Controller, Get, Post, Put, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard, RolesGuard } from '../../common/guards';
import { Roles } from '../../common/decorators';
import { CurrentUser } from '../../common/decorators';
import { QuotationsService } from '../services/quotations.service';

@Controller('quotations')
@UseGuards(FirebaseAuthGuard, RolesGuard)
export class QuotationsController {
  constructor(private readonly quotationsService: QuotationsService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'ENGINEER', 'VIEWER')
  findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('companyId') companyId?: string,
  ) {
    return this.quotationsService.findAll({
      page: page ? parseInt(page) : undefined,
      pageSize: pageSize ? parseInt(pageSize) : undefined,
      search,
      status,
      companyId,
    });
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'ENGINEER', 'VIEWER')
  findOne(@Param('id') id: string) {
    return this.quotationsService.findOne(id);
  }

  @Post()
  @Roles('ADMIN', 'MANAGER', 'ENGINEER')
  create(@Body() dto: any, @CurrentUser() user: any) {
    return this.quotationsService.create(dto, user.id);
  }

  @Put(':id')
  @Roles('ADMIN', 'MANAGER', 'ENGINEER')
  update(@Param('id') id: string, @Body() dto: any) {
    return this.quotationsService.update(id, dto);
  }

  @Patch(':id/status')
  @Roles('ADMIN', 'MANAGER')
  updateStatus(@Param('id') id: string, @Body('status') status: string, @CurrentUser() user: any) {
    return this.quotationsService.updateStatus(id, status, user.id);
  }

  @Post(':id/recalculate')
  @Roles('ADMIN', 'MANAGER', 'ENGINEER')
  recalculate(@Param('id') id: string) {
    return this.quotationsService.recalculate(id);
  }

  @Post(':id/duplicate')
  @Roles('ADMIN', 'MANAGER', 'ENGINEER')
  duplicate(@Param('id') id: string, @CurrentUser() user: any) {
    return this.quotationsService.duplicate(id, user.id);
  }
}
