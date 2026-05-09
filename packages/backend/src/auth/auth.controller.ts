import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { CurrentUser, Roles } from '../common/decorators';
import { FirebaseAuthGuard, RolesGuard } from '../common/guards';
import { UserRole } from '@fym/shared';
import { IsEmail, IsString, IsNotEmpty, MinLength, IsOptional, IsBoolean, IsIn, IsArray } from 'class-validator';

const SYSTEM_ROLES = [...Object.values(UserRole), 'CLIENT'] as string[];

class UpdateRoleDto {
  @IsIn(SYSTEM_ROLES)
  role: string;
}

class UpdateStatusDto {
  @IsBoolean()
  isActive: boolean;
}

class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsIn(SYSTEM_ROLES)
  role: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  allowedProjectIds?: string[];
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Get('me')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  async getProfile(@CurrentUser('id') userId: string) {
    const [user] = await Promise.all([
      this.authService.getProfile(userId),
      this.authService.touchLastLoginIfStale(userId),
    ]);
    return { data: user };
  }

  @Post('users')
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  async createUser(@Body() dto: CreateUserDto) {
    const user = await this.authService.createUser(dto);
    return { data: user };
  }

  @Get('users')
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  async listUsers() {
    const users = await this.authService.listUsers();
    return { data: users };
  }

  @Get('users/assignable')
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ENGINEER, UserRole.FIELD_SUPERVISOR)
  @ApiBearerAuth()
  async listAssignableUsers() {
    const users = await this.authService.listAssignableUsers();
    return { data: users };
  }

  @Put('users/:id/role')
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  async updateRole(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    const result = await this.authService.updateUserRole(id, dto.role);
    return { data: result };
  }

  @Put('users/:id/client-access')
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  async updateClientAccess(@Param('id') id: string, @Body('allowedProjectIds') allowedProjectIds: string[]) {
    const result = await this.authService.updateClientAccess(id, allowedProjectIds);
    return { data: result };
  }

  @Put('users/:id/status')
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto) {
    const result = await this.authService.updateUserStatus(id, dto.isActive);
    return { data: result };
  }

  @Delete('users/:id')
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  async deleteUser(
    @Param('id') id: string,
    @CurrentUser('id') currentUserId: string,
  ) {
    if (id === currentUserId) {
      throw new BadRequestException('No puedes eliminarte a ti mismo');
    }
    await this.authService.deleteUser(id);
    return { message: 'Usuario eliminado correctamente' };
  }
}
