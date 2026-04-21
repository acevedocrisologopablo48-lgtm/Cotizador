import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@fym/shared';
import { Roles } from '../../common/decorators';
import { FirebaseAuthGuard, RolesGuard } from '../../common/guards';
import { ContactsService } from '../services/contacts.service';

@ApiTags('Contacts')
@Controller('companies/:companyId/contacts')
@UseGuards(FirebaseAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ContactsController {
  constructor(private contactsService: ContactsService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ENGINEER, UserRole.VIEWER)
  async findByCompany(@Param('companyId') companyId: string) {
    const data = await this.contactsService.findByCompany(companyId);
    return { data };
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ENGINEER)
  async create(@Param('companyId') companyId: string, @Body() dto: any) {
    const data = await this.contactsService.create(companyId, dto);
    return { data };
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ENGINEER)
  async update(@Param('id') id: string, @Body() dto: any) {
    const data = await this.contactsService.update(id, dto);
    return { data };
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ENGINEER)
  async delete(@Param('id') id: string) {
    await this.contactsService.delete(id);
    return { data: { message: 'Contacto eliminado' } };
  }
}
