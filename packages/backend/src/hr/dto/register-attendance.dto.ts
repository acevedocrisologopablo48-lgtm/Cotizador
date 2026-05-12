import { IsString, IsEnum, IsOptional, IsObject, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AttendanceType } from '@fym/shared';

export class RegisterAttendanceDto {
  @ApiProperty({ description: 'ID del empleado a registrar' })
  @IsString()
  employeeId: string;

  @ApiProperty({ enum: AttendanceType })
  @IsEnum(AttendanceType)
  type: AttendanceType;

  @ApiProperty({ description: 'Evidencia de foto capturada. Puede ser data URL comprimida o URL externa.' })
  @IsString()
  @MaxLength(200000)
  photoUrl: string;

  @ApiPropertyOptional({
    description: 'Geolocalización opcional',
    example: { lat: -12.0464, lng: -77.0428 },
  })
  @IsOptional()
  @IsObject()
  location?: { lat: number; lng: number };

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
