import {
  IsString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsDateString,
  IsBoolean,
  IsInt,
  IsNumber,
  MaxLength,
  MinLength,
  Min,
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

  @ApiPropertyOptional({ example: 'ARRIARAN' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  paternalLastName?: string;

  @ApiPropertyOptional({ example: 'GUERRA' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  maternalLastName?: string;

  @ApiPropertyOptional({ example: 'MELISSA' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  names?: string;

  @ApiPropertyOptional({ example: '1993-07-28', description: 'Fecha de nacimiento para SCTR YYYY-MM-DD' })
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @ApiPropertyOptional({ example: 'FEMENINO' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  gender?: string;

  @ApiPropertyOptional({ example: 'Soltero' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  civilStatus?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  childrenCount?: number;

  @ApiPropertyOptional({ example: 'Av. Principal 123' })
  @IsOptional()
  @IsString()
  @MaxLength(250)
  address?: string;

  @ApiPropertyOptional({ example: 'Soldadura, montacargas, electricidad' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  mainSkills?: string;

  @ApiPropertyOptional({ example: 'Sin restricciones medicas' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  medicalNotes?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  hasDriverLicense?: boolean;

  @ApiPropertyOptional({ example: 'Brevete A1' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  driverLicense?: string;

  @ApiPropertyOptional({ example: 'BCP' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  bankName?: string;

  @ApiPropertyOptional({ example: '191-12345678-0-00' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  bankAccountNumber?: string;

  @ApiPropertyOptional({ example: '00219100123456780000' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  cci?: string;

  @ApiPropertyOptional({ example: 'Ahorros' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  accountType?: string;

  @ApiPropertyOptional({ example: '914902991' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  yapePlinNumber?: string;

  @ApiPropertyOptional({ example: '40' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  shoeSize?: string;

  @ApiPropertyOptional({ example: 'M' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  shirtSize?: string;

  @ApiPropertyOptional({ example: '32' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  pantsSize?: string;

  @ApiPropertyOptional({ example: 'Familiar directo' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  emergencyContactName?: string;

  @ApiPropertyOptional({ example: '987654321' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  emergencyContactPhone?: string;

  @ApiPropertyOptional({ example: '987654322' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  emergencyContactPhone2?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  inductionPassed?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  safetyDocumentsDelivered?: boolean;

  @ApiPropertyOptional({ example: 1130 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  sctrSalary?: number;

  @ApiPropertyOptional({ example: 'CURRENT', description: 'CURRENT o BACKUP para exportacion SCTR' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  personnelGroup?: string;
}
