import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard, RolesGuard } from '../../common/guards';
import { Roles } from '../../common/decorators';
import { PerformanceRatesService } from '../services/performance-rates.service';

@Controller('performance-rates')
@UseGuards(FirebaseAuthGuard, RolesGuard)
export class PerformanceRatesController {
  constructor(private readonly performanceRatesService: PerformanceRatesService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'ENGINEER', 'VIEWER')
  findAll(@Query('specialty') specialty?: string, @Query('search') search?: string) {
    return this.performanceRatesService.findAll({ specialty, search });
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'ENGINEER', 'VIEWER')
  findOne(@Param('id') id: string) {
    return this.performanceRatesService.findOne(id);
  }

  @Post()
  @Roles('ADMIN', 'MANAGER', 'ENGINEER')
  create(@Body() dto: any) {
    return this.performanceRatesService.create(dto);
  }

  @Put(':id')
  @Roles('ADMIN', 'MANAGER', 'ENGINEER')
  update(@Param('id') id: string, @Body() dto: any) {
    return this.performanceRatesService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER')
  softDelete(@Param('id') id: string) {
    return this.performanceRatesService.softDelete(id);
  }
}
