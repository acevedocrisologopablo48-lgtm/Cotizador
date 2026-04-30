import { Controller, Post, Put, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard, RolesGuard } from '../../common/guards';
import { Roles } from '../../common/decorators';
import { QuotationItemsService } from '../services/quotation-items.service';

@Controller('quotations/:quotationId/sections/:sectionId/items')
@UseGuards(FirebaseAuthGuard, RolesGuard)
export class QuotationItemsController {
  constructor(private readonly itemsService: QuotationItemsService) {}

  @Post()
  @Roles('ADMIN', 'MANAGER', 'ENGINEER')
  create(
    @Param('quotationId') quotationId: string, 
    @Param('sectionId') sectionId: string, 
    @Body() dto: any
  ) {
    return this.itemsService.create(quotationId, sectionId, dto);
  }

  @Put(':id')
  @Roles('ADMIN', 'MANAGER', 'ENGINEER')
  update(
    @Param('quotationId') quotationId: string,
    @Param('sectionId') sectionId: string,
    @Param('id') id: string, 
    @Body() dto: any
  ) {
    return this.itemsService.update(quotationId, sectionId, id, dto);
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER', 'ENGINEER')
  patch(
    @Param('quotationId') quotationId: string,
    @Param('sectionId') sectionId: string,
    @Param('id') id: string,
    @Body() dto: any
  ) {
    return this.itemsService.update(quotationId, sectionId, id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER', 'ENGINEER')
  delete(
    @Param('quotationId') quotationId: string,
    @Param('sectionId') sectionId: string,
    @Param('id') id: string
  ) {
    return this.itemsService.delete(quotationId, sectionId, id);
  }

  @Post('reorder')
  @Roles('ADMIN', 'MANAGER', 'ENGINEER')
  reorder(
    @Param('quotationId') quotationId: string,
    @Param('sectionId') sectionId: string, 
    @Body('ids') ids: string[]
  ) {
    return this.itemsService.reorder(quotationId, sectionId, ids);
  }
}
