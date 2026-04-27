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
} from '@nestjs/common';
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

  @Get(':id')
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
