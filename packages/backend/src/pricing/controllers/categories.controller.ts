import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard, RolesGuard } from '../../common/guards';
import { Roles } from '../../common/decorators';
import { CategoriesService } from '../services/categories.service';

@Controller('categories')
@UseGuards(FirebaseAuthGuard, RolesGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'ENGINEER', 'VIEWER')
  findAll(@Query('moduleType') moduleType?: string) {
    return this.categoriesService.findAll(moduleType);
  }

  @Get('tree')
  @Roles('ADMIN', 'MANAGER', 'ENGINEER', 'VIEWER')
  findTree(@Query('moduleType') moduleType?: string) {
    return this.categoriesService.findTree(moduleType);
  }

  @Post()
  @Roles('ADMIN', 'MANAGER')
  create(@Body() dto: any) {
    return this.categoriesService.create(dto);
  }

  @Put(':id')
  @Roles('ADMIN', 'MANAGER')
  update(@Param('id') id: string, @Body() dto: any) {
    return this.categoriesService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  delete(@Param('id') id: string) {
    return this.categoriesService.delete(id);
  }
}
