import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard, RolesGuard } from '../common/guards';
import { Roles } from '../common/decorators';
import { AppConfigService } from './app-config.service';

@Controller('config')
@UseGuards(FirebaseAuthGuard, RolesGuard)
export class AppConfigController {
  constructor(private readonly appConfigService: AppConfigService) {}

  @Get('quotation-types')
  @Roles('ADMIN', 'MANAGER', 'ENGINEER', 'FIELD_SUPERVISOR', 'ACCOUNTANT', 'VIEWER')
  getQuotationTypes() {
    return this.appConfigService.getQuotationTypes();
  }

  @Put('quotation-types')
  @Roles('ADMIN', 'MANAGER')
  updateQuotationTypes(@Body('types') types: string[]) {
    return this.appConfigService.updateQuotationTypes(types ?? []);
  }
}
