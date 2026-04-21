import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@fym/shared';
import { Roles } from '../../common/decorators';
import { FirebaseAuthGuard, RolesGuard } from '../../common/guards';
import { CompaniesService } from '../services/companies.service';

@ApiTags('Companies')
@Controller('companies')
@UseGuards(FirebaseAuthGuard, RolesGuard)
@ApiBearerAuth()
export class CompaniesController {
  constructor(private companiesService: CompaniesService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ENGINEER, UserRole.VIEWER)
  async findAll(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ) {
    return this.companiesService.findAll({ page, pageSize, search, sortBy, sortOrder });
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ENGINEER, UserRole.VIEWER)
  async findOne(@Param('id') id: string) {
    const data = await this.companiesService.findOne(id);
    return { data };
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ENGINEER)
  async create(@Body() dto: any) {
    const data = await this.companiesService.create(dto);
    return { data };
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ENGINEER)
  async update(@Param('id') id: string, @Body() dto: any) {
    const data = await this.companiesService.update(id, dto);
    return { data };
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async softDelete(@Param('id') id: string) {
    const data = await this.companiesService.softDelete(id);
    return { data };
  }

  @Get(':id/history')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ENGINEER, UserRole.VIEWER)
  async getHistory(@Param('id') id: string) {
    const data = await this.companiesService.getHistory(id);
    return { data };
  }
}
