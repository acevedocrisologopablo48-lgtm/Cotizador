import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { PettyCashService } from './petty-cash.service';
import { FirebaseAuthGuard, RolesGuard } from '../common/guards';
import { Roles } from '../common/decorators';

@ApiTags('Caja Chica')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Controller('petty-cash')
export class PettyCashController {
  constructor(private readonly service: PettyCashService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT', 'FIELD_SUPERVISOR', 'ENGINEER')
  @ApiOperation({ summary: 'Listar cajas chicas' })
  async findAll(@Query('projectId') projectId?: string) {
    const data = await this.service.findAll(projectId);
    return { data };
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT', 'FIELD_SUPERVISOR', 'ENGINEER')
  @ApiOperation({ summary: 'Detalle de caja chica' })
  async findOne(@Param('id') id: string) {
    const data = await this.service.findOne(id);
    return { data };
  }

  @Post()
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Crear caja chica' })
  async create(@Body() body: any, @Request() req: any) {
    const data = await this.service.create({ ...body, responsibleUserId: req.user.id });
    return { data };
  }

  @Patch(':id/close')
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Cerrar caja chica' })
  async close(@Param('id') id: string) {
    const data = await this.service.close(id);
    return { data };
  }

  @Get(':id/transactions')
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT', 'FIELD_SUPERVISOR', 'ENGINEER')
  @ApiOperation({ summary: 'Listar movimientos' })
  async getTransactions(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.getTransactions(id, Number(page) || 1, Number(pageSize) || 20);
  }

  @Post(':id/transactions')
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT', 'FIELD_SUPERVISOR')
  @ApiOperation({ summary: 'Registrar movimiento' })
  async addTransaction(
    @Param('id') id: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    const data = await this.service.addTransaction(id, body, req.user.id);
    return { data };
  }
}
