import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsEnum,
  IsDateString,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

// ─── Create Petty Cash ───────────────────────────────────────────────

export class CreatePettyCashDto {
  @ApiProperty({ example: 'Caja Chica Proyecto X' })
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ example: 'projectId123' })
  @IsOptional()
  @IsString()
  projectId?: string;

  @ApiProperty({ example: 500 })
  @IsNumber({}, { message: 'initialBalance debe ser un número' })
  @Type(() => Number)
  @Min(0, { message: 'El saldo inicial no puede ser negativo' })
  @Max(1_000_000, { message: 'Saldo inicial fuera de rango razonable' })
  initialBalance: number;

  @ApiPropertyOptional({ example: 'PEN', default: 'PEN' })
  @IsOptional()
  @IsString()
  currency?: string;
}

// ─── Update Petty Cash ───────────────────────────────────────────────

export class UpdatePettyCashDto {
  @ApiPropertyOptional({ example: 'Caja Chica Obra Y' })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'El nombre debe ser un texto no vacío' })
  @MaxLength(200)
  name?: string;
}

// ─── Add Transaction ─────────────────────────────────────────────────

const ALLOWED_TX_TYPES = ['EXPENSE', 'INCOME', 'REFUND', 'ADJUSTMENT'] as const;

export class AddTransactionDto {
  @ApiProperty({ enum: ALLOWED_TX_TYPES, example: 'EXPENSE' })
  @IsEnum(ALLOWED_TX_TYPES, { message: 'Tipo de transacción inválido' })
  transactionType: string;

  @ApiProperty({ example: 'Compra de materiales' })
  @IsString()
  @IsNotEmpty({ message: 'La descripción es obligatoria' })
  @MaxLength(500)
  description: string;

  @ApiProperty({ example: 150.5 })
  @IsNumber({}, { message: 'El monto debe ser un número' })
  @Type(() => Number)
  @Min(0.01, { message: 'El monto debe ser mayor a 0' })
  @Max(1_000_000, { message: 'Monto fuera de rango razonable' })
  amount: number;

  @ApiProperty({ example: '2026-05-01T00:00:00.000Z' })
  @IsDateString({}, { message: 'transactionDate no es una fecha válida' })
  transactionDate: string;

  @ApiPropertyOptional({ example: 'projectId123' })
  @IsOptional()
  @IsString()
  projectId?: string;

  @ApiPropertyOptional({ example: 'Notas adicionales' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
