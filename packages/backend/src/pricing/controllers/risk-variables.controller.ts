import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard, RolesGuard } from '../../common/guards';
import { Roles } from '../../common/decorators';
import { RiskVariablesService } from '../services/risk-variables.service';

@Controller('risk-variables')
@UseGuards(FirebaseAuthGuard, RolesGuard)
export class RiskVariablesController {
  constructor(private readonly riskVariablesService: RiskVariablesService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'ENGINEER', 'VIEWER')
  findAll(@Query('variableType') variableType?: string) {
    return this.riskVariablesService.findAll(variableType);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'ENGINEER', 'VIEWER')
  findOne(@Param('id') id: string) {
    return this.riskVariablesService.findOne(id);
  }

  @Post()
  @Roles('ADMIN', 'MANAGER')
  create(@Body() dto: any) {
    return this.riskVariablesService.create(dto);
  }

  @Put(':id')
  @Roles('ADMIN', 'MANAGER')
  update(@Param('id') id: string, @Body() dto: any) {
    return this.riskVariablesService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  softDelete(@Param('id') id: string) {
    return this.riskVariablesService.softDelete(id);
  }
}
