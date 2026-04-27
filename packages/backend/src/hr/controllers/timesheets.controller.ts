import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiProduces } from '@nestjs/swagger';
import { TimesheetsService } from '../services/timesheets.service';
import { FirebaseAuthGuard, RolesGuard } from '../../common/guards';
import { Roles } from '../../common/decorators';
import { TimesheetFilterDto } from '../dto/timesheet-filter.dto';

@ApiTags('RRHH - Tareos')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Controller('hr/timesheets')
export class TimesheetsController {
  constructor(private readonly service: TimesheetsService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'FIELD_SUPERVISOR', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Listar tareos con filtros (mes, semana, empleado, rango de fechas)' })
  async findAll(@Query() filters: TimesheetFilterDto) {
    const data = await this.service.findAll(filters);
    return { data };
  }

  @Get('summary')
  @Roles('ADMIN', 'MANAGER', 'FIELD_SUPERVISOR', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Resumen consolidado de tareos agrupado por empleado' })
  async getSummary(@Query() filters: TimesheetFilterDto) {
    const data = await this.service.getSummary(filters);
    return { data };
  }

  @Get('export')
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Exportar tareos a Excel (.xlsx)' })
  @ApiProduces('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  async exportToExcel(
    @Query() filters: TimesheetFilterDto,
    @Res() res: Response,
  ) {
    const buffer = await this.service.exportToExcel(filters);

    const label = filters.month ?? filters.dateFrom ?? 'reporte';
    const filename = `tareo-${label}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`,
    );
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  }
}
