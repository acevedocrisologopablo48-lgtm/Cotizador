import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsEnum,
  IsArray,
  IsDateString,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ProjectStatus, TaskPriority, ProjectQueryPriority } from '@fym/shared';

// ─── Project ─────────────────────────────────────────────────────────

export class CreateProjectDto {
  @ApiProperty({ example: 'Construcción Nave Industrial' })
  @IsString()
  @IsNotEmpty({ message: 'El nombre del proyecto es obligatorio' })
  @MaxLength(300)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ example: 'companyId123' })
  @IsOptional()
  @IsString()
  companyId?: string;

  @ApiPropertyOptional({ example: 50000 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  approvedBudget?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  plannedStartDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  plannedEndDate?: string;

  @ApiPropertyOptional({ example: 'userId123' })
  @IsOptional()
  @IsString()
  managerId?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  memberIds?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class UpdateProjectDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  approvedBudget?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  plannedStartDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  plannedEndDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  actualStartDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  managerId?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  memberIds?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class UpdateProjectStatusDto {
  @ApiProperty({ enum: ProjectStatus })
  @IsEnum(ProjectStatus, { message: 'Estado de proyecto inválido' })
  status: string;
}

// ─── Expenses ────────────────────────────────────────────────────────

const EXPENSE_CATEGORIES = [
  'MATERIAL', 'EQUIPMENT', 'LABOR', 'SUBCONTRACT', 'TRANSPORT',
  'LODGING', 'FOOD', 'FUEL', 'TOOLS', 'PERMITS', 'OTHER',
] as const;

export class CreateExpenseDto {
  @ApiProperty({ enum: EXPENSE_CATEGORIES, example: 'MATERIAL' })
  @IsEnum(EXPENSE_CATEGORIES, { message: 'Categoría de gasto inválida' })
  expenseCategory: string;

  @ApiProperty({ example: 'Compra de cemento' })
  @IsString()
  @IsNotEmpty({ message: 'La descripción del gasto es obligatoria' })
  @MaxLength(500)
  description: string;

  @ApiProperty({ example: 1500 })
  @IsNumber({}, { message: 'El monto debe ser un número' })
  @Type(() => Number)
  @Min(0.01, { message: 'El monto del gasto debe ser mayor a 0' })
  amount: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expenseDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  supplierName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  supplierRuc?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  documentType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  documentNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  invoiceNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  invoiceImageUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  unitPrice?: number;
}

// ─── Tasks ───────────────────────────────────────────────────────────

export class CreateTaskDto {
  @ApiProperty({ example: 'Instalar cableado eléctrico' })
  @IsString()
  @IsNotEmpty({ message: 'El título de la tarea es obligatorio' })
  @MaxLength(300)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ enum: TaskPriority })
  @IsOptional()
  @IsEnum(TaskPriority, { message: 'Prioridad inválida' })
  priority?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assigneeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  milestoneId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  estimatedHours?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class UpdateTaskDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ enum: TaskPriority })
  @IsOptional()
  @IsEnum(TaskPriority, { message: 'Prioridad inválida' })
  priority?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assigneeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  milestoneId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  estimatedHours?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  actualHours?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

// ─── Milestones ──────────────────────────────────────────────────────

export class CreateMilestoneDto {
  @ApiProperty({ example: 'Entrega de estructura metálica' })
  @IsString()
  @IsNotEmpty({ message: 'El título del hito es obligatorio' })
  @MaxLength(300)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ example: '2026-06-15' })
  @IsDateString({}, { message: 'La fecha objetivo es obligatoria' })
  targetDate: string;
}

export class UpdateMilestoneDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  targetDate?: string;
}

// ─── Progress ────────────────────────────────────────────────────────

export class CreateActivityDto {
  @ApiProperty({ example: 'Excavación de zanjas' })
  @IsString()
  @IsNotEmpty({ message: 'El nombre de la partida es obligatorio' })
  @MaxLength(300)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}

export class AddDailyLogDto {
  @ApiProperty({ example: 'Se completó la excavación del tramo norte.' })
  @IsString()
  @IsNotEmpty({ message: 'La descripción diaria es obligatoria' })
  @MaxLength(5000)
  rawText: string;

  @ApiPropertyOptional({ example: 15, description: 'Avance diario en porcentaje (0-100)' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  @Max(100)
  progressDelta?: number;

  @ApiPropertyOptional({ type: [String], description: 'URLs de fotos' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photos?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  logDate?: string;
}

// ─── Queries ─────────────────────────────────────────────────────────

export class CreateQueryDto {
  @ApiProperty({ example: 'Consulta sobre especificaciones técnicas' })
  @IsString()
  @IsNotEmpty({ message: 'El título es obligatorio' })
  @MaxLength(300)
  title: string;

  @ApiProperty({ example: 'Necesitamos confirmar las especificaciones del acero...' })
  @IsString()
  @IsNotEmpty({ message: 'La descripción es obligatoria' })
  @MaxLength(5000)
  description: string;

  @ApiPropertyOptional({ enum: ProjectQueryPriority })
  @IsOptional()
  @IsEnum(ProjectQueryPriority)
  priority?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assignedTo?: string;
}

export class AddMessageDto {
  @ApiProperty({ example: 'La especificación correcta es...' })
  @IsString()
  @IsNotEmpty({ message: 'El mensaje es obligatorio' })
  @MaxLength(5000)
  body: string;
}

export class UpdateQueryStatusDto {
  @ApiProperty({ example: 'RESOLVED' })
  @IsString()
  @IsNotEmpty()
  status: string;
}
