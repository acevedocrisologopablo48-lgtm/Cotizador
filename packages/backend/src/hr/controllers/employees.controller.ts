import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { EmployeesService } from '../services/employees.service';
import { FirebaseAuthGuard, RolesGuard } from '../../common/guards';
import { Roles } from '../../common/decorators';
import { CreateEmployeeDto } from '../dto/create-employee.dto';
import { UpdateEmployeeDto } from '../dto/update-employee.dto';

@ApiTags('RRHH - Empleados')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Controller('hr/employees')
export class EmployeesController {
  constructor(private readonly service: EmployeesService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT', 'FIELD_SUPERVISOR', 'ENGINEER')
  @ApiOperation({ summary: 'Listar empleados' })
  @ApiQuery({ name: 'status', required: false, enum: ['ACTIVE', 'INACTIVE'] })
  @ApiQuery({ name: 'search', required: false, description: 'Buscar por nombre, documento o cargo' })
  async findAll(
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    const data = await this.service.findAll(status, search);
    return { data };
  }

  @Get('exports/sctr')
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Exportar matriz de personal para Seguro SCTR' })
  async exportSctr(@Res() res: Response) {
    const buffer = await this.service.exportSctrExcel();
    const label = new Date().toISOString().slice(0, 7);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="personal-sctr-${label}.xlsx"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  }

  @Post('exports/sctr')
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Exportar matriz SCTR con personal seleccionado' })
  async exportSelectedSctr(@Body() dto: { employeeIds?: string[] }, @Res() res: Response) {
    const buffer = await this.service.exportSctrExcel(dto.employeeIds);
    const label = new Date().toISOString().slice(0, 7);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="personal-sctr-${label}.xlsx"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  }

  @Post('exports/project-personnel')
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT', 'ENGINEER')
  @ApiOperation({ summary: 'Exportar listado de personal para ejecucion de proyecto en PDF' })
  async exportProjectPersonnel(
    @Body() dto: { projectId: string; employeeIds: string[] },
    @Request() req: any,
    @Res() res: Response,
  ) {
    const result = await this.service.exportProjectPersonnelPdf(dto.projectId, dto.employeeIds, req.user.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('Content-Length', result.buffer.length);
    res.send(result.buffer);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT', 'FIELD_SUPERVISOR', 'ENGINEER')
  @ApiOperation({ summary: 'Detalle de empleado' })
  async findOne(@Param('id') id: string) {
    const data = await this.service.findOne(id);
    return { data };
  }

  @Post()
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Registrar nuevo empleado' })
  async create(@Body() dto: CreateEmployeeDto, @Request() req: any) {
    const data = await this.service.create(dto, req.user.id);
    return { data };
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Actualizar datos del empleado' })
  async update(@Param('id') id: string, @Body() dto: UpdateEmployeeDto) {
    const data = await this.service.update(id, dto);
    return { data };
  }

  @Patch(':id/deactivate')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Desactivar empleado (baja lógica)' })
  async deactivate(@Param('id') id: string) {
    const data = await this.service.deactivate(id);
    return { data };
  }
}
