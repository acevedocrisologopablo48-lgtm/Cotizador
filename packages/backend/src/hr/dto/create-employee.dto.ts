import {
  IsString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsDateString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentType } from '@fym/shared';

export class CreateEmployeeDto {
  @ApiProperty({ example: 'Juan Carlos Pérez López' })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  fullName: string;

  @ApiProperty({ enum: DocumentType, example: DocumentType.DNI })
  @IsEnum(DocumentType)
  documentType: DocumentType;

  @ApiProperty({ example: '12345678' })
  @IsString()
  @MinLength(7)
  @MaxLength(20)
  documentNumber: string;

  @ApiProperty({ example: 'Operario de Construcción' })
  @IsString()
  @MaxLength(100)
  position: string;

  @ApiProperty({ example: 'Obras Civiles' })
  @IsString()
  @MaxLength(100)
  department: string;

  @ApiProperty({ example: '2024-01-15', description: 'Fecha de ingreso YYYY-MM-DD' })
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({ example: '+51 987654321' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({ example: 'juan.perez@empresa.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  email?: string;

  @ApiPropertyOptional({ description: 'URL de foto de perfil en Firebase Storage' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  photoUrl?: string;
}
