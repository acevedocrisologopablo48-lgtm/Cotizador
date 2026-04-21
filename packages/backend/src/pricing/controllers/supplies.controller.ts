import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard, RolesGuard } from '../../common/guards';
import { Roles, CurrentUser } from '../../common/decorators';
import { SuppliesService } from '../services/supplies.service';

@Controller('supplies')
@UseGuards(FirebaseAuthGuard, RolesGuard)
export class SuppliesController {
  constructor(private readonly suppliesService: SuppliesService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'ENGINEER', 'VIEWER')
  findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
    @Query('supplyType') supplyType?: string,
    @Query('categoryId') categoryId?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ) {
    return this.suppliesService.findAll({
      page: page ? parseInt(page) : undefined,
      pageSize: pageSize ? parseInt(pageSize) : undefined,
      search,
      supplyType,
      categoryId,
      sortBy,
      sortOrder,
    });
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'ENGINEER', 'VIEWER')
  findOne(@Param('id') id: string) {
    return this.suppliesService.findOne(id);
  }

  @Post()
  @Roles('ADMIN', 'MANAGER', 'ENGINEER')
  create(@Body() dto: any) {
    return this.suppliesService.create(dto);
  }

  @Put(':id')
  @Roles('ADMIN', 'MANAGER', 'ENGINEER')
  update(@Param('id') id: string, @Body() dto: any, @CurrentUser() user: any) {
    return this.suppliesService.update(id, dto, user.id);
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER')
  softDelete(@Param('id') id: string) {
    return this.suppliesService.softDelete(id);
  }
}
