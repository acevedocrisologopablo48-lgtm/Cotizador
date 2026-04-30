import { Controller, Post, Put, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard, RolesGuard } from '../../common/guards';
import { Roles } from '../../common/decorators';
import { QuotationSectionsService } from '../services/quotation-sections.service';

@Controller('quotations/:quotationId/sections')
@UseGuards(FirebaseAuthGuard, RolesGuard)
export class QuotationSectionsController {
  constructor(private readonly sectionsService: QuotationSectionsService) {}

  @Post()
  @Roles('ADMIN', 'MANAGER', 'ENGINEER')
  create(@Param('quotationId') quotationId: string, @Body() dto: any) {
    return this.sectionsService.create(quotationId, dto);
  }

  @Put(':id')
  @Roles('ADMIN', 'MANAGER', 'ENGINEER')
  update(
    @Param('quotationId') quotationId: string,
    @Param('id') id: string, 
    @Body() dto: any
  ) {
    return this.sectionsService.update(quotationId, id, dto);
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER', 'ENGINEER')
  patch(
    @Param('quotationId') quotationId: string,
    @Param('id') id: string,
    @Body() dto: any
  ) {
    return this.sectionsService.update(quotationId, id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER', 'ENGINEER')
  delete(
    @Param('quotationId') quotationId: string,
    @Param('id') id: string
  ) {
    return this.sectionsService.delete(quotationId, id);
  }

  @Post('reorder')
  @Roles('ADMIN', 'MANAGER', 'ENGINEER')
  reorder(
    @Param('quotationId') quotationId: string, 
    @Body('ids') ids: string[]
  ) {
    return this.sectionsService.reorder(quotationId, ids);
  }
}
