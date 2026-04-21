import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@fym/shared';
import { Roles } from '../../common/decorators';
import { FirebaseAuthGuard, RolesGuard } from '../../common/guards';
import { AgreementsService } from '../services/agreements.service';

@ApiTags('Commercial Agreements')
@Controller('companies/:companyId/agreements')
@UseGuards(FirebaseAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AgreementsController {
  constructor(private agreementsService: AgreementsService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER)
  async findByCompany(@Param('companyId') companyId: string) {
    const data = await this.agreementsService.findByCompany(companyId);
    return { data };
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async create(@Param('companyId') companyId: string, @Body() dto: any) {
    const data = await this.agreementsService.create(companyId, dto);
    return { data };
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async update(@Param('id') id: string, @Body() dto: any) {
    const data = await this.agreementsService.update(id, dto);
    return { data };
  }
}
