import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AttendancesService } from '../services/attendances.service';
import { FirebaseAuthGuard, RolesGuard } from '../../common/guards';
import { Roles } from '../../common/decorators';
import { RegisterAttendanceDto } from '../dto/register-attendance.dto';

@ApiTags('RRHH - Asistencias')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Controller('hr/attendances')
export class AttendancesController {
  constructor(private readonly service: AttendancesService) {}

  @Post()
  @Roles('ADMIN', 'MANAGER', 'FIELD_SUPERVISOR', 'ENGINEER')
  @ApiOperation({
    summary: 'Registrar marcación de entrada o salida',
    description:
      'La foto debe ser subida a Firebase Storage ANTES de llamar a este endpoint. ' +
      'El campo photoUrl debe contener la URL pública del archivo ya almacenado.',
  })
  async register(@Body() dto: RegisterAttendanceDto, @Request() req: any) {
    const data = await this.service.register(dto, req.user.id);
    return { data };
  }

  @Get()
  @Roles('ADMIN', 'MANAGER', 'FIELD_SUPERVISOR', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Listar asistencias con filtros opcionales' })
  @ApiQuery({ name: 'employeeId', required: false })
  @ApiQuery({ name: 'dateFrom', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'dateTo',   required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'page',     required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  async findAll(
    @Query('employeeId') employeeId?: string,
    @Query('dateFrom')   dateFrom?: string,
    @Query('dateTo')     dateTo?: string,
    @Query('page')       page?: string,
    @Query('pageSize')   pageSize?: string,
  ) {
    return this.service.findAll(
      employeeId,
      dateFrom,
      dateTo,
      Number(page)     || 1,
      Number(pageSize) || 30,
    );
  }
}
