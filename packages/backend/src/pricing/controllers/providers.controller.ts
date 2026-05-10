import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard, RolesGuard } from '../../common/guards';
import { CurrentUser, Roles } from '../../common/decorators';
import { ProvidersService } from '../services/providers.service';

@Controller('providers')
@UseGuards(FirebaseAuthGuard, RolesGuard)
export class ProvidersController {
  constructor(private readonly providersService: ProvidersService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'ENGINEER', 'ACCOUNTANT', 'VIEWER')
  findAll(@Query('search') search?: string, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.providersService.findAll({
      search,
      page: page ? parseInt(page) : undefined,
      pageSize: pageSize ? parseInt(pageSize) : undefined,
    });
  }

  @Get('products')
  @Roles('ADMIN', 'MANAGER', 'ENGINEER', 'ACCOUNTANT', 'VIEWER')
  findProducts(@Query('search') search?: string) {
    return this.providersService.findProducts({ search });
  }

  @Post()
  @Roles('ADMIN', 'MANAGER', 'ENGINEER', 'ACCOUNTANT')
  create(@Body() dto: any, @CurrentUser() user: any) {
    return this.providersService.create(dto, user.id);
  }

  @Put(':id')
  @Roles('ADMIN', 'MANAGER', 'ENGINEER', 'ACCOUNTANT')
  update(@Param('id') id: string, @Body() dto: any) {
    return this.providersService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER')
  delete(@Param('id') id: string) {
    return this.providersService.delete(id);
  }
}
