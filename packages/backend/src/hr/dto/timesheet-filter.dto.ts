import { IsOptional, IsString, Matches } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class TimesheetFilterDto {
  @ApiPropertyOptional({ description: 'Mes en formato YYYY-MM', example: '2026-04' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}$/, { message: 'month debe tener formato YYYY-MM' })
  month?: string;

  @ApiPropertyOptional({ description: 'Semana en formato YYYY-Wnn', example: '2026-W17' })
  @IsOptional()
  @IsString()
  week?: string;

  @ApiPropertyOptional({ description: 'Filtrar por ID de empleado' })
  @IsOptional()
  @IsString()
  employeeId?: string;

  @ApiPropertyOptional({ description: 'Inicio del rango de fechas YYYY-MM-DD', example: '2026-04-01' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'dateFrom debe tener formato YYYY-MM-DD' })
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Fin del rango de fechas YYYY-MM-DD', example: '2026-04-30' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'dateTo debe tener formato YYYY-MM-DD' })
  dateTo?: string;
}
